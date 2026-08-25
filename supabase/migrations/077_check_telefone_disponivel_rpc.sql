-- =====================================================
-- MIGRATION 077: RPC de pré-checagem de telefone no cadastro
-- =====================================================
-- Contexto: o trigger handle_new_user (076) agora rejeita telefone
-- duplicado com uma mensagem clara (SQLSTATE ART02), mas o endpoint
-- GoTrue (/auth/v1/signup) não repassa o texto de exceções do Postgres
-- ao cliente para SQLSTATEs que não reconhece — ele responde de forma
-- genérica ("Database error saving new user", sem detalhe), confirmado
-- em teste real. Duplicidade de e-mail já é pega antes disso pelo
-- próprio GoTrue (auth.users.email é único) e sinalizada via
-- `identities.length === 0` em Register.jsx; duplicidade de telefone
-- não tinha nenhum caminho amigável equivalente.
--
-- Esta função permite ao formulário de cadastro checar a
-- disponibilidade do telefone ANTES de chamar signUp, retornando
-- apenas um booleano (sem expor nenhuma outra coluna de `clients`).

CREATE OR REPLACE FUNCTION public.check_telefone_disponivel(p_telefone TEXT)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.clients WHERE telefone = p_telefone
  );
$$;

COMMENT ON FUNCTION public.check_telefone_disponivel(TEXT) IS
  'Pré-checagem pública (anon) de disponibilidade de telefone para o formulário de cadastro. Retorna apenas um booleano; a validação autoritativa continua no trigger handle_new_user.';

GRANT EXECUTE ON FUNCTION public.check_telefone_disponivel(TEXT) TO anon, authenticated;
