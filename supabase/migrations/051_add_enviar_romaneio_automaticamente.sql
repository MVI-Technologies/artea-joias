-- =====================================================
-- MIGRATION: Adicionar campo enviar_romaneio_automaticamente
-- Permite configurar se o romaneio deve ser enviado automaticamente
-- ao cliente quando o lote for fechado
-- =====================================================

-- Adicionar coluna na tabela lots
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS enviar_romaneio_automaticamente BOOLEAN DEFAULT true;

-- Comentário explicativo
COMMENT ON COLUMN lots.enviar_romaneio_automaticamente IS 
'Define se o romaneio deve ser enviado automaticamente ao cliente quando o lote for fechado. true = enviar automaticamente, false = envio manual';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'Migration aplicada: Campo enviar_romaneio_automaticamente adicionado' as status;
