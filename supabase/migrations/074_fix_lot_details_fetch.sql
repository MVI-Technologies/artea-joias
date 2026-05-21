-- =====================================================
-- Migration 074: Fix Lot Details Fetch for Admins
-- Ensures margins and other critical data are always available
-- =====================================================

CREATE OR REPLACE FUNCTION get_lot_details_v2(p_lot_id UUID)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    adicional_por_produto NUMERIC,
    escritorio_pct NUMERIC,
    requer_pacote_fechado BOOLEAN,
    status TEXT,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id, 
        l.nome, 
        l.adicional_por_produto, 
        l.escritorio_pct, 
        l.requer_pacote_fechado, 
        l.status, 
        l.updated_at
    FROM lots l
    WHERE l.id = p_lot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_lot_details_v2 IS 'Bypass RLS to get critical lot data for admins/system operations.';
