-- DIAGNÓSTICO DE ROMANEIOS
DO $$
DECLARE
    v_lot_id UUID;
    v_romaneio_count INT;
    v_order_count INT;
BEGIN
    SELECT id INTO v_lot_id FROM lots WHERE nome = 'Link Teste 001';
    
    RAISE NOTICE 'Lot ID: %', v_lot_id;
    
    -- Checar pedidos
    SELECT COUNT(*) INTO v_order_count FROM orders WHERE lot_id = v_lot_id;
    RAISE NOTICE 'Pedidos neste lote: %', v_order_count;
    
    -- Checar Romaneios
    SELECT COUNT(*) INTO v_romaneio_count FROM romaneios WHERE lot_id = v_lot_id;
    RAISE NOTICE 'Romaneios gerados: %', v_romaneio_count;
    
    IF v_romaneio_count = 0 THEN
        RAISE NOTICE 'ALERTA: Nenhum romaneio gerado! Trigger falhou ou não encontrou dados para agrupar.';
        -- Tentar simular o select do trigger para ver o que retorna
        -- Copie e rode isso fora do bloco DO para ver resultados reais se precisar
    ELSE
        RAISE NOTICE 'OK: Romaneios existem no banco. Se não aparecem na tela, verifique RLS (Policies).';
    END IF;
END $$;

-- Verificando Policies RLS da tabela romaneios
SELECT * FROM pg_policies WHERE tablename = 'romaneios';
