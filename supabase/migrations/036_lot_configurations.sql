-- =====================================================
-- MIGRATION 036: LOT CONFIGURATIONS
-- Adiciona campos de configuração para catálogos em grupo de compras
-- =====================================================

-- =====================================================
-- 1. ADICIONAR CAMPOS DE CONFIGURAÇÃO NA TABELA LOTS
-- =====================================================

-- Exigir preenchimento dos dados da galvânica
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS exigir_dados_galvanica BOOLEAN DEFAULT false;

-- Configuração de marca d'água
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS adicionar_marca_agua BOOLEAN DEFAULT false;

-- Dados para o pagamento (texto livre ou referência a payment_option)
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS dados_pagamento TEXT;

-- ID da opção de pagamento selecionada (opcional, se usar tabela de opções)
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS payment_option_id UUID;

-- Permitir cliente reduzir e excluir produtos antes do fechamento
-- Valores: 'permitir_reduzir_excluir', 'nao_permitir', 'permitir_reduzir_nao_excluir'
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS permitir_modificacao_produtos TEXT DEFAULT 'permitir_reduzir_excluir'
CHECK (permitir_modificacao_produtos IN ('permitir_reduzir_excluir', 'nao_permitir', 'permitir_reduzir_nao_excluir'));

-- =====================================================
-- 2. CRIAR TABELA: payment_options (Opções de Pagamento)
-- =====================================================

CREATE TABLE IF NOT EXISTS payment_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descricao TEXT NOT NULL, -- Ex: "PIX: CPF 37497876844 Caio Vinícius Puiani - Itaú S/A CARTÃO DE CRÉDITO (com taxas): Via Link"
    tipo TEXT NOT NULL CHECK (tipo IN ('pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outro')),
    dados_config JSONB, -- Configurações específicas (chave PIX, link, etc)
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payment_options_ativo ON payment_options(ativo);
CREATE INDEX IF NOT EXISTS idx_payment_options_tipo ON payment_options(tipo);

-- RLS para payment_options
ALTER TABLE payment_options ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Apenas admins podem gerenciar opções de pagamento
CREATE POLICY "Admins podem ver opções de pagamento"
    ON payment_options FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admins podem criar opções de pagamento"
    ON payment_options FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admins podem atualizar opções de pagamento"
    ON payment_options FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admins podem deletar opções de pagamento"
    ON payment_options FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Foreign key para payment_option_id em lots
ALTER TABLE lots 
ADD CONSTRAINT fk_lots_payment_option 
FOREIGN KEY (payment_option_id) 
REFERENCES payment_options(id) 
ON DELETE SET NULL;

-- =====================================================
-- 3. COMENTÁRIOS
-- =====================================================

COMMENT ON COLUMN lots.exigir_dados_galvanica IS 'Se true, exige preenchimento dos dados da galvânica ao criar pedido';
COMMENT ON COLUMN lots.adicionar_marca_agua IS 'Se true, adiciona marca d''água em todos os produtos do catálogo';
COMMENT ON COLUMN lots.dados_pagamento IS 'Texto livre com dados de pagamento ou descrição da opção selecionada';
COMMENT ON COLUMN lots.payment_option_id IS 'ID da opção de pagamento selecionada (opcional)';
COMMENT ON COLUMN lots.permitir_modificacao_produtos IS 'Controla se cliente pode reduzir/excluir produtos antes do fechamento';

COMMENT ON TABLE payment_options IS 'Opções de pagamento disponíveis para seleção nos catálogos';
COMMENT ON COLUMN payment_options.descricao IS 'Descrição completa da opção de pagamento (exibida no modal de seleção)';
COMMENT ON COLUMN payment_options.dados_config IS 'Configurações específicas em JSON (chave PIX, link de pagamento, etc)';

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 'Migration 036 applied successfully!' as status;
SELECT 'New columns added to lots table' as feature1;
SELECT 'Payment options table created' as feature2;
