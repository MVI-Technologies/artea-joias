-- =====================================================
-- MIGRATION 039: EXPAND LOT STATUS OPTIONS
-- Expande as opções de status disponíveis para lots
-- =====================================================

-- Remover constraint antiga
ALTER TABLE lots 
DROP CONSTRAINT IF EXISTS lots_status_check;

-- Adicionar nova constraint com todos os status
ALTER TABLE lots 
ADD CONSTRAINT lots_status_check 
CHECK (status IN (
    'aberto',
    'fechado',
    'preparacao',
    'em_preparacao',
    'pronto_e_aberto',
    'em_fabricacao',
    'fornecedor_separando',
    'verificando_estoque',
    'organizando_valores',
    'aguardando_pagamentos',
    'em_transito',
    'em_transito_internacional',
    'em_separacao',
    'envio_liberado',
    'envio_parcial_liberado',
    'fechado_e_bloqueado',
    'pago',
    'enviado',
    'concluido',
    'finalizado',
    'cancelado'
));

-- Comentário
COMMENT ON COLUMN lots.status IS 'Status do grupo de compras. Valores expandidos para incluir mais opções de acompanhamento.';

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 'Migration 039 applied successfully!' as status;
SELECT 'Status options expanded in lots table' as feature;
