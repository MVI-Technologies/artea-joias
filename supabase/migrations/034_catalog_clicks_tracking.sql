-- =====================================================
-- MIGRATION 034: Tracking de Cliques em Catálogos
-- =====================================================

-- Tabela para rastrear cliques em catálogos
CREATE TABLE IF NOT EXISTS catalog_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    -- Para rastrear cliques de usuários não autenticados ou sem client_id
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir que todas as colunas existam (caso a tabela já tenha sido criada)
DO $$ 
BEGIN
    -- Adicionar colunas se não existirem (para compatibilidade com versões anteriores)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_clicks' AND column_name = 'session_id') THEN
        ALTER TABLE catalog_clicks ADD COLUMN session_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_clicks' AND column_name = 'ip_address') THEN
        ALTER TABLE catalog_clicks ADD COLUMN ip_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_clicks' AND column_name = 'user_agent') THEN
        ALTER TABLE catalog_clicks ADD COLUMN user_agent TEXT;
    END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_catalog_clicks_lot ON catalog_clicks(lot_id);
CREATE INDEX IF NOT EXISTS idx_catalog_clicks_client ON catalog_clicks(client_id);
CREATE INDEX IF NOT EXISTS idx_catalog_clicks_created ON catalog_clicks(created_at);
CREATE INDEX IF NOT EXISTS idx_catalog_clicks_lot_client ON catalog_clicks(lot_id, client_id);

-- RLS
ALTER TABLE catalog_clicks ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes (se houver) para recriar
DROP POLICY IF EXISTS "Admins podem ver todos os cliques" ON catalog_clicks;
DROP POLICY IF EXISTS "Clientes podem ver seus próprios cliques" ON catalog_clicks;
DROP POLICY IF EXISTS "Permitir inserção de cliques" ON catalog_clicks;

-- Admins podem ver todos os cliques
CREATE POLICY "Admins podem ver todos os cliques"
    ON catalog_clicks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- Clientes podem ver seus próprios cliques (opcional)
CREATE POLICY "Clientes podem ver seus próprios cliques"
    ON catalog_clicks FOR SELECT
    USING (
        client_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
    );

-- Permitir inserção de cliques (todos, incluindo não autenticados)
CREATE POLICY "Permitir inserção de cliques"
    ON catalog_clicks FOR INSERT
    TO public
    WITH CHECK (true);

COMMENT ON TABLE catalog_clicks IS 'Rastreamento de cliques em catálogos (lots)';
