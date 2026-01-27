-- =====================================================
-- MIGRATION 052: ADD ADICIONAL_POR_PRODUTO COLUMN
-- Adds the missing adicional_por_produto column to lots table
-- =====================================================

-- Add adicional_por_produto (percentage markup per product in this lot)
ALTER TABLE lots ADD COLUMN IF NOT EXISTS adicional_por_produto NUMERIC(5,2) DEFAULT 0;

-- Add comment
COMMENT ON COLUMN lots.adicional_por_produto IS 'Percentual adicional aplicado ao preço de cada produto neste lote (ex: 5% aumenta preço de R$10 para R$10,50)';

-- Verification
SELECT 'Migration 052 applied successfully!' as status;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'lots' 
AND column_name = 'adicional_por_produto';
