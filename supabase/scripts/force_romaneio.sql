-- INSERT SIMPLES (FORÇADO - VERSÃO CORRIGIDA)
-- Adicionado campo 'dados' que é obrigatório no seu schema atual
DO $$
DECLARE
    v_lot_id UUID;
    v_client_id UUID;
BEGIN
    -- Busca qualqer lote e cliente
    SELECT id INTO v_lot_id FROM lots LIMIT 1;
    SELECT id INTO v_client_id FROM clients LIMIT 1;

    INSERT INTO romaneios (
        id,
        lot_id,
        client_id,
        numero_romaneio,
        total_itens,
        subtotal,
        total,
        status,
        created_at,
        dados, -- Campo obrigatório detectado
        cliente_nome_snapshot
    ) VALUES (
        uuid_generate_v4(),
        v_lot_id,
        v_client_id,
        'ROM-FORCADO-' || floor(random() * 1000)::text,
        5,
        100.00,
        100.00,
        'gerado',
        NOW(),
        '{"origem": "insert_forcado"}'::jsonb, -- Valor dummy para passar a constraint
        'Cliente Forçado'
    );
    
    RAISE NOTICE 'SUCESSO: Romaneio inserido na marra. ID: %', v_lot_id;
END $$;

SELECT * FROM romaneios WHERE numero_romaneio LIKE 'ROM-FORCADO%';
