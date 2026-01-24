-- Script para testar manualmente o registro de cliques
-- Execute no Supabase Dashboard → SQL Editor

-- 1. Verificar se a tabela existe e tem a estrutura correta
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'catalog_clicks'
ORDER BY ordinal_position;

-- 2. Inserir um clique de teste manualmente
INSERT INTO catalog_clicks (lot_id, client_id, session_id, user_agent)
SELECT 
    id as lot_id,
    NULL as client_id,
    'test_manual_' || NOW()::text as session_id,
    'Test Script' as user_agent
FROM lots
LIMIT 1
RETURNING *;

-- 3. Verificar se o clique foi inserido
SELECT 
    cc.*,
    l.nome as catalogo_nome
FROM catalog_clicks cc
LEFT JOIN lots l ON cc.lot_id = l.id
ORDER BY cc.created_at DESC
LIMIT 5;
