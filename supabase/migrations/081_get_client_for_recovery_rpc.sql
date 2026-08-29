-- =====================================================
-- MIGRATION 081: RPC de apoio à recuperação de conta por telefone
-- =====================================================
-- Contexto: o fluxo de recuperação por telefone (ForgotPasswordLegacy.jsx)
-- volta a exigir um código de verificação enviado por WhatsApp antes de
-- permitir a troca de e-mail/senha (ver 082 para o motivo). Para montar
-- e enviar esse código, o front-end (ainda sem sessão) precisa do
-- `client_id` (para gravar em password_reset_codes) e do `nome` (para
-- personalizar a mensagem) do cliente dono do telefone.
--
-- Antes da correção de RLS em `clients` (078/079), isso "funcionava"
-- porque RLS estava desligado na tabela inteira — ou seja, qualquer
-- leitura direta de `clients` por um cliente anônimo já era, na
-- prática, a mesma falha de segurança corrigida naquelas migrations.
-- Agora que RLS está corretamente aplicado, é necessária uma função
-- SECURITY DEFINER dedicada e mínima (só id + nome, nada mais) para
-- reabilitar esse único caso de uso legítimo de leitura anônima.

CREATE OR REPLACE FUNCTION public.get_client_for_recovery(p_telefone TEXT)
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT c.id, c.nome
  FROM public.clients c
  WHERE c.telefone = p_telefone
     OR c.telefone = (CASE WHEN p_telefone LIKE '55%' THEN substring(p_telefone from 3) ELSE p_telefone END)
     OR c.telefone = (CASE WHEN p_telefone LIKE '55%' THEN p_telefone ELSE '55' || p_telefone END)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_client_for_recovery(TEXT) IS
  'Uso exclusivo do fluxo de recuperação de conta por telefone (ForgotPasswordLegacy.jsx): retorna apenas id+nome do cliente dono do telefone, para gerar/enviar o código de verificação por WhatsApp. Tolerante à presença/ausência do DDI 55.';

GRANT EXECUTE ON FUNCTION public.get_client_for_recovery(TEXT) TO anon, authenticated;
