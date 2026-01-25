-- =====================================================
-- MIGRATION 038: ADD TIPO_LINK TO LOTS
-- Adiciona campo tipo_link para diferenciar tipos de catálogos
-- =====================================================

-- Adicionar campo tipo_link na tabela lots
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS tipo_link TEXT DEFAULT 'tradicional'
CHECK (tipo_link IN ('tradicional', 'pronta_entrega'));

-- Comentário
COMMENT ON COLUMN lots.tipo_link IS 'Tipo de link: tradicional (Compra Coletiva) ou pronta_entrega (Pronta Entrega com controle de qtde máxima)';

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 'Migration 038 applied successfully!' as status;
SELECT 'tipo_link column added to lots table' as feature;
