-- =====================================================
-- ADD romaneio_id TO orders (fallback)
-- =====================================================

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS romaneio_id UUID REFERENCES romaneios(id);

CREATE INDEX IF NOT EXISTS idx_orders_romaneio_id ON orders(romaneio_id);

