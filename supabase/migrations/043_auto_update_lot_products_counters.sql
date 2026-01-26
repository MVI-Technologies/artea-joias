-- Create trigger to auto-update lot_products counters when romaneio_items change
-- Fixes: "0 peças compradas por 0 pessoas" showing despite purchases

-- Function to recalculate lot_products stats
CREATE OR REPLACE FUNCTION update_lot_products_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_lot_id UUID;
    v_product_id UUID;
BEGIN
    -- Get lot_id and product_id from the affected romaneio_item
    IF TG_OP = 'DELETE' THEN
        v_product_id := OLD.product_id;
        SELECT lot_id INTO v_lot_id FROM romaneios WHERE id = OLD.romaneio_id;
    ELSE
        v_product_id := NEW.product_id;
        SELECT lot_id INTO v_lot_id FROM romaneios WHERE id = NEW.romaneio_id;
    END IF;

    -- Recalculate stats for this product in this lot
    UPDATE lot_products
    SET 
        quantidade_pedidos = (
            SELECT COALESCE(SUM(ri.quantidade), 0)
            FROM romaneio_items ri
            JOIN romaneios r ON r.id = ri.romaneio_id
            WHERE r.lot_id = v_lot_id 
            AND ri.product_id = v_product_id
            AND r.status_pagamento NOT IN ('cancelado', 'rejeitado')
        ),
        quantidade_clientes = (
            SELECT COUNT(DISTINCT r.client_id)
            FROM romaneio_items ri
            JOIN romaneios r ON r.id = ri.romaneio_id
            WHERE r.lot_id = v_lot_id 
            AND ri.product_id = v_product_id
            AND r.status_pagamento NOT IN ('cancelado', 'rejeitado')
        )
    WHERE lot_id = v_lot_id AND product_id = v_product_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on romaneio_items
DROP TRIGGER IF EXISTS trg_update_lot_products_stats ON romaneio_items;
CREATE TRIGGER trg_update_lot_products_stats
    AFTER INSERT OR UPDATE OR DELETE ON romaneio_items
    FOR EACH ROW
    EXECUTE FUNCTION update_lot_products_stats();

-- Also update when romaneio status changes (e.g., cancelado)
CREATE OR REPLACE FUNCTION update_lot_products_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only recalculate if status_pagamento changed
    IF OLD.status_pagamento IS DISTINCT FROM NEW.status_pagamento THEN
        -- Recalculate all products in this romaneio
        UPDATE lot_products lp
        SET 
            quantidade_pedidos = (
                SELECT COALESCE(SUM(ri.quantidade), 0)
                FROM romaneio_items ri
                JOIN romaneios r ON r.id = ri.romaneio_id
                WHERE r.lot_id = NEW.lot_id 
                AND ri.product_id = lp.product_id
                AND r.status_pagamento NOT IN ('cancelado', 'rejeitado')
            ),
            quantidade_clientes = (
                SELECT COUNT(DISTINCT r.client_id)
                FROM romaneio_items ri
                JOIN romaneios r ON r.id = ri.romaneio_id
                WHERE r.lot_id = NEW.lot_id 
                AND ri.product_id = lp.product_id
                AND r.status_pagamento NOT IN ('cancelado', 'rejeitado')
            )
        WHERE lp.lot_id = NEW.lot_id
        AND lp.product_id IN (
            SELECT product_id FROM romaneio_items WHERE romaneio_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_lot_products_on_romaneio_status ON romaneios;
CREATE TRIGGER trg_update_lot_products_on_romaneio_status
    AFTER UPDATE ON romaneios
    FOR EACH ROW
    EXECUTE FUNCTION update_lot_products_on_status_change();

-- Recalculate all existing counters (one-time fix for existing data)
UPDATE lot_products lp
SET 
    quantidade_pedidos = (
        SELECT COALESCE(SUM(ri.quantidade), 0)
        FROM romaneio_items ri
        JOIN romaneios r ON r.id = ri.romaneio_id
        WHERE r.lot_id = lp.lot_id 
        AND ri.product_id = lp.product_id
        AND r.status_pagamento NOT IN ('cancelado', 'rejeitado')
    ),
    quantidade_clientes = (
        SELECT COUNT(DISTINCT r.client_id)
        FROM romaneio_items ri
        JOIN romaneios r ON r.id = ri.romaneio_id
        WHERE r.lot_id = lp.lot_id 
        AND ri.product_id = lp.product_id
        AND r.status_pagamento NOT IN ('cancelado', 'rejeitado')
    );

COMMENT ON FUNCTION update_lot_products_stats IS 'Auto-updates quantidade_pedidos and quantidade_clientes in lot_products when romaneio_items change';
