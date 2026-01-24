-- =====================================================
-- MIGRATION 028: FIX ROMANEIO CONSTRAINTS
-- Remove NOT NULL from deprecated column dados_pagamento
-- =====================================================

ALTER TABLE romaneios 
ALTER COLUMN dados_pagamento DROP NOT NULL;

ALTER TABLE romaneios
ALTER COLUMN dados_pagamento SET DEFAULT '{}'::jsonb;

-- Verification
SELECT 'Migration 028 applied: dados_pagamento is now nullable' as status;
