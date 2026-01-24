-- =====================================================
-- ADD CPF/CNPJ TO CLIENTS
-- =====================================================

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS cpf TEXT;

