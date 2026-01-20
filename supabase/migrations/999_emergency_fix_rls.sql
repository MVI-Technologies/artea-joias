-- =====================================================
-- CORREÇÃO EMERGENCIAL: Desabilitar RLS e permitir operações
-- =====================================================
-- Este script resolve os problemas de login e registro
-- Execute no Supabase Dashboard → SQL Editor

-- PASSO 1: Remover TODAS as políticas problemáticas
DROP POLICY IF EXISTS "Clientes podem ver seu próprio perfil" ON clients;
DROP POLICY IF EXISTS "Clientes podem editar seu próprio perfil" ON clients;
DROP POLICY IF EXISTS "Admins podem ver todos os clientes" ON clients;
DROP POLICY IF EXISTS "Admins podem editar todos os clientes" ON clients;
DROP POLICY IF EXISTS "Admins podem atualizar clientes" ON clients;
DROP POLICY IF EXISTS "Admins podem deletar clientes" ON clients;
DROP POLICY IF EXISTS "Permitir inserção de novos usuários" ON clients;
DROP POLICY IF EXISTS "clients_select_own" ON clients;
DROP POLICY IF EXISTS "clients_update_own" ON clients;
DROP POLICY IF EXISTS "clients_insert_own" ON clients;
DROP POLICY IF EXISTS "clients_select_admin" ON clients;
DROP POLICY IF EXISTS "clients_update_admin" ON clients;
DROP POLICY IF EXISTS "clients_delete_admin" ON clients;
DROP POLICY IF EXISTS "clients_insert_admin" ON clients;
DROP POLICY IF EXISTS "clients_insert_authenticated" ON clients;
DROP POLICY IF EXISTS "authenticated_can_read_own" ON clients;

-- PASSO 2: DESABILITAR RLS TEMPORARIAMENTE (para desenvolvimento)
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- ALTERNATIVA: Se quiser manter RLS ativo
-- =====================================================
-- Descomente as linhas abaixo se preferir ter alguma segurança básica:

/*
-- Reabilitar RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Políticas MUITO PERMISSIVAS (apenas para desenvolvimento)
CREATE POLICY "allow_all_authenticated"
    ON clients
    TO authenticated
    USING (true)
    WITH CHECK (true);
*/

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- Execute esta query para confirmar que RLS está desabilitado:
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'clients';

-- Deve mostrar: rls_enabled = false
