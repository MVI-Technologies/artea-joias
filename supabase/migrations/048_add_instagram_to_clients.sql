-- =====================================================
-- MIGRATION 048: ADD INSTAGRAM FIELD TO CLIENTS
-- =====================================================

-- Add instagram column to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS instagram TEXT;

-- Verification
SELECT 'Migration 048 applied: instagram field added to clients' as status;
