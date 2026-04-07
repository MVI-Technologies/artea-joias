-- Fix: handle_new_user trigger was not reading or persisting the `cpf` field
-- from user metadata. The Register.jsx page stores it as `cpf` in metadata.
-- This migration updates the trigger to capture and save it correctly.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  extracted_phone TEXT;
BEGIN
  -- Skip auto-creation when flagged as a legacy migration (managed by Edge Function)
  IF NEW.raw_user_meta_data->>'legacy_migration' = 'true' THEN
    RETURN NEW;
  END IF;

  -- Extract phone from email if it's in format phone@artea.local
  IF NEW.email LIKE '%@artea.local' THEN
    extracted_phone := REPLACE(SPLIT_PART(NEW.email, '@', 1), ' ', '');
  ELSE
    extracted_phone := NEW.phone;
  END IF;

  -- Create client record automatically, now including the cpf field
  INSERT INTO public.clients (
    auth_id,
    nome,
    telefone,
    email,
    instagram,
    cpf,
    aniversario,
    role,
    approved,
    cadastro_status,
    created_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', 'Novo Cliente'),
    extracted_phone,
    COALESCE(NEW.raw_user_meta_data->>'email_real', NEW.email),
    NEW.raw_user_meta_data->>'instagram',
    -- CPF is stored as 'cpf' in user_metadata (digits only)
    NEW.raw_user_meta_data->>'cpf',
    CASE
      WHEN NEW.raw_user_meta_data->>'data_nascimento' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'data_nascimento')::DATE
      ELSE NULL
    END,
    'cliente',
    false, -- Awaiting admin approval
    'pendente',
    NOW()
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email       = COALESCE(EXCLUDED.email, clients.email),
    telefone    = EXCLUDED.telefone,
    instagram   = COALESCE(EXCLUDED.instagram, clients.instagram),
    cpf         = COALESCE(EXCLUDED.cpf, clients.cpf),
    aniversario = COALESCE(EXCLUDED.aniversario, clients.aniversario),
    updated_at  = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS
  'Auto-creates a client record on signup. Reads cpf_cnpj from user_metadata and persists it to clients.cpf.';
