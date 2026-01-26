-- Auto-create client record when user signs up
-- This prevents "client not found" errors in checkout and other flows

-- Function to auto-create client from auth user
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
    role,
    approved,
    cadastro_status,
    created_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Novo Cliente'),
    extracted_phone,
    NEW.email,
    'cliente',
    false, -- Aguardando aprovação do admin
    'pendente', -- Status inicial pendente
    NOW()
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    telefone = EXCLUDED.telefone,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also handle the existing orphaned user (if not already exists)
INSERT INTO public.clients (
    auth_id,
    nome,
    telefone,
    email,
    role,
    approved,
    cadastro_status
)
SELECT 
    id as auth_id,
    COALESCE(raw_user_meta_data->>'name', 'Cliente Teste') as nome,
    CASE 
        WHEN email LIKE '%@artea.local' THEN REPLACE(SPLIT_PART(email, '@', 1), ' ', '')
        ELSE phone
    END as telefone,
    email,
    'cliente' as role,
    true as approved,
    'completo' as cadastro_status
FROM auth.users
WHERE id NOT IN (SELECT auth_id FROM public.clients WHERE auth_id IS NOT NULL)
ON CONFLICT (auth_id) DO NOTHING;

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates a client record when a user signs up to prevent orphaned auth users';
