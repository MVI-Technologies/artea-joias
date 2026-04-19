-- Migration 070: Adicionar status pago_50_pct como estado de rascunho editável
-- em checkout_romaneio e clear_draft_romaneio.
-- Motivo: a migration 068 adicionou o status pago_50_pct para pagamentos parciais (50%),
-- mas as funções não foram atualizadas para reconhecê-lo como estado editável.
-- Sem isso, quando o admin marca um romaneio como pago_50_pct, o cliente perde
-- o acesso ao carrinho no frontend (o romaneio "some" do loadCart do Cart.jsx).

-- ================================================================
-- 1. Atualizar checkout_romaneio para reconhecer pago_50_pct
-- ================================================================
CREATE OR REPLACE FUNCTION checkout_romaneio(
    p_lot_id UUID,
    p_items JSONB,
    p_client_snapshot JSONB DEFAULT '{}'::jsonb,
    p_payment_method TEXT DEFAULT 'pix'
)
RETURNS JSONB AS $$
DECLARE
    v_client_id UUID;
    v_romaneio_id UUID;
    v_lot_status TEXT;
    v_total_itens INT := 0;
    v_valor_produtos NUMERIC(10,2) := 0;
    v_romaneio_number TEXT;
    v_existing_id UUID;
    v_status_pagamento TEXT;
    v_product_id UUID;
    v_requested_qty INT;
    v_limite INT;
    v_total_no_lote INT;
    v_current_romaneio_qty INT;
    v_available INT;
BEGIN
    SELECT id INTO v_client_id FROM clients WHERE auth_id = auth.uid();
    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Cliente não encontrado para o usuário logado.';
    END IF;

    SELECT status INTO v_lot_status FROM lots WHERE id = p_lot_id;
    IF v_lot_status IS NULL THEN RAISE EXCEPTION 'Lote não encontrado.'; END IF;
    IF v_lot_status != 'aberto' THEN
        RAISE EXCEPTION 'Este lote não está aberto para compras (Status: %).', v_lot_status;
    END IF;

    CREATE TEMPORARY TABLE temp_checkout_items AS
    SELECT
        (item->>'product_id')::UUID as product_id,
        TRIM(COALESCE(item->>'variacao', '')) as variacao,
        SUM((item->>'quantity')::INT)::INT as total_quantity,
        MAX((item->>'valor_unitario')::NUMERIC) as unit_price
    FROM jsonb_array_elements(p_items) as item
    GROUP BY (item->>'product_id')::UUID, TRIM(COALESCE(item->>'variacao', ''));

    SELECT COALESCE(SUM(total_quantity), 0), COALESCE(SUM(total_quantity * unit_price), 0)
    INTO v_total_itens, v_valor_produtos
    FROM temp_checkout_items;

    IF v_total_itens <= 0 THEN
        RAISE EXCEPTION 'O carrinho não pode estar vazio.';
    END IF;

    SELECT id, status_pagamento INTO v_existing_id, v_status_pagamento
    FROM romaneios
    WHERE lot_id = p_lot_id AND client_id = v_client_id;

    -- Validação de disponibilidade: não fazer DROP aqui ao dar RAISE
    FOR v_product_id, v_requested_qty IN
        SELECT t.product_id, t.total_quantity FROM temp_checkout_items t
    LOOP
        SELECT COALESCE(p.qtd_minima_fornecedor, 0) INTO v_limite
        FROM products p WHERE p.id = v_product_id;
        IF v_limite IS NULL OR v_limite <= 0 THEN
            CONTINUE;
        END IF;

        SELECT COALESCE(SUM(ri.quantidade), 0)::INT INTO v_total_no_lote
        FROM romaneio_items ri
        JOIN romaneios r ON r.id = ri.romaneio_id
        WHERE r.lot_id = p_lot_id
          AND ri.product_id = v_product_id
          AND r.status_pagamento NOT IN ('cancelado', 'rejeitado');

        v_current_romaneio_qty := 0;
        -- pago_50_pct incluído: romaneio parcialmente pago ainda é editável
        IF v_existing_id IS NOT NULL AND v_status_pagamento IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado', 'pago_50_pct', 'pago_50_pct_s_frete', 'parcialmente_pago') THEN
            SELECT COALESCE(SUM(ri.quantidade), 0)::INT INTO v_current_romaneio_qty
            FROM romaneio_items ri
            WHERE ri.romaneio_id = v_existing_id AND ri.product_id = v_product_id;
        END IF;

        v_available := v_limite - (v_total_no_lote - v_current_romaneio_qty);
        IF v_available < v_requested_qty THEN
            RAISE EXCEPTION 'Disponibilidade insuficiente no lote para o produto (disponível: %, solicitado: %)', v_available, v_requested_qty;
        END IF;
    END LOOP;

    IF v_existing_id IS NOT NULL THEN
        -- pago_50_pct incluído: permite atualizar romaneio parcialmente pago
        IF v_status_pagamento NOT IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado', 'pago_50_pct', 'pago_50_pct_s_frete', 'parcialmente_pago') THEN
            RAISE EXCEPTION 'Já existe um romaneio processado (Status: %) para este link.', v_status_pagamento;
        END IF;
        v_romaneio_id := v_existing_id;

        DELETE FROM romaneio_items WHERE romaneio_id = v_romaneio_id;

        UPDATE romaneios
        SET
            client_id = v_client_id,
            quantidade_itens = v_total_itens,
            valor_produtos = v_valor_produtos,
            valor_total = v_valor_produtos,
            subtotal = v_valor_produtos,
            total = v_valor_produtos,
            total_itens = v_total_itens,
            updated_at = NOW(),
            cliente_nome_snapshot = COALESCE(p_client_snapshot->>'nome', cliente_nome_snapshot),
            cliente_telefone_snapshot = COALESCE(p_client_snapshot->>'telefone', cliente_telefone_snapshot),
            endereco_entrega_snapshot = COALESCE(p_client_snapshot->'endereco', endereco_entrega_snapshot)
        WHERE id = v_romaneio_id;
    ELSE
        INSERT INTO romaneios (
            lot_id, client_id, numero_romaneio, status_pagamento,
            quantidade_itens, valor_produtos, valor_total, subtotal, total, total_itens,
            cliente_nome_snapshot, cliente_telefone_snapshot, endereco_entrega_snapshot
        )
        SELECT
            p_lot_id, v_client_id, generate_romaneio_number(), 'aguardando_pagamento',
            v_total_itens, v_valor_produtos, v_valor_produtos, v_valor_produtos, v_valor_produtos, v_total_itens,
            p_client_snapshot->>'nome', p_client_snapshot->>'telefone', p_client_snapshot->'endereco'
        RETURNING id INTO v_romaneio_id;
    END IF;

    INSERT INTO romaneio_items (romaneio_id, product_id, quantidade, preco_unitario, variacao)
    SELECT v_romaneio_id, product_id, total_quantity, unit_price, NULLIF(TRIM(variacao), '')
    FROM temp_checkout_items;

    DROP TABLE temp_checkout_items;

    INSERT INTO romaneio_status_log (romaneio_id, status_novo, alterado_por, observacao)
    VALUES (
        v_romaneio_id,
        v_status_pagamento,
        v_client_id,
        CASE WHEN v_existing_id IS NULL THEN 'Romaneio criado via Checkout' ELSE 'Romaneio atualizado via Checkout' END
    );

    RETURN jsonb_build_object(
        'id', v_romaneio_id,
        'numero_romaneio', (SELECT numero_romaneio FROM romaneios WHERE id = v_romaneio_id),
        'total', v_valor_produtos
    );
EXCEPTION
    WHEN OTHERS THEN
        DROP TABLE IF EXISTS temp_checkout_items;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION checkout_romaneio IS 'Checkout por lote. Reconhece pago_50_pct como estado editável (migration 070). Temp table é sempre removida no bloco EXCEPTION ao ocorrer erro.';

-- ================================================================
-- 2. Atualizar clear_draft_romaneio para reconhecer pago_50_pct
-- ================================================================
CREATE OR REPLACE FUNCTION clear_draft_romaneio(p_lot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_client_id UUID;
    v_lot_status TEXT;
BEGIN
    SELECT id INTO v_client_id FROM clients WHERE auth_id = auth.uid();
    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Cliente não encontrado para o usuário logado.';
    END IF;

    SELECT status INTO v_lot_status FROM lots WHERE id = p_lot_id;
    IF v_lot_status IS NULL THEN
        RAISE EXCEPTION 'Lote não encontrado.';
    END IF;
    IF v_lot_status != 'aberto' THEN
        RAISE EXCEPTION 'Só é possível limpar o rascunho enquanto o link está aberto.';
    END IF;

    -- 1) Deletar itens primeiro para o trigger update_lot_products_stats conseguir
    --    ler romaneios.lot_id e atualizar lot_products
    --    pago_50_pct incluído: romaneio parcialmente pago também pode ter itens limpos
    DELETE FROM romaneio_items
    WHERE romaneio_id IN (
        SELECT id FROM romaneios
        WHERE lot_id = p_lot_id
          AND client_id = v_client_id
          AND status_pagamento IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado', 'pago_50_pct', 'pago_50_pct_s_frete', 'parcialmente_pago')
    );

    -- 2) Depois remover o(s) romaneio(s) draft
    DELETE FROM romaneios
    WHERE lot_id = p_lot_id
      AND client_id = v_client_id
      AND status_pagamento IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado', 'pago_50_pct', 'pago_50_pct_s_frete', 'parcialmente_pago');
END;
$$;

COMMENT ON FUNCTION clear_draft_romaneio IS 'Remove romaneio draft do cliente. Inclui pago_50_pct como estado editável (migration 070). Itens são deletados antes do romaneio para o trigger atualizar lot_products.';
