-- Migration 071: Renomear status 'em_fabricacao' para 'em_producao'
-- Conforme solicitação do usuário: "Era em produção Não em fabricação"

-- 1. Remover constraint antiga
ALTER TABLE lots 
DROP CONSTRAINT IF EXISTS lots_status_check;

-- 2. Adicionar nova constraint com 'em_producao' (mantendo os outros)
ALTER TABLE lots 
ADD CONSTRAINT lots_status_check 
CHECK (status IN (
    'aberto',
    'fechado',
    'preparacao',
    'em_preparacao',
    'pronto_e_aberto',
    'em_producao',
    'em_fabricacao', -- Manter temporariamente para compatibilidade
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

-- 3. Migrar registros existentes
UPDATE lots SET status = 'em_producao' WHERE status = 'em_fabricacao';
