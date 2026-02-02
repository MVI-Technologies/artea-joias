-- Migration: Add valor_recalculado column to romaneio_items
-- This allows manual updates to item totals when needed (e.g., admin adjustments)

-- Add the new column
ALTER TABLE romaneio_items 
ADD COLUMN IF NOT EXISTS valor_recalculado NUMERIC(10,2);

-- Add comment
COMMENT ON COLUMN romaneio_items.valor_recalculado IS 'Manually recalculated total value (overrides auto-calculated valor_total when set)';

-- Create a view or function to get the effective total
-- This will use valor_recalculado if set, otherwise valor_total
CREATE OR REPLACE FUNCTION get_item_valor_efetivo(item romaneio_items)
RETURNS NUMERIC(10,2) AS $$
BEGIN
    RETURN COALESCE(item.valor_recalculado, item.valor_total);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_item_valor_efetivo IS 'Returns valor_recalculado if set, otherwise valor_total';

-- Optional: Create a trigger to clear valor_recalculado when quantidade or preco_unitario changes
-- This ensures valor_recalculado is only used for manual overrides
CREATE OR REPLACE FUNCTION clear_valor_recalculado_on_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If quantidade or preco_unitario changed, clear valor_recalculado
    IF (OLD.quantidade IS DISTINCT FROM NEW.quantidade) OR 
       (OLD.preco_unitario IS DISTINCT FROM NEW.preco_unitario) THEN
        NEW.valor_recalculado := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clear_valor_recalculado ON romaneio_items;
CREATE TRIGGER trg_clear_valor_recalculado
    BEFORE UPDATE ON romaneio_items
    FOR EACH ROW
    EXECUTE FUNCTION clear_valor_recalculado_on_change();

-- Verification
SELECT 'Migration completed: valor_recalculado column added to romaneio_items' as status;
