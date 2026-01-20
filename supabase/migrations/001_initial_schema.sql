-- =====================================================
-- Artea Joias - Database Schema
-- Sistema de Compras Coletivas de Semijoias
-- =====================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABELA: clients (Clientes)
-- =====================================================
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL UNIQUE,
    email TEXT,
    aniversario DATE,
    enderecos JSONB DEFAULT '[]'::jsonb,
    estrelinhas INT DEFAULT 0,
    approved BOOLEAN DEFAULT false,
    role TEXT DEFAULT 'cliente' CHECK (role IN ('cliente', 'admin')),
    saldo_devedor NUMERIC(10,2) DEFAULT 0,
    credito_disponivel NUMERIC(10,2) DEFAULT 0,
    cadastro_status TEXT DEFAULT 'incompleto' CHECK (cadastro_status IN ('completo', 'incompleto', 'pendente')),
    grupo TEXT DEFAULT 'Grupo Compras',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: categories (Categorias de Produtos)
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: products (Produtos)
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descricao TEXT,
    categoria_id UUID REFERENCES categories(id),
    imagem1 TEXT,
    imagem2 TEXT,
    custo NUMERIC(10,2) NOT NULL,
    margem_pct NUMERIC(5,2) DEFAULT 10,
    preco NUMERIC(10,2) GENERATED ALWAYS AS (custo * (1 + margem_pct / 100)) STORED,
    quantidade_minima INT DEFAULT 1,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: lots (Lotes/Links de Compra Coletiva)
-- =====================================================
CREATE TABLE IF NOT EXISTS lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descricao TEXT,
    quantidade_minima INT DEFAULT 12,
    quantidade_atual INT DEFAULT 0,
    data_inicio TIMESTAMPTZ DEFAULT NOW(),
    data_fim TIMESTAMPTZ,
    status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado', 'preparacao', 'pago', 'enviado', 'concluido', 'cancelado')),
    link_compra TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: lot_products (Produtos do Lote - N:N)
-- =====================================================
CREATE TABLE IF NOT EXISTS lot_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_id UUID REFERENCES lots(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantidade_pedidos INT DEFAULT 0,
    quantidade_clientes INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lot_id, product_id)
);

-- =====================================================
-- TABELA: orders (Pedidos)
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_id UUID REFERENCES lots(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantidade INT NOT NULL DEFAULT 1,
    valor_unitario NUMERIC(10,2) NOT NULL,
    valor_total NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'em_preparacao', 'enviado', 'entregue', 'cancelado')),
    meio_pagamento TEXT,
    codigo_pagamento TEXT,
    codigo_rastreio TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: romaneios (Romaneios por Lote)
-- =====================================================
CREATE TABLE IF NOT EXISTS romaneios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_id UUID REFERENCES lots(id) ON DELETE CASCADE,
    dados JSONB NOT NULL,
    gerado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: notifications (Log de Notificações WhatsApp)
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    enviado BOOLEAN DEFAULT false,
    erro TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: gift_certificates (Vale-Presente)
-- =====================================================
CREATE TABLE IF NOT EXISTS gift_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    codigo TEXT UNIQUE NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    usado BOOLEAN DEFAULT false,
    usado_em TIMESTAMPTZ,
    validade DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: company_settings (Configurações da Empresa)
-- =====================================================
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_empresa TEXT NOT NULL,
    razao_social TEXT,
    cnpj_cpf TEXT,
    whatsapp TEXT,
    email TEXT,
    endereco TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    instagram TEXT,
    idioma TEXT DEFAULT 'Português',
    logo_url TEXT,
    icone_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_clients_telefone ON clients(telefone);
CREATE INDEX IF NOT EXISTS idx_clients_approved ON clients(approved);
CREATE INDEX IF NOT EXISTS idx_products_categoria ON products(categoria_id);
CREATE INDEX IF NOT EXISTS idx_products_ativo ON products(ativo);
CREATE INDEX IF NOT EXISTS idx_lots_status ON lots(status);
CREATE INDEX IF NOT EXISTS idx_lots_data_fim ON lots(data_fim);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_lot ON orders(lot_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE romaneios ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para CLIENTS
CREATE POLICY "Clientes podem ver seu próprio perfil"
    ON clients FOR SELECT
    USING (auth.uid() = auth_id);

CREATE POLICY "Clientes podem editar seu próprio perfil"
    ON clients FOR UPDATE
    USING (auth.uid() = auth_id);

CREATE POLICY "Admins podem ver todos os clientes"
    ON clients FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

CREATE POLICY "Admins podem editar todos os clientes"
    ON clients FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- Políticas para PRODUCTS (leitura pública, escrita admin)
CREATE POLICY "Produtos são visíveis para todos autenticados"
    ON products FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins podem gerenciar produtos"
    ON products FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- Políticas para CATEGORIES (leitura pública, escrita admin)
CREATE POLICY "Categorias são visíveis para todos autenticados"
    ON categories FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins podem gerenciar categorias"
    ON categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- Políticas para LOTS (leitura pública, escrita admin)
CREATE POLICY "Lotes são visíveis para todos autenticados"
    ON lots FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins podem gerenciar lotes"
    ON lots FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- Políticas para LOT_PRODUCTS
CREATE POLICY "Produtos do lote visíveis para todos autenticados"
    ON lot_products FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins podem gerenciar produtos do lote"
    ON lot_products FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- Políticas para ORDERS
CREATE POLICY "Clientes podem ver seus próprios pedidos"
    ON orders FOR SELECT
    USING (
        client_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Clientes podem criar seus próprios pedidos"
    ON orders FOR INSERT
    WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Admins podem gerenciar todos os pedidos"
    ON orders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- Políticas para ROMANEIOS (apenas admin)
CREATE POLICY "Admins podem gerenciar romaneios"
    ON romaneios FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- Políticas para NOTIFICATIONS
CREATE POLICY "Clientes podem ver suas notificações"
    ON notifications FOR SELECT
    USING (
        client_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Admins podem gerenciar notificações"
    ON notifications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- Políticas para GIFT_CERTIFICATES
CREATE POLICY "Clientes podem ver seus vales"
    ON gift_certificates FOR SELECT
    USING (
        client_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Admins podem gerenciar vales"
    ON gift_certificates FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- Políticas para COMPANY_SETTINGS (leitura pública, escrita admin)
CREATE POLICY "Configurações visíveis para todos autenticados"
    ON company_settings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins podem editar configurações"
    ON company_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- =====================================================
-- TRIGGERS para updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lots_updated_at BEFORE UPDATE ON lots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON company_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Inserir categorias padrão
INSERT INTO categories (nome) VALUES 
    ('Pulseira'),
    ('Conjunto'),
    ('Brinco'),
    ('Colar'),
    ('Anel'),
    ('Tornozeleira'),
    ('Piercing'),
    ('Outros')
ON CONFLICT (nome) DO NOTHING;

-- Inserir configurações padrão da empresa
INSERT INTO company_settings (nome_empresa, razao_social, whatsapp, email, cidade, estado, idioma)
VALUES ('ARTEA JOIAS', 'ARTEA JOIAS', '', '', '', '', 'Português')
ON CONFLICT DO NOTHING;
