-- Script de diagnóstico completo para catalog_clicks
-- Execute no Supabase Dashboard → SQL Editor

-- 1. Verificar se a tabela existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_clicks') THEN
        RAISE NOTICE '✅ Tabela catalog_clicks existe';
    ELSE
        RAISE EXCEPTION '❌ Tabela catalog_clicks NÃO existe - Execute a migration 034_catalog_clicks_tracking.sql';
    END IF;
END $$;

-- 2. Verificar estrutura da tabela
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'catalog_clicks'
ORDER BY ordinal_position;

-- 3. Verificar políticas RLS
SELECT 
    policyname,
    cmd as operacao,
    roles,
    qual as condicao_using,
    with_check as condicao_check
FROM pg_policies 
WHERE tablename = 'catalog_clicks';

-- 4. Verificar se RLS está habilitado
SELECT 
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables 
WHERE tablename = 'catalog_clicks';

-- 5. Testar inserção manual (como admin)
-- Descomente para testar:
/*
INSERT INTO catalog_clicks (lot_id, client_id, session_id, user_agent)
SELECT 
    id as lot_id,
    NULL as client_id,
    'test_admin_' || NOW()::text as session_id,
    'Diagnostic Script' as user_agent
FROM lots
WHERE status = 'aberto'
LIMIT 1
RETURNING *;
*/

-- 6. Contar cliques existentes
SELECT 
    COUNT(*) as total_cliques,
    COUNT(DISTINCT lot_id) as catalagos_unicos,
    COUNT(DISTINCT client_id) as clientes_com_clique,
    COUNT(*) FILTER (WHERE client_id IS NULL) as cliques_anonimos,
    MIN(created_at) as primeiro_clique,
    MAX(created_at) as ultimo_clique
FROM catalog_clicks;

-- 7. Ver últimos 5 cliques
SELECT 
    cc.id,
    cc.lot_id,
    l.nome as catalogo_nome,
    c.nome as cliente_nome,
    cc.client_id,
    cc.session_id,
    cc.created_at
FROM catalog_clicks cc
LEFT JOIN lots l ON cc.lot_id = l.id
LEFT JOIN clients c ON cc.client_id = c.id
ORDER BY cc.created_at DESC
LIMIT 5;
