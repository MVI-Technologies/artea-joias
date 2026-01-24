-- Script para verificar se o tracking de cliques está funcionando
-- Execute no Supabase Dashboard → SQL Editor

-- 1. Verificar se a tabela existe
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_clicks')
        THEN '✓ Tabela catalog_clicks existe'
        ELSE '✗ Tabela catalog_clicks NÃO existe - Execute a migration 034_catalog_clicks_tracking.sql'
    END as status_tabela;

-- 2. Verificar políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'catalog_clicks';

-- 3. Verificar se há cliques registrados
SELECT 
    COUNT(*) as total_cliques,
    COUNT(DISTINCT lot_id) as catalagos_unicos,
    COUNT(DISTINCT client_id) as clientes_unicos,
    MIN(created_at) as primeiro_clique,
    MAX(created_at) as ultimo_clique
FROM catalog_clicks;

-- 4. Ver últimos 10 cliques
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
LIMIT 10;

-- 5. Ver cliques por catálogo
SELECT 
    l.nome as catalogo,
    COUNT(*) as total_cliques,
    COUNT(DISTINCT cc.client_id) as clientes_unicos
FROM catalog_clicks cc
LEFT JOIN lots l ON cc.lot_id = l.id
GROUP BY l.id, l.nome
ORDER BY total_cliques DESC;
