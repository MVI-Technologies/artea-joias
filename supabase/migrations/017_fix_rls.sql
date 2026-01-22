-- =====================================================
-- MIGRATION 017: Correção de RLS (Policies)
-- Garante que Clientes vejam seus dados e Admins vejam tudo
-- =====================================================

-- 1. ROMANEIOS
ALTER TABLE romaneios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem gerenciar romaneios" ON romaneios;
DROP POLICY IF EXISTS "Clientes veem romaneios proprios" ON romaneios;

-- Policy: Admin Total
CREATE POLICY "Admins podem gerenciar romaneios" ON romaneios
FOR ALL USING (
    EXISTS (SELECT 1 FROM clients c WHERE c.auth_id = auth.uid() AND c.role = 'admin')
);

-- Policy: Cliente Vê Próprio (Leitura apenas)
CREATE POLICY "Clientes veem romaneios proprios" ON romaneios
FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE auth_id = auth.uid())
);


-- 2. PEDIDOS (ORDERS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins total orders" ON orders;
DROP POLICY IF EXISTS "Clientes own orders" ON orders;

CREATE POLICY "Admins total orders" ON orders
FOR ALL USING (
    EXISTS (SELECT 1 FROM clients c WHERE c.auth_id = auth.uid() AND c.role = 'admin')
);

CREATE POLICY "Clientes own orders" ON orders
FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE auth_id = auth.uid())
);


-- 3. CLIENTS (Permitir ler seu próprio perfil para checar role/id)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ler proprio perfil" ON clients;
CREATE POLICY "Ler proprio perfil" ON clients
FOR SELECT USING (
    auth_id = auth.uid()
);

-- 4. PRODUTOS (Público apenas leitura, Admin escrita)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publico ver produtos ativos" ON products;
CREATE POLICY "Publico ver produtos ativos" ON products
FOR SELECT USING (true); -- Permitir ver, filtragem de 'ativo' é UX


-- =====================================================
-- AJUSTE DE TRIGGER (Prevenção)
-- Garantir que trigger funcione mesmo se RLS estiver ativo (Security Definer)
-- =====================================================
-- O trigger roda como Owner, então geralmente passa RLS, mas se chamar function com RLS...
-- Nenhuma ação extra necessária se a function for SECURITY DEFINER (já pusemos nas RPCs)
