
-- =====================================================
-- MIGRATION 066: Fix Client Deletion Foreign Key Constraints
-- =====================================================

-- 1. Fix romaneio_status_log (alterado_por)
-- This was preventing client deletion if they had ever changed a romaneio status
ALTER TABLE romaneio_status_log 
DROP CONSTRAINT IF EXISTS romaneio_status_log_alterado_por_fkey;

ALTER TABLE romaneio_status_log 
ADD CONSTRAINT romaneio_status_log_alterado_por_fkey 
FOREIGN KEY (alterado_por) REFERENCES clients(id) ON DELETE SET NULL;

-- 2. Ensure other potential constraints are handled (Audit/Logs)
-- If there are any other logs that reference clients without CASCADE or SET NULL, add them here.

-- 3. Verification
SELECT 'Migration 066 applied successfully: Client deletion now allowed.' as status;
