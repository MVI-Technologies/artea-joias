-- =====================================================
-- SCRIPT: Create Auth Users for Existing Clients
-- Creates auth.users for clients without auth_id
-- Default password: 123456
-- =====================================================

-- IMPORTANT: This script should be run in Supabase SQL Editor
-- It will create auth users for all clients that don't have an auth_id

-- Step 1: Check how many clients need auth users
SELECT 
    id,
    nome,
    telefone,
    email,
    auth_id
FROM clients
WHERE auth_id IS NULL
AND telefone IS NOT NULL;

-- Step 2: For each client without auth_id, you need to:
-- Option A: Use Supabase Dashboard "Authentication" > "Add User" manually
-- Option B: Use the Admin API (requires code)
-- Option C: Create a temporary signup page

-- RECOMMENDED APPROACH: Use RPC function to create users programmatically
-- This function creates an auth user and links it to the client

CREATE OR REPLACE FUNCTION create_auth_for_existing_clients()
RETURNS TABLE(client_id BIGINT, telefone TEXT, status TEXT) AS $$
DECLARE
    client_record RECORD;
    new_user_id UUID;
    email_fake TEXT;
BEGIN
    -- Loop through all clients without auth_id
    FOR client_record IN 
        SELECT c.id, c.nome, c.telefone, c.email, c.role
        FROM clients c
        WHERE c.auth_id IS NULL 
        AND c.telefone IS NOT NULL
    LOOP
        -- Generate fake email from phone
        email_fake := client_record.telefone || '@artea.local';
        
        -- NOTE: Cannot directly insert into auth.users from SQL
        -- This requires using Supabase Admin API
        
        -- Return info for manual processing
        client_id := client_record.id;
        telefone := client_record.telefone;
        status := 'NEEDS_MANUAL_CREATION';
        
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run this to see which clients need auth users
SELECT * FROM create_auth_for_existing_clients();

-- =====================================================
-- MANUAL STEPS (Required)
-- =====================================================
-- Since creating auth.users requires Admin API, you need to either:
--
-- 1. Use Supabase Dashboard:
--    - Go to Authentication > Users > Add User
--    - For each client, create user with:
--      * Email: {telefone}@artea.local (ex: 11999999999@artea.local)
--      * Password: 123456
--      * Auto Confirm User: YES
--    - Then run: UPDATE clients SET auth_id = '{new_user_id}' WHERE id = {client_id};
--
-- 2. Use the signup endpoint (easiest):
--    - Create a temporary admin page that loops through clients
--    - Calls supabase.auth.admin.createUser() for each one
--
-- 3. Or use this Node.js script (run locally with supabase credentials):
--
-- const { createClient } = require('@supabase/supabase-js')
-- const supabase = createClient('YOUR_URL', 'YOUR_SERVICE_ROLE_KEY')
--
-- async function createUsers() {
--   const { data: clients } = await supabase
--     .from('clients')
--     .select('*')
--     .is('auth_id', null)
--     .not('telefone', 'is', null)
--   
--   for (const client of clients) {
--     const email = `${client.telefone}@artea.local`
--     
--     const { data: user, error } = await supabase.auth.admin.createUser({
--       email,
--       password: '123456',
--       email_confirm: true,
--       user_metadata: {
--         nome: client.nome,
--         telefone: client.telefone,
--         role: 'cliente'
--       }
--     })
--     
--     if (user) {
--       await supabase
--         .from('clients')
--         .update({ 
--           auth_id: user.id,
--           approved: true,
--           cadastro_status: 'completo'
--         })
--         .eq('id', client.id)
--       
--       console.log(`✅ Created user for ${client.nome}`)
--     } else {
--       console.error(`❌ Error for ${client.nome}:`, error)
--     }
--   }
-- }
--
-- createUsers()

-- =====================================================
-- CLEANUP
-- =====================================================
-- After creating users, verify all clients have auth_id:
SELECT 
    COUNT(*) as total_clients,
    COUNT(auth_id) as clients_with_auth,
    COUNT(*) - COUNT(auth_id) as clients_without_auth
FROM clients;
