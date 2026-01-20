-- =====================================================
-- Role Sync: Sync role from clients table to Supabase Auth metadata
-- =====================================================
-- This ensures role is always available in session metadata
-- for instant access without database queries

-- Function to sync role to auth metadata
CREATE OR REPLACE FUNCTION sync_user_role_to_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update Supabase Auth user metadata when role changes in clients table
  UPDATE auth.users
  SET raw_user_meta_data = 
    jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(NEW.role)
    )
  WHERE id = NEW.auth_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically sync role on INSERT or UPDATE
CREATE TRIGGER sync_role_on_client_change
  AFTER INSERT OR UPDATE OF role ON clients
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_role_to_metadata();

-- =====================================================
-- Backfill: Sync existing users' roles to metadata
-- =====================================================
-- Run this once to update all existing users

UPDATE auth.users u
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  to_jsonb(c.role)
)
FROM clients c
WHERE u.id = c.auth_id
  AND (raw_user_meta_data->>'role' IS NULL OR raw_user_meta_data->>'role' != c.role);

-- Verify the sync worked
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'role' as metadata_role,
  c.role as db_role,
  c.nome
FROM auth.users u
JOIN clients c ON u.id = c.auth_id
LIMIT 10;
