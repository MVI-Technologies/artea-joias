-- =====================================================
-- MIGRATION 035: Códigos de Recuperação de Senha
-- =====================================================

-- Tabela para armazenar códigos de recuperação de senha
CREATE TABLE IF NOT EXISTS password_reset_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    telefone TEXT NOT NULL,
    code TEXT NOT NULL, -- Código de 6 dígitos
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_client ON password_reset_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_telefone ON password_reset_codes(telefone);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_code ON password_reset_codes(code);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires ON password_reset_codes(expires_at);

-- RLS
ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode inserir código (para recuperação)
CREATE POLICY "Permitir inserção de códigos de recuperação"
    ON password_reset_codes FOR INSERT
    TO public
    WITH CHECK (true);

-- Política: Qualquer um pode ver códigos não usados e não expirados (para validação)
CREATE POLICY "Permitir leitura de códigos válidos"
    ON password_reset_codes FOR SELECT
    TO public
    USING (used = FALSE AND expires_at > NOW());

-- Política: Qualquer um pode atualizar código para marcá-lo como usado
CREATE POLICY "Permitir atualização de códigos"
    ON password_reset_codes FOR UPDATE
    TO public
    USING (used = FALSE AND expires_at > NOW())
    WITH CHECK (true);

-- Função para limpar códigos expirados (executar periodicamente)
CREATE OR REPLACE FUNCTION cleanup_expired_reset_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_codes 
    WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE password_reset_codes IS 'Códigos temporários para recuperação de senha via WhatsApp';
