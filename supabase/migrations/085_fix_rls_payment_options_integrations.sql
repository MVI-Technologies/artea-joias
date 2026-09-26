-- =====================================================
-- MIGRATION 085: Corrige RLS de payment_options e integrations
-- =====================================================
-- Sintoma relatado: no formulário do link, o campo "Dados para o pagamento"
-- não persistia. Na verdade digitar e salvar funciona — o que não funciona
-- é o botão "Procurar": a listagem de opções de pagamento retorna 403, então
-- a lista vem vazia e nada é selecionado.
--
-- Causa: as policies destas duas tabelas consultam auth.users diretamente:
--   EXISTS (SELECT 1 FROM auth.users
--           WHERE users.id = auth.uid()
--             AND users.raw_user_meta_data->>'role' = 'admin')
-- O role `authenticated` (usado pelo PostgREST) não tem SELECT em auth.users,
-- então a subquery nunca encontra nada e a policy nega para TODO mundo,
-- inclusive admins de verdade.
--
-- O mesmo defeito derrubava a leitura de `integrations` (type='pix'), que é
-- o motivo de o romaneio do cliente mostrar "Método de pagamento não
-- configurado" mesmo com o PIX cadastrado.
--
-- Correção: usar o mesmo padrão do resto do schema, que funciona e não
-- depende de metadata (que, além de inacessível aqui, é gravável pelo
-- próprio cliente via auth.updateUser):
--   EXISTS (SELECT 1 FROM clients WHERE auth_id = auth.uid() AND role = 'admin')
--
-- Só troca a condição das policies. Nenhuma linha de dado é alterada.

-- -----------------------------------------------------
-- payment_options
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Admins podem ver opções de pagamento" ON public.payment_options;
DROP POLICY IF EXISTS "Admins podem criar opções de pagamento" ON public.payment_options;
DROP POLICY IF EXISTS "Admins podem atualizar opções de pagamento" ON public.payment_options;
DROP POLICY IF EXISTS "Admins podem deletar opções de pagamento" ON public.payment_options;

CREATE POLICY "Admins gerenciam opções de pagamento"
  ON public.payment_options FOR ALL
  USING (EXISTS (SELECT 1 FROM public.clients WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients WHERE auth_id = auth.uid() AND role = 'admin'));

-- -----------------------------------------------------
-- integrations
-- -----------------------------------------------------
-- config guarda credenciais vivas (Mercado Pago, Correios), então escrita e
-- leitura completa seguem restritas a admin. O cliente precisa apenas dos
-- dados públicos do PIX para pagar o romaneio — liberados pela view abaixo.
DROP POLICY IF EXISTS "Admins can view integrations" ON public.integrations;
DROP POLICY IF EXISTS "Admins can insert integrations" ON public.integrations;
DROP POLICY IF EXISTS "Admins can update integrations" ON public.integrations;
DROP POLICY IF EXISTS "Admins can delete integrations" ON public.integrations;

CREATE POLICY "Admins gerenciam integrações"
  ON public.integrations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.clients WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients WHERE auth_id = auth.uid() AND role = 'admin'));

-- Dados de PIX para exibir ao cliente no romaneio: apenas os campos
-- necessários para pagar, nunca a config inteira (que tem access_token).
CREATE OR REPLACE FUNCTION public.get_pix_publico()
RETURNS TABLE (chave TEXT, nome_beneficiario TEXT, cidade TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    config->>'chave',
    config->>'nome_beneficiario',
    config->>'cidade'
  FROM public.integrations
  WHERE type = 'pix'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_pix_publico() IS
  'Dados públicos do PIX (chave, beneficiário, cidade) para o cliente pagar o romaneio. Nunca expõe integrations.config inteiro, que contém credenciais.';

GRANT EXECUTE ON FUNCTION public.get_pix_publico() TO authenticated;
