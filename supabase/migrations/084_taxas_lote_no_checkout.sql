-- =====================================================
-- MIGRATION 084: Taxas do lote aplicadas no checkout + faixa de separação
-- =====================================================
-- Problema: a cliente configurou Custo Motoboy R$ 8,00 no lote, mas o
-- romaneio nunca mostrava esse valor. Confirmado nos dados: todos os
-- romaneios estavam com custo_motoboy = 0,00.
--
-- Causa: checkout_romaneio (migration 072) gravava
--   valor_total = valor_produtos
-- e não copiava NENHUMA taxa do lote. As colunas custo_motoboy /
-- custo_digitacao / custo_operacional existem em romaneios desde a
-- migration 050, mas só eram preenchidas por recalculate_romaneio_values,
-- que roda apenas na transição aberto -> fechado do lote.
--
-- Esta migration:
--   1. Cria a função de faixa da taxa de separação (regra nova da cliente:
--      R$ 15,00 até R$ 80,00 e R$ 20,00 de R$ 80,01 em diante) — espelha
--      src/utils/romaneioTotals.js no front.
--   2. Faz checkout_romaneio gravar separação + motoboy + digitação +
--      operacional e um valor_total completo já na criação/atualização.
--   3. Atualiza recalculate_romaneio_values para usar a faixa em vez do
--      valor fixo lots.custo_separacao.
--
-- Não há backfill: romaneios já existentes (inclusive pagos) não são
-- alterados. O front exibe o valor correto neles via fallback pelo lote.
-- Assinatura de checkout_romaneio mantida (4 parâmetros, igual à 072).

-- -----------------------------------------------------
-- 1. Faixa da taxa de separação
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.calc_taxa_separacao(p_valor_produtos NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_valor_produtos, 0) <= 0 THEN 0
    WHEN p_valor_produtos <= 80 THEN 15
    ELSE 20
  END::NUMERIC;
$$;

COMMENT ON FUNCTION public.calc_taxa_separacao(NUMERIC) IS
  'Taxa de separação por faixa de valor do pedido: R$ 15,00 até R$ 80,00; R$ 20,00 acima. Espelha getTaxaSeparacao em src/utils/romaneioTotals.js.';

-- -----------------------------------------------------
-- 2. checkout_romaneio aplicando as taxas do lote
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_romaneio(
    p_lot_id UUID,
    p_items JSONB,
    p_client_snapshot JSONB DEFAULT '{}'::JSONB,
    p_payment_method TEXT DEFAULT 'pix'
)
RETURNS JSONB AS $$
DECLARE
    v_client_id UUID;
    v_existing_id UUID;
    v_status_pagamento TEXT;
    v_romaneio_id UUID;
    v_valor_produtos NUMERIC := 0;
    v_total_itens INT := 0;
    v_lot_status TEXT;
    v_log_status TEXT;
    -- Taxas do lote aplicadas ao romaneio
    v_lot RECORD;
    v_taxa_separacao NUMERIC := 0;
    v_custo_motoboy NUMERIC := 0;
    v_custo_digitacao NUMERIC := 0;
    v_custo_operacional NUMERIC := 0;
    v_valor_total NUMERIC := 0;
BEGIN
    -- 1. Buscar client_id pelo auth.uid()
    SELECT id INTO v_client_id
    FROM clients
    WHERE auth_id = auth.uid();

    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Cliente não autenticado ou não encontrado.';
    END IF;

    -- 2. Verificar status do lote (e já carregar as taxas)
    SELECT * INTO v_lot FROM lots WHERE id = p_lot_id;

    -- NOT FOUND, não "v_lot IS NULL": um RECORD não vira NULL num SELECT vazio
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lote não encontrado: %', p_lot_id;
    END IF;

    v_lot_status := v_lot.status;

    IF v_lot_status NOT IN ('aberto', 'pronto_e_aberto') THEN
        RAISE EXCEPTION 'O lote não está aberto para pedidos (status: %).', v_lot_status;
    END IF;

    -- 3. Calcular totais dos itens
    SELECT
        COALESCE(SUM((item->>'quantity')::INT), 0),
        COALESCE(SUM((item->>'quantity')::INT * (item->>'valor_unitario')::NUMERIC), 0)
    INTO v_total_itens, v_valor_produtos
    FROM jsonb_array_elements(p_items) AS item;

    IF v_total_itens = 0 THEN
        RAISE EXCEPTION 'Carrinho vazio.';
    END IF;

    -- 3b. Taxas: separação por faixa + taxas fixas do lote
    v_taxa_separacao   := calc_taxa_separacao(v_valor_produtos);
    v_custo_motoboy    := COALESCE(v_lot.custo_motoboy, 0);
    v_custo_digitacao  := COALESCE(v_lot.custo_digitacao, 0);
    v_custo_operacional := COALESCE(v_lot.custo_operacional, 0) * v_total_itens;

    v_valor_total := v_valor_produtos + v_taxa_separacao + v_custo_motoboy
                     + v_custo_digitacao + v_custo_operacional;

    -- 4. Verificar se já existe romaneio em rascunho para este cliente/lote
    SELECT id, status_pagamento INTO v_existing_id, v_status_pagamento
    FROM romaneios
    WHERE lot_id = p_lot_id AND client_id = v_client_id;

    IF v_existing_id IS NOT NULL THEN
        IF v_status_pagamento NOT IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado', 'pago_50_pct', 'pago_50_pct_s_frete', 'parcialmente_pago') THEN
            RAISE EXCEPTION 'Já existe um romaneio processado (Status: %) para este link.', v_status_pagamento;
        END IF;
        v_romaneio_id := v_existing_id;
        v_log_status := v_status_pagamento;

        DELETE FROM romaneio_items WHERE romaneio_id = v_romaneio_id;

        UPDATE romaneios
        SET
            client_id = v_client_id,
            quantidade_itens = v_total_itens,
            valor_produtos = v_valor_produtos,
            taxa_separacao = v_taxa_separacao,
            custo_motoboy = v_custo_motoboy,
            custo_digitacao = v_custo_digitacao,
            custo_operacional = v_custo_operacional,
            -- frete manual informado pelo admin é preservado
            valor_total = v_valor_total + COALESCE(valor_frete, 0),
            subtotal = v_valor_produtos,
            total = v_valor_total + COALESCE(valor_frete, 0),
            total_itens = v_total_itens,
            updated_at = NOW(),
            cliente_nome_snapshot = COALESCE(p_client_snapshot->>'nome', cliente_nome_snapshot),
            cliente_telefone_snapshot = COALESCE(p_client_snapshot->>'telefone', cliente_telefone_snapshot),
            endereco_entrega_snapshot = COALESCE(p_client_snapshot->'endereco', endereco_entrega_snapshot)
        WHERE id = v_romaneio_id;
    ELSE
        INSERT INTO romaneios (
            lot_id, client_id, numero_romaneio, status_pagamento,
            quantidade_itens, valor_produtos, taxa_separacao, custo_motoboy,
            custo_digitacao, custo_operacional,
            valor_total, subtotal, total, total_itens,
            cliente_nome_snapshot, cliente_telefone_snapshot, endereco_entrega_snapshot
        )
        VALUES (
            p_lot_id, v_client_id, generate_romaneio_number(), 'aguardando_pagamento',
            v_total_itens, v_valor_produtos, v_taxa_separacao, v_custo_motoboy,
            v_custo_digitacao, v_custo_operacional,
            v_valor_total, v_valor_produtos, v_valor_total, v_total_itens,
            p_client_snapshot->>'nome', p_client_snapshot->>'telefone', p_client_snapshot->'endereco'
        )
        RETURNING id INTO v_romaneio_id;
        v_log_status := 'aguardando_pagamento';
    END IF;

    -- 5. Inserir itens
    INSERT INTO romaneio_items (romaneio_id, product_id, quantidade, preco_unitario, variacao)
    SELECT
        v_romaneio_id,
        (item->>'product_id')::UUID,
        SUM((item->>'quantity')::INT)::INT,
        MAX((item->>'valor_unitario')::NUMERIC),
        NULLIF(TRIM(COALESCE(item->>'variacao', '')), '')
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY (item->>'product_id')::UUID, TRIM(COALESCE(item->>'variacao', ''));

    -- 6. Log de auditoria
    INSERT INTO romaneio_status_log (romaneio_id, status_novo, alterado_por, observacao)
    VALUES (
        v_romaneio_id,
        v_log_status,
        v_client_id,
        CASE WHEN v_existing_id IS NULL THEN 'Romaneio criado via Checkout' ELSE 'Romaneio atualizado via Checkout' END
    );

    RETURN jsonb_build_object(
        'id', v_romaneio_id,
        'numero_romaneio', (SELECT numero_romaneio FROM romaneios WHERE id = v_romaneio_id),
        'total', v_valor_total
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.checkout_romaneio IS
'Checkout por lote. Migration 084: passa a gravar taxa_separacao (por faixa de valor), custo_motoboy, custo_digitacao e custo_operacional do lote, e um valor_total completo — antes gravava só valor_produtos.';

-- -----------------------------------------------------
-- 3. recalculate_romaneio_values usando a faixa
-- -----------------------------------------------------
-- Mantém o corpo da migration 057, trocando apenas a origem da taxa de
-- separação (antes: valor fixo lots.custo_separacao).
CREATE OR REPLACE FUNCTION public.recalculate_romaneio_values(p_romaneio_id UUID)
RETURNS VOID AS $$
DECLARE
    v_romaneio RECORD;
    v_lot RECORD;
    v_valor_produtos NUMERIC := 0;
    v_taxa_separacao NUMERIC := 0;
    v_custo_operacional NUMERIC := 0;
    v_custo_motoboy NUMERIC := 0;
    v_custo_digitacao NUMERIC := 0;
    v_valor_frete NUMERIC := 0;
    v_valor_total NUMERIC := 0;
    v_cep_destino TEXT;
    v_total_itens INT := 0;
BEGIN
    SELECT * INTO v_romaneio FROM romaneios WHERE id = p_romaneio_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Romaneio não encontrado';
    END IF;

    SELECT * INTO v_lot FROM lots WHERE id = v_romaneio.lot_id;

    SELECT
        COALESCE(SUM(ri.valor_total), 0),
        COALESCE(SUM(ri.quantidade), 0)
    INTO v_valor_produtos, v_total_itens
    FROM romaneio_items ri
    WHERE ri.romaneio_id = p_romaneio_id;

    -- Separação por faixa de valor (antes: COALESCE(v_lot.custo_separacao, 0))
    v_taxa_separacao := calc_taxa_separacao(v_valor_produtos);
    v_custo_motoboy := COALESCE(v_lot.custo_motoboy, 0);
    v_custo_digitacao := COALESCE(v_lot.custo_digitacao, 0);
    v_custo_operacional := COALESCE(v_lot.custo_operacional, 0) * v_total_itens;

    IF COALESCE(v_lot.calculo_frete_automatico, false) THEN
        SELECT
            COALESCE(
                (enderecos->0->>'cep')::TEXT,
                (enderecos->>0)::JSONB->>'cep'
            )
        INTO v_cep_destino
        FROM clients
        WHERE id = v_romaneio.client_id;

        IF v_cep_destino IS NOT NULL THEN
            BEGIN
                v_valor_frete := calculate_freight(p_romaneio_id, v_cep_destino, 'PAC');
            EXCEPTION WHEN OTHERS THEN
                 v_valor_frete := 15.00 + ((v_total_itens * 50) / 1000.0) * 5.00;
            END;
        END IF;
    ELSE
        v_valor_frete := COALESCE(v_romaneio.valor_frete, 0);
    END IF;

    v_valor_total := v_valor_produtos + v_taxa_separacao + v_custo_operacional +
                   v_custo_motoboy + v_custo_digitacao + v_valor_frete;

    UPDATE romaneios
    SET
        valor_produtos = v_valor_produtos,
        taxa_separacao = v_taxa_separacao,
        custo_operacional = v_custo_operacional,
        custo_motoboy = v_custo_motoboy,
        custo_digitacao = v_custo_digitacao,
        valor_frete = v_valor_frete,
        valor_total = v_valor_total,
        total = v_valor_total,
        subtotal = v_valor_produtos,
        quantidade_itens = v_total_itens,
        total_itens = v_total_itens,
        updated_at = NOW()
    WHERE id = p_romaneio_id;
END;
$$ LANGUAGE plpgsql;
