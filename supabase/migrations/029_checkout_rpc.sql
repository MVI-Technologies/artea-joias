-- =====================================================
-- MIGRATION 029: RELIABLE CHECKOUT RPC
-- Transactional creation of Romaneios and Orders
-- =====================================================

-- Function to handle atomic checkout
CREATE OR REPLACE FUNCTION checkout_romaneio(
    p_lot_id UUID,
    p_items JSONB, -- Array of {product_id, quantity, valor_unitario}
    p_client_snapshot JSONB DEFAULT '{}'::jsonb, -- {nome, telefone, endereco}
    p_payment_method TEXT DEFAULT 'pix'
)
RETURNS JSONB AS $$
DECLARE
    v_client_id UUID;
    v_romaneio_id UUID;
    v_lot_status TEXT;
    v_total_itens INT := 0;
    v_valor_produtos NUMERIC(10,2) := 0;
    v_item JSONB;
    v_order_status TEXT := 'aguardando_pagamento';
    v_romaneio_number TEXT;
    v_existing_id UUID;
    v_status_pagamento TEXT;
BEGIN
    -- 1. Identify Client
    -- Uses auth.uid() to guarantee security
    SELECT id INTO v_client_id
    FROM clients
    WHERE auth_id = auth.uid();

    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Cliente não encontrado para o usuário logado.';
    END IF;

    -- 2. Validate Lot
    SELECT status INTO v_lot_status
    FROM lots
    WHERE id = p_lot_id;

    IF v_lot_status IS NULL THEN
        RAISE EXCEPTION 'Lote não encontrado.';
    END IF;

    IF v_lot_status != 'aberto' THEN
        RAISE EXCEPTION 'Este lote não está aberto para compras (Status: %).', v_lot_status;
    END IF;

    -- 3. Calculate Totals from Items (Backend Validation)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_total_itens := v_total_itens + (v_item->>'quantity')::INT;
        v_valor_produtos := v_valor_produtos + ((v_item->>'quantity')::INT * (v_item->>'valor_unitario')::NUMERIC);
    END LOOP;

    IF v_total_itens <= 0 THEN
        RAISE EXCEPTION 'O carrinho não pode estar vazio.';
    END IF;

    -- 4. Check for Existing Romaneio (Idempotency / Update)
    SELECT id, status_pagamento INTO v_existing_id, v_status_pagamento
    FROM romaneios
    WHERE lot_id = p_lot_id AND client_id = v_client_id;

    -- 5. Upsert Romaneio
    IF v_existing_id IS NOT NULL THEN
        -- If already paid, block changes? 
        -- Assuming 'aguardando_pagamento' or similar allow updates.
        IF v_status_pagamento NOT IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado') THEN
             RAISE EXCEPTION 'Já existe um romaneio processado (Status: %) para este link. Entre em contato com o admin.', v_status_pagamento;
        END IF;

        v_romaneio_id := v_existing_id;

        UPDATE romaneios
        SET 
            quantidade_itens = v_total_itens,
            valor_produtos = v_valor_produtos,
            valor_total = v_valor_produtos, -- Frete/Taxas logic can be added here or via triggers
            subtotal = v_valor_produtos,
            total = v_valor_produtos,
            total_itens = v_total_itens,
            updated_at = NOW(),
            -- Update snapshots if provided
            cliente_nome_snapshot = COALESCE(p_client_snapshot->>'nome', cliente_nome_snapshot),
            cliente_telefone_snapshot = COALESCE(p_client_snapshot->>'telefone', cliente_telefone_snapshot),
            endereco_entrega_snapshot = COALESCE(p_client_snapshot->'endereco', endereco_entrega_snapshot)
        WHERE id = v_romaneio_id;

        -- Clear old items to replace with new cart state (Full Sync)
        DELETE FROM orders WHERE romaneio_id = v_romaneio_id;
    ELSE
        -- Generate Number
        v_romaneio_number := 'ROM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 4);

        INSERT INTO romaneios (
            lot_id,
            client_id,
            numero_romaneio,
            numero_pedido,
            status_pagamento,
            quantidade_itens,
            valor_produtos,
            valor_total,
            subtotal,
            total,
            total_itens,
            cliente_nome_snapshot,
            cliente_telefone_snapshot,
            endereco_entrega_snapshot,
            dados_pagamento, -- Required by legacy (nullable now, but good to be explicit)
            is_admin_purchase
        ) VALUES (
            p_lot_id,
            v_client_id,
            v_romaneio_number,
            'PED-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'),
            'aguardando_pagamento',
            v_total_itens,
            v_valor_produtos,
            v_valor_produtos,
            v_valor_produtos,
            v_valor_produtos,
            v_total_itens,
            p_client_snapshot->>'nome',
            p_client_snapshot->>'telefone',
            p_client_snapshot->'endereco',
            '{}'::jsonb,
            false
        )
        RETURNING id INTO v_romaneio_id;
    END IF;

    -- 6. Insert Items
    INSERT INTO orders (
        romaneio_id,
        lot_id,
        client_id,
        product_id,
        quantidade,
        valor_unitario,
        valor_total,
        status
    )
    SELECT 
        v_romaneio_id,
        p_lot_id,
        v_client_id,
        (item->>'product_id')::UUID,
        (item->>'quantity')::INT,
        (item->>'valor_unitario')::NUMERIC,
        ((item->>'quantity')::INT * (item->>'valor_unitario')::NUMERIC),
        v_order_status
    FROM jsonb_array_elements(p_items) AS item;

    -- 7. Audit Log (Creation/Update)
    INSERT INTO romaneio_status_log (
        romaneio_id,
        status_novo,
        alterado_por,
        observacao
    ) VALUES (
        v_romaneio_id,
        'aguardando_pagamento',
        v_client_id,
        CASE WHEN v_existing_id IS NULL THEN 'Romaneio criado via Checkout' ELSE 'Romaneio atualizado via Checkout' END
    );

    -- Return Result
    RETURN jsonb_build_object(
        'id', v_romaneio_id,
        'numero_romaneio', v_romaneio_number,
        'total', v_valor_produtos
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification
SELECT 'Migration 029 applied: checkout_romaneio RPC created' as status;
