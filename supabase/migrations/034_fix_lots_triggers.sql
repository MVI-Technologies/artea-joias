-- =====================================================
-- MIGRATION 034: Fix Lots Table Triggers
-- Removes deprecated triggers that reference removed orders table
-- =====================================================

-- 1. Drop triggers that reference the orders table
DROP TRIGGER IF EXISTS convert_reservas_trigger ON lots;
DROP TRIGGER IF EXISTS generate_romaneios_trigger ON lots;

-- 2. Drop the functions that reference orders
DROP FUNCTION IF EXISTS convert_reservas_to_orders_on_lot_close();
DROP FUNCTION IF EXISTS generate_complete_romaneios_on_lot_close();

-- Verification
SELECT 'Migration 034 applied: Removed deprecated triggers referencing orders table' as status;
