-- Fix specific client approval status
-- Client ID: e44aa4a4-1adc-4908-b392-bb87faff95b5

-- 1. Check current status
SELECT 
    id,
    auth_id,
    nome,
    telefone,
    role,
    approved,
    cadastro_status,
    created_at
FROM clients
WHERE auth_id = 'e44aa4a4-1adc-4908-b392-bb87faff95b5';

-- 2. Approve this client
UPDATE clients
SET 
    approved = true,
    cadastro_status = 'completo',
    updated_at = NOW()
WHERE auth_id = 'e44aa4a4-1adc-4908-b392-bb87faff95b5';

-- 3. Verify the update
SELECT 
    id,
    auth_id,
    nome,
    telefone,
    role,
    approved,
    cadastro_status
FROM clients
WHERE auth_id = 'e44aa4a4-1adc-4908-b392-bb87faff95b5';

-- Success message
SELECT 'Cliente aprovado com sucesso! Agora ele pode fazer login.' as status;
