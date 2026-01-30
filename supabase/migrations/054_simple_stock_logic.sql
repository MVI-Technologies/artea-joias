-- Migration 054: Simple Stock Logic (Fixed)
-- Implements robust direct stock decrement on checkout and increment on cancellation/return.

-- 1. Update checkout_romaneio to handle stock decrement with AGGREGATION
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
    v_product_check RECORD;
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

    -- 3. Calculate Totals & Validate Stock (AGGREGATED CHECK)
    -- We aggregate the input items first to handle duplicates (e.g. same product added twice)
    CREATE TEMPORARY TABLE temp_checkout_items AS
    SELECT 
        (item->>'product_id')::UUID as product_id,
        SUM((item->>'quantity')::INT) as total_quantity,
        MAX((item->>'valor_unitario')::NUMERIC) as unit_price -- Assume price is consistent or take max
    FROM jsonb_array_elements(p_items) as item
    GROUP BY (item->>'product_id')::UUID;

    -- Calculate Totals
    SELECT 
        COALESCE(SUM(total_quantity), 0),
        COALESCE(SUM(total_quantity * unit_price), 0)
    INTO v_total_itens, v_valor_produtos
    FROM temp_checkout_items;

    IF v_total_itens <= 0 THEN
        DROP TABLE temp_checkout_items;
        RAISE EXCEPTION 'O carrinho não pode estar vazio.';
    END IF;

    -- Validate Stock Availability
    FOR v_product_check IN 
        SELECT p.estoque, p.nome, t.total_quantity
        FROM temp_checkout_items t
        JOIN products p ON p.id = t.product_id
    LOOP
        IF v_product_check.estoque < v_product_check.total_quantity THEN
             DROP TABLE temp_checkout_items;
             RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Disponível: %, Solicitado: %)', 
                v_product_check.nome, v_product_check.estoque, v_product_check.total_quantity;
        END IF;
    END LOOP;

    -- 4. Check for Existing Romaneio
    SELECT id, status_pagamento INTO v_existing_id, v_status_pagamento
    FROM romaneios
    WHERE lot_id = p_lot_id AND client_id = v_client_id;

    -- 5. Upsert Romaneio
    IF v_existing_id IS NOT NULL THEN
        IF v_status_pagamento NOT IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado') THEN
             DROP TABLE temp_checkout_items;
             RAISE EXCEPTION 'Já existe um romaneio processado (Status: %) para este link.', v_status_pagamento;
        END IF;

        v_romaneio_id := v_existing_id;

        -- STOCK RESTORE FOR OLD ITEMS:
        -- Before clearing old items, we must return their stock to the products table
        UPDATE products p
        SET estoque = p.estoque + agg.qtd
        FROM (
            SELECT product_id, SUM(quantidade) as qtd
            FROM romaneio_items
            WHERE romaneio_id = v_romaneio_id
            GROUP BY product_id
        ) agg
        WHERE p.id = agg.product_id;

        -- Update Romaneio Header
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

        -- Clear old items (will be replaced)
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

    -- 6. Insert Items into romaneio_items (Aggregated or Individual? Usually individual lines are better for detail, but we aggregated for stock check)
    -- We can insert the aggregated lines to keep it clean, or insert individual if we want to preserve input structure.
    -- Let's insert AGGREGATED lines to avoid primary key/unique constraint issues if any, and it's cleaner.
    INSERT INTO romaneio_items (
        romaneio_id,
        product_id,
        quantidade,
        preco_unitario
    )
    SELECT 
        v_romaneio_id,
        product_id,
        total_quantity,
        unit_price
    FROM temp_checkout_items;

    -- 7. STOCK DECREMENT: Decrease stock for new items
    UPDATE products p
    SET estoque = p.estoque - t.total_quantity
    FROM temp_checkout_items t
    WHERE p.id = t.product_id;

    -- Cleanup
    DROP TABLE temp_checkout_items;

    -- 8. Audit Log
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

    RETURN jsonb_build_object(
        'id', v_romaneio_id,
        'numero_romaneio', COALESCE(v_romaneio_number, (SELECT numero_romaneio FROM romaneios WHERE id = v_romaneio_id)),
        'total', v_valor_produtos
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update update_romaneio_status to handle cancellation restoration
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
    v_is_cancellation BOOLEAN;
    v_is_reactivation BOOLEAN;
BEGIN
    SELECT status_pagamento, client_id 
    INTO v_status_anterior, v_client_id
    FROM romaneios 
    WHERE id = p_romaneio_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Romaneio não encontrado: %', p_romaneio_id;
    END IF;

    -- Status groups
    -- Active (Stock Held): 'aguardando_pagamento', 'aguardando', 'pendente', 'pago', 'enviado', 'entregue', 'concluido', 'em_preparacao', 'admin_purchase'
    -- Inactive (Stock Released): 'cancelado', 'devolvido', 'rejeitado'

    -- Logic: 
    -- If moving Active -> Inactive: Return Stock
    -- If moving Inactive -> Active: Take Stock

    v_is_cancellation := (p_novo_status IN ('cancelado', 'devolvido', 'rejeitado')) 
                         AND (v_status_anterior NOT IN ('cancelado', 'devolvido', 'rejeitado'));
                         
    v_is_reactivation := (v_status_anterior IN ('cancelado', 'devolvido', 'rejeitado')) 
                         AND (p_novo_status NOT IN ('cancelado', 'devolvido', 'rejeitado'));

    -- Restoration (Cancellation)
    IF v_is_cancellation THEN
        UPDATE products p
        SET estoque = p.estoque + agg.qtd
        FROM (
            SELECT product_id, SUM(quantidade) as qtd
            FROM romaneio_items
            WHERE romaneio_id = p_romaneio_id
            GROUP BY product_id
        ) agg
        WHERE p.id = agg.product_id;
    END IF;

    -- Reactivation (Re-decrement)
    IF v_is_reactivation THEN
        -- Verify sufficient stock first
        IF EXISTS (
            SELECT 1 
            FROM romaneio_items ri
            JOIN products p ON p.id = ri.product_id
            WHERE ri.romaneio_id = p_romaneio_id AND p.estoque < ri.quantidade
        ) THEN
             RAISE EXCEPTION 'Não é possível reativar o pedido: Estoque insuficiente para alguns itens.';
        END IF;

        UPDATE products p
        SET estoque = p.estoque - agg.qtd
        FROM (
            SELECT product_id, SUM(quantidade) as qtd
            FROM romaneio_items
            WHERE romaneio_id = p_romaneio_id
            GROUP BY product_id
        ) agg
        WHERE p.id = agg.product_id;
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
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Verification
SELECT 'Stock logic updated: Direct decrement with aggregation' as status;
