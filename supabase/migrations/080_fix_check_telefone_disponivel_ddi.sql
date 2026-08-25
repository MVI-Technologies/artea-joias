-- =====================================================
-- MIGRATION 080: check_telefone_disponivel tolerante a DDI
-- =====================================================
-- Bug relatado: a recuperação de conta por telefone
-- (ForgotPasswordLegacy.jsx) sempre respondia "telefone não
-- encontrado" mesmo para clientes existentes.
--
-- Causa: PhoneInput.jsx sempre emite o valor com o código do país
-- (ex.: "+55 (11) 99999-9999" -> limpo vira "5511999999999", COM o
-- DDI 55). Mas `clients.telefone` é gravado historicamente SEM o DDI
-- na maioria dos cadastros (ex.: "11999999999", confirmado consultando
-- dados reais). A função check_telefone_disponivel (077) fazia
-- comparação exata (`telefone = p_telefone`), então "5511999999999"
-- nunca batia com "11999999999" cadastrado.
--
-- Esta migration torna a checagem tolerante a essa variação de DDI,
-- no mesmo padrão já usado em outros pontos do sistema (AuthContext.jsx
-- signIn, e a Edge Function reset-password): tenta o valor recebido,
-- com "55" removido do início (se presente) e com "55" adicionado (se
-- ausente). Não altera a assinatura nem o uso já existente em
-- Register.jsx.

CREATE OR REPLACE FUNCTION public.check_telefone_disponivel(p_telefone TEXT)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.clients
    WHERE telefone = p_telefone
       OR telefone = (CASE WHEN p_telefone LIKE '55%' THEN substring(p_telefone from 3) ELSE p_telefone END)
       OR telefone = (CASE WHEN p_telefone LIKE '55%' THEN p_telefone ELSE '55' || p_telefone END)
  );
$$;

COMMENT ON FUNCTION public.check_telefone_disponivel(TEXT) IS
  'Pré-checagem pública (anon) de disponibilidade/existência de telefone (cadastro e recuperação de conta legada). Tolerante à presença/ausência do DDI 55. Retorna apenas um booleano; a validação autoritativa continua no trigger handle_new_user / na Edge Function reset-password.';
