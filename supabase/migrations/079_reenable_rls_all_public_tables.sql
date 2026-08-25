-- =====================================================
-- MIGRATION 079: Reabilita RLS em TODAS as tabelas públicas (CRÍTICO)
-- =====================================================
-- Continuação da 078: ao investigar o achado de `clients` com RLS
-- desligado, uma varredura completa (pg_class.relrowsecurity) mostrou
-- que TODAS as 24 tabelas do schema public estavam com RLS desligado
-- em produção — não era um problema isolado de `clients`. Isso inclui
-- tabelas com dados extremamente sensíveis:
--   * integrations       -> credenciais ao vivo do Mercado Pago/Correios
--   * romaneios / romaneio_pagamentos -> pedidos e pagamentos de clientes
--   * financial_transactions -> ledger financeiro
--   * products            -> custo/margem (já seria exposto mesmo com RLS,
--                            ver skill artea-supabase §5, mas agora sem
--                            nenhuma barreira nem de linha)
--   * password_reset_codes -> códigos de recuperação de senha válidos
--
-- Com RLS desligado e `anon`/`authenticated` tendo grants de
-- SELECT/INSERT/UPDATE/DELETE (necessários para quando RLS está
-- ligado), qualquer requisição não autenticada com a anon key pública
-- conseguia ler e escrever livremente nessas tabelas.
--
-- 23 das 24 tabelas já têm policies corretas definidas (só não estavam
-- sendo aplicadas) — esta migration apenas ENABLE ROW LEVEL SECURITY
-- nelas, sem alterar nenhuma policy existente.
--
-- A exceção é `romaneio_items`, que não tem NENHUMA policy definida.
-- Simplesmente ligar RLS nela sem policy bloquearia totalmente o
-- acesso (inclusive para admins e para o dono do pedido), quebrando
-- telas de detalhe de pedido. Por isso esta migration também CRIA duas
-- policies novas para `romaneio_items`, espelhando exatamente o padrão
-- já usado em `romaneio_pagamentos` (a tabela irmã mais próxima:
-- item-level, vinculada a romaneios pelo mesmo romaneio_id): admin
-- gerencia tudo, cliente só enxerga os itens dos próprios romaneios.
-- Escrita nesta tabela pelo fluxo normal de checkout acontece via RPC
-- SECURITY DEFINER (checkout_romaneio), que não é afetada por RLS.

ALTER TABLE public.catalog_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.romaneio_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.romaneio_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.romaneios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- romaneio_items: sem policies pré-existentes — cria antes de ligar RLS.
CREATE POLICY "Admins gerenciam itens de romaneio"
  ON public.romaneio_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.auth_id = auth.uid() AND clients.role = 'admin'
    )
  );

CREATE POLICY "Clientes veem itens dos proprios romaneios"
  ON public.romaneio_items
  FOR SELECT
  USING (
    romaneio_id IN (
      SELECT r.id FROM public.romaneios r
      JOIN public.clients c ON c.id = r.client_id
      WHERE c.auth_id = auth.uid()
    )
  );

ALTER TABLE public.romaneio_items ENABLE ROW LEVEL SECURITY;
