-- =====================================================
-- MIGRATION 082: Código de rastreio manual no romaneio
-- =====================================================
-- Contexto: o fechamento do romaneio (RomaneioDetail.jsx, admin) passa
-- a permitir informar manualmente o frete (romaneios.valor_frete já
-- existe e já é considerado em valor_total por recalculate_romaneio_values,
-- migration 057) e o código de rastreio do envio.
--
-- Aditiva, sem NOT NULL: romaneios existentes continuam válidos com
-- codigo_rastreio NULL (compatibilidade com registros antigos).

ALTER TABLE public.romaneios
  ADD COLUMN IF NOT EXISTS codigo_rastreio TEXT;

COMMENT ON COLUMN public.romaneios.codigo_rastreio IS
  'Código de rastreio do envio, informado manualmente pelo admin/vendedor no fechamento do romaneio. Aceita texto livre (não só Correios) e é opcional.';
