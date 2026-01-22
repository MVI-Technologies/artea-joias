-- SCRIPT DE RESET E TESTE FINAL (CLEAN SLATE)
-- Versão Corrigida: Removido fechamento_automatico (coluna inexistente no ambiente atual)
DO $$
DECLARE
    v_lot_id UUID;
    v_client_id UUID;
    v_prod_id UUID;
    v_romaneio_count INT;
BEGIN
    RAISE NOTICE 'Iniciando Reset Controlado...';

    -- 1. Limpar e Recriar Lote Teste
    -- Tenta deletar dependências primeiro
    BEGIN
        DELETE FROM romaneios WHERE lot_id IN (SELECT id FROM lots WHERE nome = 'Link Teste 001');
        DELETE FROM orders WHERE lot_id IN (SELECT id FROM lots WHERE nome = 'Link Teste 001');
        DELETE FROM lots WHERE nome = 'Link Teste 001';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao limpar dados antigos (ignorando): %', SQLERRM;
    END;
    
    -- Inserir novo lote (Sem fechamento_automatico para compatibilidade)
    INSERT INTO lots (nome, descricao, status, link_compra)
    VALUES ('Link Teste 001', 'Teste Clean Slate', 'aberto', 'teste-clean')
    RETURNING id INTO v_lot_id;

    -- 2. Garantir Cliente de Teste
    SELECT id INTO v_client_id FROM clients WHERE telefone = '99999999999';
    IF v_client_id IS NULL THEN
        -- Tenta criar, se falhar auth_id unique, usa existente
        BEGIN
             INSERT INTO clients (nome, telefone, role, auth_id)
             VALUES ('Cliente Teste Clean', '99999999999', 'cliente', auth.uid()) 
             RETURNING id INTO v_client_id;
        EXCEPTION WHEN OTHERS THEN
             -- Se falhar unique constraint, pega qualquer um
             SELECT id INTO v_client_id FROM clients LIMIT 1;
        END;
    END IF;

    -- 3. Garantir Produto
    SELECT id INTO v_prod_id FROM products LIMIT 1;
    IF v_prod_id IS NULL THEN
        RAISE EXCEPTION 'Cadastre pelo menos um produto no sistema antes de testar.';
    END IF;

    -- 4. Criar Pedido Perfeito
    INSERT INTO orders (
        lot_id, client_id, product_id, quantidade, valor_unitario, valor_total, status
    ) VALUES (
        v_lot_id, v_client_id, v_prod_id, 10, 50.00, 500.00, 'pendente'
    );
    
    RAISE NOTICE 'Pedido criado. ID Lote: %', v_lot_id;

    -- 5. FECHAR LOTE (Disparar Trigger)
    UPDATE lots SET status = 'fechado', updated_at = NOW() WHERE id = v_lot_id;
    
    -- 6. Verificar Resultado
    SELECT COUNT(*) INTO v_romaneio_count FROM romaneios WHERE lot_id = v_lot_id;
    
    IF v_romaneio_count > 0 THEN
        RAISE NOTICE 'SUCESSO TOTAL! % romaneio(s) gerado(s).', v_romaneio_count;
        -- Tenta notificar se tabela existir
        BEGIN
            INSERT INTO notifications (type, message, reference_id) 
            VALUES ('system', 'Teste Clean Slate SUCESSO: Romaneio Gerado', v_lot_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Tabela notifications não existe, mas romaneio foi gerado.';
        END;
    ELSE
        RAISE NOTICE 'FALHA: Trigger rodou mas não gerou linhas. A combinação lot/order/client falhou no join do trigger.';
    END IF;

END $$;

-- Mostrar o resultado final
SELECT * FROM romaneios WHERE numero_romaneio LIKE 'ROM-%' OR lot_id IN (SELECT id FROM lots WHERE nome = 'Link Teste 001');
