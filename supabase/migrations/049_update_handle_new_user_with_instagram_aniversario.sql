-- =====================================================
-- MIGRATION 049: UPDATE handle_new_user FUNCTION
-- Atualiza a função para incluir instagram e aniversario
-- =====================================================

-- Atualizar apenas a função handle_new_user para incluir os novos campos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  extracted_phone TEXT;
BEGIN
  -- Extract phone from email if it's in format phone@artea.local
  IF NEW.email LIKE '%@artea.local' THEN
    extracted_phone := REPLACE(SPLIT_PART(NEW.email, '@', 1), ' ', '');
  ELSE
    extracted_phone := NEW.phone;
  END IF;

  -- Create client record automatically
  INSERT INTO public.clients (
    auth_id,
    nome,
    telefone,
    email,
    instagram,
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
    CASE 
      WHEN NEW.raw_user_meta_data->>'data_nascimento' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'data_nascimento')::DATE
      ELSE NULL
    END,
    'cliente',
    false, -- Aguardando aprovação do admin
    'pendente', -- Status inicial pendente
    NOW()
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, clients.email),
    telefone = EXCLUDED.telefone,
    instagram = COALESCE(EXCLUDED.instagram, clients.instagram),
    aniversario = COALESCE(EXCLUDED.aniversario, clients.aniversario),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification
SELECT 'Migration 049 applied: handle_new_user function updated with instagram and aniversario' as status;
