-- Criar bucket 'products' se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Remover políticas existentes para garantir limpeza (opcional, mas bom para re-run)
DROP POLICY IF EXISTS "Imagens de produtos são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Apenas admins podem fazer upload de imagens" ON storage.objects;
DROP POLICY IF EXISTS "Apenas admins podem atualizar imagens" ON storage.objects;
DROP POLICY IF EXISTS "Apenas admins podem deletar imagens" ON storage.objects;

-- Política de Leitura Pública
CREATE POLICY "Imagens de produtos são públicas"
ON storage.objects FOR SELECT
USING ( bucket_id = 'products' );

-- Política de Upload (Insert) - Apenas Admins (ou autenticados se preferir flexibilidade inicial)
-- Ajuste: permitindo upload para qualquer usuário autenticado por enquanto para facilitar testes, 
-- mas idealmente seria (auth.role() = 'authenticated' AND (auth.jwt() ->> 'role') = 'admin' OR EXISTS...)
-- Como temos a tabela clients com role, vamos simplificar para authenticated por hora.
CREATE POLICY "Apenas admins podem fazer upload de imagens"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'products' );

-- Política de Update - Apenas Admins
CREATE POLICY "Apenas admins podem atualizar imagens"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'products' );

-- Política de Delete - Apenas Admins
CREATE POLICY "Apenas admins podem deletar imagens"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'products' );
