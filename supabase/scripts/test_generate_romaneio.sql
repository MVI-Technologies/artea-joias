-- Simular fechamento do lote para gerar romaneios
-- Versão Corrigida: Valor Total explícito
DO $$
DECLARE
    v_lot_id UUID;
    v_client_id UUID;
    v_prod_id UUID;
BEGIN
    -- 1. Buscar ou criar Link Teste 001
    SELECT id INTO v_lot_id FROM lots WHERE nome = 'Link Teste 001' LIMIT 1;
    
    IF v_lot_id IS NULL THEN
        -- Criar se não existir
        INSERT INTO lots (nome, descricao, status, link_compra)
        VALUES ('Link Teste 001', 'Lote para teste de romaneio', 'aberto', 'link-teste-001')
        RETURNING id INTO v_lot_id;
    ELSE
        -- Garantir que está aberto para o trigger funcionar
        UPDATE lots SET status = 'aberto' WHERE id = v_lot_id;
    END IF;

    -- 2. Garantir ter um cliente
    SELECT id INTO v_client_id FROM clients WHERE role = 'cliente' LIMIT 1;
    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Precisa ter pelo menos um cliente cadastrado no sistema';
    END IF;

    -- 3. Garantir ter um produto
    SELECT id INTO v_prod_id FROM products WHERE ativo = true LIMIT 1;
    IF v_prod_id IS NULL THEN
        RAISE EXCEPTION 'Precisa ter pelo menos um produto cadastrado no sistema';
    END IF;

    -- 4. Criar um pedido de teste se não houver
    IF NOT EXISTS (SELECT 1 FROM orders WHERE lot_id = v_lot_id) THEN
        INSERT INTO orders (
            lot_id, 
            client_id, 
            product_id, 
            quantidade, 
            valor_unitario, 
            valor_total, -- Campo obrigatório
            status
        )
        VALUES (
            v_lot_id, 
            v_client_id, 
            v_prod_id, 
            5, 
            99.90, 
            499.50, -- 5 * 99.90
            'pendente'
        );
    ELSE
        -- Se já existir pedido, garantir que tenha valor_total (caso tenha sido criado bugado)
        UPDATE orders 
        SET valor_total = quantidade * valor_unitario 
        WHERE lot_id = v_lot_id AND valor_total IS NULL;
    END IF;

    -- 5. FECHAR O LOTE (Dispara o Trigger de Romaneio)
    UPDATE lots 
    SET status = 'fechado', updated_at = NOW()
    WHERE id = v_lot_id;

    RAISE NOTICE 'SUCESSO: Lote Teste fechado e romaneios gerados. ID: %', v_lot_id;
END $$;
