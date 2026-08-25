-- =====================================================
-- MIGRATION 076: Hardening do trigger handle_new_user
-- =====================================================
-- Contexto: testes de ponta a ponta do fluxo de cadastro por e-mail
-- (SMTP/Resend) descobriram dois problemas reais no trigger que cria
-- o registro em `clients` a partir de `auth.users`:
--
-- 1. REGRESSÃO: a migration 073 reescreveu a função a partir de uma
--    versão anterior ao bypass 'legacy_migration' (introduzido em 050,
--    mantido em 067) e removeu esse bypass sem intenção. Sem ele, toda
--    chamada da Edge Function `create-user` (que sempre envia
--    legacy_migration:'true' e faz seu próprio insert/update em
--    `clients` logo em seguida) colide com o insert automático deste
--    trigger na constraint `clients_auth_id_key` — a função acaba
--    revertendo (deleta o usuário recém-criado) e retornando erro.
--    Restaurado aqui.
--
-- 2. ROBUSTEZ: telefone ausente ou telefone/e-mail já usados por outra
--    conta hoje estouram como erro cru do Postgres (ex.: "null value
--    in column telefone violates not-null constraint" ou "duplicate
--    key value violates unique constraint clients_telefone_key"), sem
--    nenhuma mensagem compreensível para o front-end. A atomicidade
--    (falha aqui reverte a criação em auth.users) já funciona
--    corretamente hoje e é preservada — só trocamos o tipo do erro.
--
-- As constraints/índices que garantem unicidade já existem e não
-- precisam de nenhuma alteração (verificado em pg_constraint/pg_indexes
-- antes desta migration): `clients_telefone_key` (UNIQUE telefone,
-- coluna NOT NULL) e `idx_clients_email_unique` (UNIQUE lower(email)
-- WHERE email IS NOT NULL, criado em 074). Este trigger passa a validar
-- contra elas explicitamente ANTES do insert, e ainda captura qualquer
-- unique_violation residual (condição de corrida entre duas requisições
-- concorrentes) como rede de segurança — nunca ignora um conflito.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  extracted_phone TEXT;
  extracted_email TEXT;
  extracted_endereco JSONB;
  is_synthetic_email BOOLEAN;
BEGIN
  -- Bypass: a Edge Function create-user já cuida da criação/atualização
  -- de `clients` (inclusive backfill de clientes legados sem auth_id) e
  -- sinaliza isso com legacy_migration:'true'.
  IF NEW.raw_user_meta_data->>'legacy_migration' = 'true' THEN
    RETURN NEW;
  END IF;

  is_synthetic_email := NEW.email LIKE '%@artea.local';

  -- Telefone: prioriza o metadata (cadastro novo por e-mail), depois
  -- deriva do e-mail sintético (cadastro legado por telefone), e por
  -- fim usa NEW.phone como último recurso.
  extracted_phone := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'telefone'), ''),
    CASE WHEN is_synthetic_email
      THEN REPLACE(SPLIT_PART(NEW.email, '@', 1), ' ', '')
      ELSE NULL
    END,
    NULLIF(btrim(NEW.phone), '')
  );

  extracted_email := CASE
    WHEN is_synthetic_email THEN NULLIF(btrim(NEW.raw_user_meta_data->>'email_real'), '')
    ELSE NEW.email
  END;

  -- Validação explícita 1: telefone é obrigatório (clients.telefone é
  -- NOT NULL). Levantada aqui, antes do insert, para uma mensagem
  -- compreensível em vez do erro cru de not-null constraint.
  IF extracted_phone IS NULL OR extracted_phone = '' THEN
    RAISE EXCEPTION 'Telefone é obrigatório para completar o cadastro.'
      USING ERRCODE = 'ART01';
  END IF;

  -- Validação explícita 2: telefone já usado por outra conta
  -- (clients_telefone_key é UNIQUE).
  IF EXISTS (
    SELECT 1 FROM public.clients
    WHERE telefone = extracted_phone AND auth_id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Este telefone já está cadastrado em outra conta.'
      USING ERRCODE = 'ART02';
  END IF;

  -- Validação explícita 3: e-mail já usado por outra conta
  -- (idx_clients_email_unique é UNIQUE em lower(email) quando não nulo).
  IF extracted_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clients
    WHERE lower(email) = lower(extracted_email) AND auth_id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Este e-mail já está cadastrado em outra conta.'
      USING ERRCODE = 'ART03';
  END IF;

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

  BEGIN
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
  EXCEPTION
    WHEN unique_violation THEN
      -- Rede de segurança para condição de corrida entre as checagens
      -- acima e o insert (duas requisições concorrentes com o mesmo
      -- telefone/e-mail). Nunca deixa o conflito passar silenciosamente.
      RAISE EXCEPTION 'Telefone ou e-mail já cadastrado em outra conta.'
        USING ERRCODE = 'ART04';
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS
  'Auto-creates/updates a clients row from auth.users on signup. Skips when legacy_migration flag is set (create-user Edge Function handles clients itself). Validates telefone (required, unique) and email (unique) explicitly before insert, raising custom SQLSTATEs ART01-ART04 for friendly frontend error messages. Residual unique-violation race conditions are caught as a fallback.';
