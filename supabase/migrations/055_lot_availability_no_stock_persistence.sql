-- Migration 055: Disponibilidade por lote — sem persistência de estoque
-- Para produtos vinculados a um lote ativo:
-- - Validação no checkout usa disponibilidade calculada (limite_maximo_lote - unidades confirmadas).
-- - Nenhuma escrita em products.estoque; lógica centralizada no cálculo dinâmico.

-- 1. checkout_romaneio: validar por disponibilidade no lote; não alterar product.estoque
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
    v_item JSONB;
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

    -- Agregar itens do carrinho
    CREATE TEMPORARY TABLE temp_checkout_items AS
    SELECT 
        (item->>'product_id')::UUID as product_id,
        SUM((item->>'quantity')::INT)::INT as total_quantity,
        MAX((item->>'valor_unitario')::NUMERIC) as unit_price
    FROM jsonb_array_elements(p_items) as item
    GROUP BY (item->>'product_id')::UUID;

    SELECT COALESCE(SUM(total_quantity), 0), COALESCE(SUM(total_quantity * unit_price), 0)
    INTO v_total_itens, v_valor_produtos
    FROM temp_checkout_items;

    IF v_total_itens <= 0 THEN
        DROP TABLE temp_checkout_items;
        RAISE EXCEPTION 'O carrinho não pode estar vazio.';
    END IF;

    -- Romaneio existente (para validação e para upsert)
    SELECT id, status_pagamento INTO v_existing_id, v_status_pagamento
    FROM romaneios
    WHERE lot_id = p_lot_id AND client_id = v_client_id;

    -- Validação por disponibilidade no lote (sem usar product.estoque)
    -- disponibilidade = limite_maximo_lote - soma(unidades confirmadas no lote)
    -- limite_maximo_lote = products.qtd_minima_fornecedor (neste contexto = teto do lote)
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
        IF v_existing_id IS NOT NULL AND v_status_pagamento IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado') THEN
            SELECT COALESCE(SUM(ri.quantidade), 0)::INT INTO v_current_romaneio_qty
            FROM romaneio_items ri
            WHERE ri.romaneio_id = v_existing_id AND ri.product_id = v_product_id;
        END IF;

        v_available := v_limite - (v_total_no_lote - v_current_romaneio_qty);
        IF v_available < v_requested_qty THEN
            DROP TABLE temp_checkout_items;
            RAISE EXCEPTION 'Disponibilidade insuficiente no lote para o produto (disponível: %, solicitado: %)', v_available, v_requested_qty;
        END IF;
    END LOOP;

    IF v_existing_id IS NOT NULL THEN
        IF v_status_pagamento NOT IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado') THEN
            DROP TABLE temp_checkout_items;
            RAISE EXCEPTION 'Já existe um romaneio processado (Status: %) para este link.', v_status_pagamento;
        END IF;
        v_romaneio_id := v_existing_id;

        -- Não devolver/alterar product.estoque — produtos no lote usam disponibilidade dinâmica
        DELETE FROM romaneio_items WHERE romaneio_id = v_romaneio_id;

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

    INSERT INTO romaneio_items (romaneio_id, product_id, quantidade, preco_unitario)
    SELECT v_romaneio_id, product_id, total_quantity, unit_price
    FROM temp_checkout_items;

    -- Não decrementar product.estoque — disponibilidade no lote é apenas calculada
    DROP TABLE temp_checkout_items;

    INSERT INTO romaneio_status_log (romaneio_id, status_novo, alterado_por, observacao)
    VALUES (
        v_romaneio_id,
        'aguardando_pagamento',
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

-- 2. update_romaneio_status: não alterar product.estoque (romaneios são sempre por lote)
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

    -- Romaneios são sempre por lote; não persistir alterações em product.estoque
    v_msg := CASE
        WHEN p_observacao IS NOT NULL THEN p_observacao
        ELSE 'Status alterado manualmente para ' || p_novo_status
    END;
    
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
    
    INSERT INTO romaneio_status_log (
        romaneio_id, status_anterior, status_novo, alterado_por, observacao
    ) VALUES (
        p_romaneio_id, v_status_anterior, p_novo_status, p_admin_id, v_msg
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION checkout_romaneio IS 'Checkout por lote: valida disponibilidade no lote (limite - confirmados); não altera product.estoque';
COMMENT ON FUNCTION update_romaneio_status IS 'Altera status do romaneio; não altera product.estoque (disponibilidade por lote é dinâmica)';
