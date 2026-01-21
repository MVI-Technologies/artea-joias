-- =====================================================
-- MARKETING: Campanhas, Cupons, Vale-Presente, Kits
-- Sistema de Semijoias - Artea Joias
-- =====================================================

-- =====================================================
-- TABELA: marketing_campaigns (Campanhas)
-- =====================================================
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descricao TEXT,
    desconto_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'agendada' CHECK (status IN ('ativa', 'agendada', 'encerrada')),
    
    -- Aplicável a
    aplicavel_produtos UUID[] DEFAULT '{}',  -- IDs de produtos
    aplicavel_categorias UUID[] DEFAULT '{}', -- IDs de categorias
    aplicavel_colecoes UUID[] DEFAULT '{}',   -- IDs de coleções
    aplicavel_kits UUID[] DEFAULT '{}',       -- IDs de kits
    
    -- Regras
    margem_minima_pct NUMERIC(5,2) DEFAULT 0, -- Não quebrar essa margem
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON marketing_campaigns(data_inicio, data_fim);

-- Trigger updated_at
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON marketing_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar campanhas"
    ON marketing_campaigns FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

CREATE POLICY "Campanhas ativas são visíveis"
    ON marketing_campaigns FOR SELECT
    USING (status = 'ativa');

-- =====================================================
-- TABELA: coupons (Cupons)
-- =====================================================
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT NOT NULL UNIQUE,
    descricao TEXT,
    
    -- Tipo de desconto
    tipo TEXT NOT NULL CHECK (tipo IN ('percentual', 'valor_fixo')),
    valor NUMERIC(10,2) NOT NULL, -- % ou R$
    
    -- Validade
    data_validade TIMESTAMPTZ,
    
    -- Limites
    limite_uso_total INT, -- NULL = ilimitado
    limite_uso_cliente INT DEFAULT 1,
    usos_atuais INT DEFAULT 0,
    
    -- Status
    ativo BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_coupons_codigo ON coupons(codigo);
CREATE INDEX IF NOT EXISTS idx_coupons_ativo ON coupons(ativo);

-- Trigger updated_at
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar cupons"
    ON coupons FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- =====================================================
-- TABELA: gift_cards (Vale-Presente)
-- =====================================================
CREATE TABLE IF NOT EXISTS gift_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT NOT NULL UNIQUE,
    
    -- Valor
    valor_original NUMERIC(10,2) NOT NULL,
    saldo_atual NUMERIC(10,2) NOT NULL,
    
    -- Cliente destinatário
    cliente_id UUID REFERENCES clients(id),
    cliente_nome TEXT, -- Para quando não há cliente cadastrado
    
    -- Status
    ativo BOOLEAN DEFAULT true,
    data_validade TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_gift_cards_codigo ON gift_cards(codigo);
CREATE INDEX IF NOT EXISTS idx_gift_cards_cliente ON gift_cards(cliente_id);

-- Trigger updated_at
CREATE TRIGGER update_gift_cards_updated_at BEFORE UPDATE ON gift_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar vale-presentes"
    ON gift_cards FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

CREATE POLICY "Cliente vê seus vale-presentes"
    ON gift_cards FOR SELECT
    USING (
        cliente_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
    );

-- =====================================================
-- TABELA: kits (Kits de Produtos)
-- =====================================================
CREATE TABLE IF NOT EXISTS kits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descricao TEXT,
    imagem_url TEXT,
    
    -- Preço
    preco NUMERIC(10,2) NOT NULL,
    desconto_embutido NUMERIC(10,2) DEFAULT 0, -- Economia vs comprar separado
    
    -- Status
    ativo BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at
CREATE TRIGGER update_kits_updated_at BEFORE UPDATE ON kits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar kits"
    ON kits FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

CREATE POLICY "Kits ativos são visíveis"
    ON kits FOR SELECT
    USING (ativo = true);

-- =====================================================
-- TABELA: kit_items (Itens do Kit)
-- =====================================================
CREATE TABLE IF NOT EXISTS kit_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kit_id UUID NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantidade INT NOT NULL DEFAULT 1,
    
    UNIQUE(kit_id, product_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_kit_items_kit ON kit_items(kit_id);

-- RLS
ALTER TABLE kit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar itens de kit"
    ON kit_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

CREATE POLICY "Itens de kit são visíveis"
    ON kit_items FOR SELECT
    USING (true);

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'Tabelas de marketing criadas:' as info;
SELECT 'marketing_campaigns, coupons, gift_cards, kits, kit_items' as tabelas;
