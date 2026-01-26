-- Enable RLS and create policies for romaneios table
-- Fixes: Client cannot see their own orders ("Nenhum pedido realizado ainda")

-- Enable RLS
ALTER TABLE romaneios ENABLE ROW LEVEL SECURITY;

-- Policy 1: Clients can view their own romaneios
CREATE POLICY "Clients can view their own romaneios"
    ON romaneios FOR SELECT
    TO authenticated
    USING (
        client_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
    );

-- Policy 2: Clients can create romaneios (via checkout RPC)
CREATE POLICY "Clients can create romaneios via checkout"
    ON romaneios FOR INSERT
    TO authenticated
    WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
    );

-- Policy 3: Clients can update their own romaneios (before payment)
CREATE POLICY "Clients can update their romaneios before payment"
    ON romaneios FOR UPDATE
    TO authenticated
    USING (
        client_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
        AND status_pagamento IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado')
    );

-- Policy 4: Admins can view all romaneios
CREATE POLICY "Admins can view all romaneios"
    ON romaneios FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM clients 
            WHERE auth_id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 5: Admins can do anything with romaneios
CREATE POLICY "Admins can manage all romaneios"
    ON romaneios FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM clients 
            WHERE auth_id = auth.uid() AND role = 'admin'
        )
    );

COMMENT ON TABLE romaneios IS 'RLS enabled: Clients can only see their own romaneios, admins can see all';
