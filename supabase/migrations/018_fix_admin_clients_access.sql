-- MIGRATION 018: Fix Visibilidade de Clientes para Admins
-- Motivo: A migration 017 restringiu o acesso apenas ao próprio perfil, 
-- impedindo que admins vissem a lista de usuários.

-- 1. Remover policies antigas para garantir limpeza
DROP POLICY IF EXISTS "Admins ver todos clientes" ON clients;

-- 2. Criar Policy segura para Admin ver tudo
-- Estrategia: Admin pode ver tudo.
-- Como checar se é admin? Lendo a própria tabela clients.
-- Isso exige que o usuário JÁ CONSIGA ler seu próprio registro (garantido pela policy "Ler proprio perfil")

CREATE POLICY "Admins ver todos clientes" ON clients
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM clients self
        WHERE self.auth_id = auth.uid() 
        AND self.role = 'admin'
    )
);

-- Garantir que a policy de "Ler proprio perfil" da 017 continue lá (ela é fundamental para a recursão acima funcionar)
-- Caso tenha sido removida acidentalmente:
DROP POLICY IF EXISTS "Ler proprio perfil" ON clients;
CREATE POLICY "Ler proprio perfil" ON clients
FOR SELECT USING (
    auth_id = auth.uid()
);

-- Permissões de Escrita para Admin (Update/Delete)
CREATE POLICY "Admins gerenciar clientes" ON clients
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM clients self
        WHERE self.auth_id = auth.uid() 
        AND self.role = 'admin'
    )
);
