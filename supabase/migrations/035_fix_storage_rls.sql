-- Create Permissive Storage Policies
-- This allows authenticated users to upload/modify/delete files
-- without complex role checks

-- Drop all existing policies
DROP POLICY IF EXISTS "Imagens de produtos são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Apenas admins podem fazer upload de imagens" ON storage.objects;
DROP POLICY IF EXISTS "Apenas admins podem atualizar imagens" ON storage.objects;
DROP POLICY IF EXISTS "Apenas admins podem deletar imagens" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete products" ON storage.objects;
DROP POLICY IF EXISTS "Public Access company" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload company assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update company assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete company assets" ON storage.objects;

-- Create permissive policies for all operations
-- Public read access
CREATE POLICY "Public can read all files"
ON storage.objects FOR SELECT
TO public
USING (true);

-- Authenticated users can do everything
CREATE POLICY "Authenticated can insert files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update files"
ON storage.objects FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (true);
