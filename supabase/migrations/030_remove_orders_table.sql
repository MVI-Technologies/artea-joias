-- =====================================================
-- MIGRATION 030: REMOVE ORDERS TABLE
-- Architectural refactor: Orders are Romaneios
-- =====================================================

-- 1. Create romaneio_items table
CREATE TABLE IF NOT EXISTS romaneio_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    romaneio_id UUID NOT NULL REFERENCES romaneios(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    preco_unitario NUMERIC(10,2) NOT NULL CHECK (preco_unitario >= 0),
    valor_total NUMERIC(10,2) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_romaneio_items_romaneio ON romaneio_items(romaneio_id);
CREATE INDEX idx_romaneio_items_product ON romaneio_items(product_id);

COMMENT ON TABLE romaneio_items IS 'Line items for each romaneio (replaces orders table)';

-- 2. Migrate existing orders → romaneio_items
INSERT INTO romaneio_items (romaneio_id, product_id, quantidade, preco_unitario, created_at)
SELECT 
    romaneio_id,
    product_id,
    quantidade,
    valor_unitario,
    created_at
FROM orders
WHERE romaneio_id IS NOT NULL;

-- 3. Update checkout_romaneio RPC to use romaneio_items
DROP FUNCTION IF EXISTS checkout_romaneio(UUID, JSONB, JSONB, TEXT);

CREATE OR REPLACE FUNCTION checkout_romaneio(
    p_lot_id UUID,
    p_items JSONB, -- Array of {product_id, quantity, valor_unitario}
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
    v_item JSONB;
    v_romaneio_number TEXT;
    v_existing_id UUID;
    v_status_pagamento TEXT;
BEGIN
    -- 1. Identify Client
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

    -- 3. Calculate Totals
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_total_itens := v_total_itens + (v_item->>'quantity')::INT;
        v_valor_produtos := v_valor_produtos + ((v_item->>'quantity')::INT * (v_item->>'valor_unitario')::NUMERIC);
    END LOOP;

    IF v_total_itens <= 0 THEN
        RAISE EXCEPTION 'O carrinho não pode estar vazio.';
    END IF;

    -- 4. Check for Existing Romaneio
    SELECT id, status_pagamento INTO v_existing_id, v_status_pagamento
    FROM romaneios
    WHERE lot_id = p_lot_id AND client_id = v_client_id;

    -- 5. Upsert Romaneio
    IF v_existing_id IS NOT NULL THEN
        IF v_status_pagamento NOT IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado') THEN
             RAISE EXCEPTION 'Já existe um romaneio processado (Status: %) para este link.', v_status_pagamento;
        END IF;

        v_romaneio_id := v_existing_id;

        UPDATE romaneios
        SET 
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

        -- Clear old items
        DELETE FROM romaneio_items WHERE romaneio_id = v_romaneio_id;
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
            dados_pagamento,
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

    -- 6. Insert Items into romaneio_items (NEW STRUCTURE)
    INSERT INTO romaneio_items (
        romaneio_id,
        product_id,
        quantidade,
        preco_unitario
    )
    SELECT 
        v_romaneio_id,
        (item->>'product_id')::UUID,
        (item->>'quantity')::INT,
        (item->>'valor_unitario')::NUMERIC
    FROM jsonb_array_elements(p_items) AS item;

    -- 7. Audit Log
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

-- 4. Update update_romaneio_status to remove orders sync
DROP FUNCTION IF EXISTS update_romaneio_status(UUID, VARCHAR, UUID, TEXT);

CREATE OR REPLACE FUNCTION update_romaneio_status(
    p_romaneio_id UUID,
    p_novo_status VARCHAR(50),
    p_admin_id UUID,
    p_observacao TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_status_anterior VARCHAR(50);
    v_client_id UUID;
    v_msg TEXT;
BEGIN
    SELECT status_pagamento, client_id 
    INTO v_status_anterior, v_client_id
    FROM romaneios 
    WHERE id = p_romaneio_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Romaneio não encontrado: %', p_romaneio_id;
    END IF;

    v_msg := CASE
        WHEN p_observacao IS NOT NULL THEN p_observacao
        ELSE 'Status alterado manualmente para ' || p_novo_status
    END;
    
    -- Update romaneio
    UPDATE romaneios
    SET 
        status_pagamento = p_novo_status,
        data_pagamento = CASE 
            WHEN p_novo_status IN ('pago', 'admin_purchase') AND data_pagamento IS NULL THEN NOW() 
            ELSE data_pagamento 
        END,
        observacoes_admin = CASE
            WHEN p_observacao IS NOT NULL THEN 
                COALESCE(observacoes_admin || E'\n\n', '') || 
                '[' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI') || '] ' || p_observacao
            ELSE observacoes_admin
        END,
        is_admin_purchase = CASE
            WHEN p_novo_status = 'admin_purchase' THEN true
            ELSE is_admin_purchase
        END,
        updated_at = NOW()
    WHERE id = p_romaneio_id;
    
    -- Log Audit
    INSERT INTO romaneio_status_log (
        romaneio_id, 
        status_anterior, 
        status_novo, 
        alterado_por, 
        observacao
    ) VALUES (
        p_romaneio_id, 
        v_status_anterior, 
        p_novo_status, 
        p_admin_id, 
        v_msg
    );
    
    -- NO LONGER SYNC ORDERS (table removed)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Drop orders table
DROP TABLE IF EXISTS orders CASCADE;

-- Verification
SELECT 'Migration 030 applied: orders removed, romaneio_items created' as status;
