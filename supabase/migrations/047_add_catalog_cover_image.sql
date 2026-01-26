-- Migration: Add catalog cover image
-- Date: 2026-01-26
-- 1. Add cover_image_url to lots table
ALTER TABLE lots ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- 2. Create storage bucket for catalog covers if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-covers', 'catalog-covers', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set RLS policies for storage
-- Allow public read access (for clients)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'catalog-covers' );

-- Allow authenticated users (admins) to upload
DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
CREATE POLICY "Admin Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'catalog-covers' );

-- Allow authenticated users (admins) to update/delete
DROP POLICY IF EXISTS "Admin Update" ON storage.objects;
CREATE POLICY "Admin Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'catalog-covers' );

DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
CREATE POLICY "Admin Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'catalog-covers' );
