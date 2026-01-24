-- =====================================================
-- MIGRATION 032: CLIENT MANAGEMENT REFACTOR
-- Add ultima_compra, drop estrelinhas
-- =====================================================

-- 1. Add ultima_compra column
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS ultima_compra TIMESTAMPTZ;

-- 2. Drop estrelinhas (cleanup)
ALTER TABLE clients 
DROP COLUMN IF EXISTS estrelinhas;

-- 3. Ensure financial columns exist (idempotent check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'saldo_devedor') THEN
        ALTER TABLE clients ADD COLUMN saldo_devedor NUMERIC(10,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'credito_disponivel') THEN
        ALTER TABLE clients ADD COLUMN credito_disponivel NUMERIC(10,2) DEFAULT 0;
    END IF;
END $$;

-- 4. Create function to update client financials (RPC for easy access)
CREATE OR REPLACE FUNCTION update_client_financials(
    p_client_id UUID,
    p_saldo_devedor NUMERIC DEFAULT NULL,
    p_credito_disponivel NUMERIC DEFAULT NULL,
    p_ultima_compra TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE clients
    SET 
        saldo_devedor = COALESCE(p_saldo_devedor, saldo_devedor),
        credito_disponivel = COALESCE(p_credito_disponivel, credito_disponivel),
        ultima_compra = COALESCE(p_ultima_compra, ultima_compra),
        updated_at = NOW()
    WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification
SELECT 'Migration 032 applied: Client structure updated' as status;
