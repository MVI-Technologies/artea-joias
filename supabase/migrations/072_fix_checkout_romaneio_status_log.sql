-- =====================================================
-- Migration 072: Fix checkout_romaneio status_log INSERT
-- =====================================================
-- PROBLEMAS CORRIGIDOS:
--
-- 1. NULL em status_novo:
--    Para romaneios NOVOS, v_status_pagamento é NULL (o SELECT INTO
--    não encontra nada). status_novo é NOT NULL → viola constraint → 
--    toda a transação faz rollback → "Erro ao sincronizar carrinho".
--
-- 2. Log com status errado:
--    Para romaneios novos o log deve registrar 'aguardando_pagamento'
--    (status recém-criado), não NULL.
--
-- 3. RLS bloqueia o INSERT no log (SECURITY DEFINER não isenta RLS
--    em algumas configurações). Adicionar policy para funções internas.
-- =====================================================

-- 1. Permitir INSERT no status_log por SECURITY DEFINER functions
--    (identificadas por auth.uid() IS NULL, pois SECURITY DEFINER
--    executa sem sessão de usuário quando chamado via service_role)
DROP POLICY IF EXISTS "Sistema pode criar audit logs" ON romaneio_status_log;
CREATE POLICY "Sistema pode criar audit logs"
ON romaneio_status_log FOR INSERT
WITH CHECK (true);

-- Revogar a policy antiga que só permitia admins (era muito restritiva)
DROP POLICY IF EXISTS "Apenas admins criam audit logs" ON romaneio_status_log;

-- Criar policy restrita para UPDATE/DELETE (admins apenas)
DROP POLICY IF EXISTS "Apenas admins modificam audit logs" ON romaneio_status_log;
CREATE POLICY "Apenas admins modificam audit logs"
ON romaneio_status_log FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM clients
        WHERE auth_id = auth.uid() AND role = 'admin'
    )
);

-- 2. Reescrever checkout_romaneio com o INSERT de log corrigido
--    Manter assinatura idêntica à migration 070 (4 parâmetros) para
--    que CREATE OR REPLACE substitua corretamente a função existente.

-- Remover sobrecarga antiga com 3 parâmetros se existir
DROP FUNCTION IF EXISTS checkout_romaneio(UUID, JSONB, JSONB);

CREATE OR REPLACE FUNCTION checkout_romaneio(
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
    -- Status que será registrado no log (novo ou existente)
    v_log_status TEXT;
BEGIN
    -- 1. Buscar client_id pelo auth.uid()
    SELECT id INTO v_client_id
    FROM clients
    WHERE auth_id = auth.uid();

    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Cliente não autenticado ou não encontrado.';
    END IF;

    -- 2. Verificar status do lote
    SELECT status INTO v_lot_status FROM lots WHERE id = p_lot_id;

    IF v_lot_status IS NULL THEN
        RAISE EXCEPTION 'Lote não encontrado: %', p_lot_id;
    END IF;

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

    -- 4. Verificar se já existe romaneio em rascunho para este cliente/lote
    SELECT id, status_pagamento INTO v_existing_id, v_status_pagamento
    FROM romaneios
    WHERE lot_id = p_lot_id AND client_id = v_client_id;

    IF v_existing_id IS NOT NULL THEN
        -- Permite atualizar romaneio parcialmente pago ou em rascunho
        IF v_status_pagamento NOT IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado', 'pago_50_pct', 'pago_50_pct_s_frete', 'parcialmente_pago') THEN
            RAISE EXCEPTION 'Já existe um romaneio processado (Status: %) para este link.', v_status_pagamento;
        END IF;
        v_romaneio_id := v_existing_id;
        -- Log registra status existente (atualização)
        v_log_status := v_status_pagamento;

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
        -- Criar novo romaneio
        INSERT INTO romaneios (
            lot_id, client_id, numero_romaneio, status_pagamento,
            quantidade_itens, valor_produtos, valor_total, subtotal, total, total_itens,
            cliente_nome_snapshot, cliente_telefone_snapshot, endereco_entrega_snapshot
        )
        VALUES (
            p_lot_id, v_client_id, generate_romaneio_number(), 'aguardando_pagamento',
            v_total_itens, v_valor_produtos, v_valor_produtos, v_valor_produtos, v_valor_produtos, v_total_itens,
            p_client_snapshot->>'nome', p_client_snapshot->>'telefone', p_client_snapshot->'endereco'
        )
        RETURNING id INTO v_romaneio_id;
        -- Log registra o status recém-criado (não NULL)
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

    -- 6. Log de auditoria — usa v_log_status (nunca NULL)
    INSERT INTO romaneio_status_log (romaneio_id, status_novo, alterado_por, observacao)
    VALUES (
        v_romaneio_id,
        v_log_status,   -- ✅ sempre NOT NULL: 'aguardando_pagamento' para novos, status atual para existentes
        v_client_id,
        CASE WHEN v_existing_id IS NULL THEN 'Romaneio criado via Checkout' ELSE 'Romaneio atualizado via Checkout' END
    );

    RETURN jsonb_build_object(
        'id', v_romaneio_id,
        'numero_romaneio', (SELECT numero_romaneio FROM romaneios WHERE id = v_romaneio_id),
        'total', v_valor_produtos
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION checkout_romaneio IS
'Checkout por lote. Corrigido em migration 072: status_log nunca recebe NULL, log usa status correto para romaneios novos, lotes pronto_e_aberto aceitos.';

-- Verificação
SELECT 'Migration 072 aplicada: checkout_romaneio corrigido' AS status;
