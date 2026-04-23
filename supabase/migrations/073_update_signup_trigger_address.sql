-- Update the handle_new_user function to automatically extract and save the 
-- structured address from the registration form into the clients table's enderecos JSON array.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  extracted_phone TEXT;
  extracted_endereco JSONB;
BEGIN
  -- Extract phone from email if it's in format phone@artea.local
  IF NEW.email LIKE '%@artea.local' THEN
    extracted_phone := REPLACE(SPLIT_PART(NEW.email, '@', 1), ' ', '');
  ELSE
    extracted_phone := NEW.phone;
  END IF;

  -- Build the address JSON object if the address field exists in metadata
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

  -- Create client record automatically
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
    COALESCE(NEW.raw_user_meta_data->>'email_real', NEW.email),
    NEW.raw_user_meta_data->>'instagram',
    NEW.raw_user_meta_data->>'cpf',
    CASE 
      WHEN NEW.raw_user_meta_data->>'data_nascimento' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'data_nascimento')::DATE
      ELSE NULL
    END,
    extracted_endereco,
    'cliente',
    false, -- Aguardando aprovação do admin
    'pendente', -- Status inicial pendente
    NOW()
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, clients.email),
    telefone = EXCLUDED.telefone,
    instagram = COALESCE(EXCLUDED.instagram, clients.instagram),
    cpf = COALESCE(EXCLUDED.cpf, clients.cpf),
    aniversario = COALESCE(EXCLUDED.aniversario, clients.aniversario),
    enderecos = COALESCE(EXCLUDED.enderecos, clients.enderecos),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
