-- =====================================================
-- MIGRATION 045: ADD OFFICE COMMISSION AND DYNAMIC FEE BY VALUE
-- Implements escritório (% markup per lot) and dynamic fee by cart value
-- =====================================================

-- Add escritorio_pct (office commission percentage applied to products in this lot)
ALTER TABLE lots ADD COLUMN IF NOT EXISTS escritorio_pct NUMERIC(5,2) DEFAULT 0;

-- Add custo_digitacao if it doesn't exist (typing cost)
ALTER TABLE lots ADD COLUMN IF NOT EXISTS custo_digitacao NUMERIC(10,2) DEFAULT 0;

-- Add taxa_dinamica_valor_rules for dynamic fee by cart VALUE (not quantity)
-- Structure: [{"max": 80, "fee": 15}, {"max": 150, "fee": 25}, ...]
ALTER TABLE lots ADD COLUMN IF NOT EXISTS taxa_dinamica_valor_rules JSONB DEFAULT '[]'::jsonb;

-- Add comments
COMMENT ON COLUMN lots.escritorio_pct IS 'Percentual de comissão/escritório aplicado ao preço dos produtos neste lote (ex: 10% aumenta preço de R$10 para R$11)';
COMMENT ON COLUMN lots.custo_digitacao IS 'Custo fixo de digitação por lote (R$)';
COMMENT ON COLUMN lots.taxa_dinamica_valor_rules IS 'Regras de taxa dinâmica por VALOR total do carrinho. Ex: [{"max": 80, "fee": 15}] = até R$80 cobra R$15';

-- Verification
SELECT 'Migration 045 applied successfully!' as status;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'lots' 
AND column_name IN ('escritorio_pct', 'custo_digitacao', 'taxa_dinamica_valor_rules')
ORDER BY column_name;
