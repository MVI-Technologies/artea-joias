-- =====================================================
-- MIGRATION 083: Status "oculto" para lotes
-- =====================================================
-- Contexto: a lista de grupos acumula links antigos visíveis ao cliente.
-- O status "oculto" permite tirar um link da área do cliente (ele não
-- aparece nem em "Abertos" nem em "Encerrados") mantendo-o normalmente
-- visível e editável no painel admin. "fechado" continua com o
-- comportamento atual.
--
-- ATENÇÃO (divergência repo x banco): a constraint aplicada em produção
-- é a da migration 039 — a 071 (que renomeou 'em_fabricacao' para
-- 'em_producao') nunca foi aplicada. Esta migration parte da lista REAL
-- do banco e adiciona 'oculto' + 'em_producao', para que o repo e o banco
-- voltem a convergir. Nenhum dado é alterado: apenas ampliamos os valores
-- aceitos (nada é removido da lista, nenhum UPDATE em linhas existentes).

ALTER TABLE public.lots
DROP CONSTRAINT IF EXISTS lots_status_check;

ALTER TABLE public.lots
ADD CONSTRAINT lots_status_check
CHECK (status IN (
    'aberto',
    'fechado',
    'oculto',                     -- NOVO: escondido do cliente, visível ao admin
    'preparacao',
    'em_preparacao',
    'pronto_e_aberto',
    'em_producao',                -- aceito para convergir com a migration 071
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

COMMENT ON COLUMN public.lots.status IS
  'Status operacional do lote. "oculto" esconde o link da área do cliente (filtrado em ClientLinks.jsx e bloqueado em Catalog.jsx) sem removê-lo do painel admin.';
