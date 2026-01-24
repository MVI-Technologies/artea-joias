-- =====================================================
-- MIGRATION 033: AUTOMATE CLIENT LAST PURCHASE
-- Trigger to update ultima_compra on romaneio changes
-- =====================================================

-- Function to update client last purchase date
CREATE OR REPLACE FUNCTION update_client_last_purchase()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if status implies a valid purchase/activity
    -- Typically 'pago', 'enviado', 'concluido' imply confirmed purchase.
    -- Or even 'aguardando_pagamento' if we want to track attempt.
    -- Let's track any creation or update as activity for now, or strictly 'pago'.
    -- User request: "A data da última compra deve vir dos romaneios"
    -- Usually "Last Purchase" means the date of the last created romaneio or last paid one.
    -- Let's use the created_at of the NEW romaneio to update the client.
    
    UPDATE clients
    SET ultima_compra = NEW.created_at
    WHERE id = NEW.client_id
    AND (ultima_compra IS NULL OR ultima_compra < NEW.created_at);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for INSERT (New Romaneio)
DROP TRIGGER IF EXISTS trg_update_last_purchase_insert ON romaneios;
CREATE TRIGGER trg_update_last_purchase_insert
    AFTER INSERT ON romaneios
    FOR EACH ROW
    EXECUTE FUNCTION update_client_last_purchase();

-- Trigger for UPDATE (In case dates change or re-assignment - less common but safe)
DROP TRIGGER IF EXISTS trg_update_last_purchase_update ON romaneios;
CREATE TRIGGER trg_update_last_purchase_update
    AFTER UPDATE OF created_at ON romaneios
    FOR EACH ROW
    EXECUTE FUNCTION update_client_last_purchase();

-- Manual backfill for existing data (optional but recommended)
UPDATE clients c
SET ultima_compra = (
    SELECT MAX(r.created_at)
    FROM romaneios r
    WHERE r.client_id = c.id
)
WHERE ultima_compra IS NULL;

-- Verification
SELECT 'Migration 033 applied: Auto-update ultima_compra trigger created' as status;
