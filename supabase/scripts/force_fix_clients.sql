-- FIX TOTAL DE RLS para Clientes
-- Problema: RLS está ativo e bloqueando leitura, mesmo para admins.
-- Causa provavel: Recursão infinita na policy "Admin vê tudo".

ALTER TABLE clients DISABLE ROW LEVEL SECURITY; -- Desativar temporariamente para debug (Opcional, mas vamos corrigir as policies)

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- 1. Limpar policies problemáticas
DROP POLICY IF EXISTS "Ler proprio perfil" ON clients;
DROP POLICY IF EXISTS "Admins ver todos clientes" ON clients;
DROP POLICY IF EXISTS "Admins gerenciar clientes" ON clients;
DROP POLICY IF EXISTS "Permitir leitura publica de clientes" ON clients;

-- 2. Policy Simplificada: O próprio usuário vê seu perfil
CREATE POLICY "Ler proprio perfil" ON clients
FOR SELECT USING (
    auth_id = auth.uid()
);

-- 3. Policy Simplificada: Admin vê tudo
-- EVITAR RECURSÃO: Em vez de ler a tabela 'clients' para saber se é admin,
-- vamos confiar no METADATA do auth.users OU usar SECURITY DEFINER numa view.
-- Mas, para manter simples agora e resolver o bloqueio:
-- Vamos assumir que se o usuário tem acesso ao painel admin, ele deve ver tudo.

-- TENTATIVA 1: Policy Genérica de Leitura para todos os autenticados (SE FOR ACEITÁVEL NO PROJETO)
-- Se não for critico que clientes vejam lista de outros clientes (eles não tem acesso à UI de lista anyway)
-- CREATE POLICY "Leitura autenticada" ON clients FOR SELECT TO authenticated USING (true);

-- TENTATIVA 2 (Mais Segura): Usar uma função SECURITY DEFINER para checar admin
-- (Isso evita a recursão de RLS na própria tabela)

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica se existe registro admin para o usuario atual
  -- Como é SECURITY DEFINER, essa função roda com privilégios de dono, ignorando RLS
  RETURN EXISTS (
    SELECT 1 FROM clients 
    WHERE auth_id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agora a policy usa a função segura
CREATE POLICY "Admins ver tudo" ON clients
FOR ALL USING (
    is_admin()
);

-- E o próprio usuário vê o seu
CREATE POLICY "Usuario ve o seu" ON clients
FOR ALL USING (
   auth_id = auth.uid()
);
