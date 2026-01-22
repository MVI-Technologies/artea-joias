-- DIAGNÓSTICO PROFUNDO DE LOGICA DE ROMANEIO
-- Objetivos:
-- 1. Verificar se a query do trigger retorna dados manualmente.
-- 2. Verificar o estado do Lote.
-- 3. Tentar inserir manualmente para ver erro real.

DO $$
DECLARE
    v_lot_id UUID;
    v_rows_count INT;
BEGIN
    SELECT id INTO v_lot_id FROM lots WHERE nome = 'Link Teste 001';
    RAISE NOTICE 'Analisando Lote ID: %', v_lot_id;
    
    IF v_lot_id IS NULL THEN
        RAISE EXCEPTION 'Lote não encontrado!';
    END IF;

    -- 1. Simular a Query exata do Trigger
    SELECT COUNT(*) INTO v_rows_count
    FROM orders o
    JOIN clients c ON o.client_id = c.id
    WHERE o.lot_id = v_lot_id 
      AND o.status != 'cancelado';
      
    RAISE NOTICE 'Linhas encontradas pela query do trigger (Orders+Clients): %', v_rows_count;
    
    IF v_rows_count = 0 THEN
        RAISE NOTICE 'PROBLEMA IDENTIFICADO: A query não retorna nada. Vamos checar orders sozinhas.';
        SELECT COUNT(*) INTO v_rows_count FROM orders WHERE lot_id = v_lot_id;
        RAISE NOTICE 'Total Orders (sem join client): %', v_rows_count;
        
        IF v_rows_count > 0 THEN
             RAISE NOTICE 'Conclusão: Os pedidos existem mas não têm Join com Clients. Verifique client_id em orders.';
        ELSE
             RAISE NOTICE 'Conclusão: Não existem pedidos para este lote.';
        END IF;
        RETURN; -- Para aqui
    END IF;

    -- 2. Se a query retorna dados, tentar INSERIR manualmente (Bypass Trigger)
    RAISE NOTICE 'Tentando inserir manualmente na tabela romaneios...';
    
    BEGIN
        INSERT INTO romaneios (
            lot_id, client_id, numero_romaneio, total_itens, subtotal, total,
            cliente_nome_snapshot, cliente_telefone_snapshot, endereco_entrega_snapshot
        )
        SELECT 
            v_lot_id,
            o.client_id,
            'TEST-MANUAL-' || floor(random()*1000)::text,
            SUM(o.quantidade),
            SUM(o.valor_total),
            SUM(o.valor_total),
            c.nome,
            c.telefone,
            c.enderecos->0
        FROM orders o
        JOIN clients c ON o.client_id = c.id
        WHERE o.lot_id = v_lot_id AND o.status != 'cancelado'
        GROUP BY o.client_id, c.nome, c.telefone, c.enderecos
        ON CONFLICT (lot_id, client_id) DO NOTHING;
        
        RAISE NOTICE 'Sucesso no INSERT manual. Dados deveriam aparecer agora.';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ERRO NO INSERT MANUAL: %', SQLERRM;
        RAISE NOTICE 'Detalhe: %', SQLSTATE;
    END;

END $$;

-- Checagem final
SELECT * FROM romaneios;
