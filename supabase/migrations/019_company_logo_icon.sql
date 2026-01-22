-- Add logo and icon columns to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('company', 'company', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company bucket
CREATE POLICY "Public Access company"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company');

CREATE POLICY "Admins can upload company assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company' AND
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "Admins can update company assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company' AND
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "Admins can delete company assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company' AND
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);
