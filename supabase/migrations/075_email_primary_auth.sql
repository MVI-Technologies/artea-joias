-- =====================================================
-- MIGRATION 074: Migração do login principal de telefone para e-mail
-- =====================================================
-- Contexto: o login/cadastro principal passa a usar e-mail + senha.
-- Telefone continua existindo como dado cadastral/contato e como
-- método de login exclusivo para clientes legados que ainda não
-- cadastraram um e-mail real (ver fluxo em src/pages/auth).
--
-- Esta migration é aditiva: não remove nem torna NOT NULL nenhuma
-- coluna existente, para não quebrar clientes legados sem e-mail
-- cadastrado. auth.users continua sendo a fonte de verdade sobre
-- se um cliente já migrou (auth.users.email deixa de terminar em
-- "@artea.local" quando a migração é concluída).

-- -----------------------------------------------------
-- 1. Normalizar clients.email (dados legados)
-- -----------------------------------------------------

-- 1a. Strings vazias não são "sem e-mail" de forma consistente com
--     verificações IS NULL usadas no restante do sistema — normaliza para NULL.
UPDATE public.clients
SET email = NULL
WHERE email IS NOT NULL AND btrim(email) = '';

-- 1b. Alguns clientes legados podem ter e-mails duplicados (ex.: import
--     em massa reaproveitando o mesmo e-mail de contato). Mantém o e-mail
--     apenas na conta mais antiga para permitir criar o índice único abaixo
--     sem apagar nenhuma linha nem bloquear a migration. As contas mais
--     recentes voltam a ficar marcadas como "sem e-mail" e passam pelo
--     fluxo de cadastro obrigatório normalmente.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY lower(btrim(email)) ORDER BY created_at ASC, id ASC
  ) AS rn
  FROM public.clients
  WHERE email IS NOT NULL
)
UPDATE public.clients c
SET email = NULL
FROM ranked
WHERE c.id = ranked.id AND ranked.rn > 1;

-- -----------------------------------------------------
-- 2. Unicidade de e-mail (permite múltiplos NULL, bloqueia duplicados reais)
-- -----------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_unique
  ON public.clients (lower(email))
  WHERE email IS NOT NULL;

-- -----------------------------------------------------
-- 3. handle_new_user: suportar cadastro novo com e-mail real
-- -----------------------------------------------------
-- Antes desta migration (073), o telefone só era extraído de
-- NEW.phone (coluna nativa do Supabase Auth, não usada neste projeto)
-- quando NEW.email não era sintético — ou seja, ficava NULL para um
-- cadastro feito com e-mail real. Agora o telefone é lido primeiro do
-- metadata (options.data.telefone), como o frontend já envia.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  extracted_phone TEXT;
  extracted_email TEXT;
  extracted_endereco JSONB;
  is_synthetic_email BOOLEAN;
BEGIN
  is_synthetic_email := NEW.email LIKE '%@artea.local';

  -- Telefone: prioriza o metadata (cadastro novo por e-mail),
  -- depois deriva do e-mail sintético (cadastro legado por telefone),
  -- e por fim usa NEW.phone como último recurso.
  extracted_phone := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'telefone'), ''),
    CASE WHEN is_synthetic_email
      THEN REPLACE(SPLIT_PART(NEW.email, '@', 1), ' ', '')
      ELSE NULL
    END,
    NEW.phone
  );

  -- E-mail de negócio: se o e-mail do Auth já é o e-mail real (cadastro
  -- novo), usa ele. Se o e-mail do Auth é sintético (cadastro legado via
  -- create-user/telefone), usa o e-mail real informado em metadata, se houver.
  extracted_email := CASE
    WHEN is_synthetic_email THEN NULLIF(btrim(NEW.raw_user_meta_data->>'email_real'), '')
    ELSE NEW.email
  END;

  IF NEW.raw_user_meta_data->>'endereco' IS NOT NULL THEN
    extracted_endereco := jsonb_build_array(
      jsonb_build_object(
        'logradouro', NEW.raw_user_meta_data->>'endereco',
        'numero', NEW.raw_user_meta_data->>'numero',
        'complemento', NEW.raw_user_meta_data->>'complemento',
        'bairro', NEW.raw_user_meta_data->>'bairro',
        'cidade', NEW.raw_user_meta_data->>'cidade',
        'estado', NEW.raw_user_meta_data->>'estado',
        'cep', NEW.raw_user_meta_data->>'cep'
      )
    );
  ELSE
    extracted_endereco := NULL;
  END IF;

  INSERT INTO public.clients (
    auth_id,
    nome,
    telefone,
    email,
    instagram,
    cpf,
    aniversario,
    enderecos,
    role,
    approved,
    cadastro_status,
    created_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', 'Novo Cliente'),
    extracted_phone,
    extracted_email,
    NEW.raw_user_meta_data->>'instagram',
    NEW.raw_user_meta_data->>'cpf',
    CASE
      WHEN NEW.raw_user_meta_data->>'data_nascimento' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'data_nascimento')::DATE
      ELSE NULL
    END,
    extracted_endereco,
    'cliente',
    false,
    'pendente',
    NOW()
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, clients.email),
    telefone = COALESCE(EXCLUDED.telefone, clients.telefone),
    instagram = COALESCE(EXCLUDED.instagram, clients.instagram),
    cpf = COALESCE(EXCLUDED.cpf, clients.cpf),
    aniversario = COALESCE(EXCLUDED.aniversario, clients.aniversario),
    enderecos = COALESCE(EXCLUDED.enderecos, clients.enderecos),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------
-- 4. RPC set_client_email: permite que o próprio cliente autenticado
--    cadastre/atualize seu e-mail de negócio (clients.email), sem abrir
--    uma policy de UPDATE geral na tabela clients (que exporia role,
--    approved e outras colunas administrativas a escrita pelo cliente).
--    Usada pela tela obrigatória de migração de clientes legados e por
--    "Meus Dados". Só altera a linha do próprio auth.uid() e apenas a
--    coluna email.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_client_email(p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_email := lower(btrim(p_email));

  IF v_email IS NULL OR v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clients
    WHERE lower(email) = v_email AND auth_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'email_already_in_use';
  END IF;

  UPDATE public.clients
  SET email = v_email, updated_at = NOW()
  WHERE auth_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client_not_found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_client_email(TEXT) TO authenticated;
