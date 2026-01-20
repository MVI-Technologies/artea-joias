-- =====================================================
-- FASE 1: Estrutura de Dados Completa
-- Sistema de Semijoias - Compras Coletivas
-- =====================================================

-- =====================================================
-- TABELA: banhos (Tipos de Banho)
-- =====================================================
CREATE TABLE IF NOT EXISTS banhos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    cor_hex TEXT, -- Para exibição visual
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dados iniciais de banhos
INSERT INTO banhos (nome, descricao, cor_hex) VALUES 
    ('Ouro 18k', 'Banho de ouro 18 quilates', '#FFD700'),
    ('Ouro Rosé', 'Banho de ouro rosé', '#B76E79'),
    ('Ródio', 'Banho de ródio (prata brilhante)', '#E8E8E8'),
    ('Prata', 'Banho de prata 925', '#C0C0C0'),
    ('Aço Inox', 'Aço inoxidável cirúrgico', '#71797E'),
    ('Ródio Negro', 'Ródio negro grafite', '#36454F')
ON CONFLICT (nome) DO NOTHING;

-- =====================================================
-- TABELA: colecoes (Coleções de Produtos)
-- =====================================================
CREATE TABLE IF NOT EXISTS colecoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descricao TEXT,
    imagem TEXT,
    data_lancamento DATE,
    data_fim DATE, -- Opcional: coleção sazonal
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dados iniciais de coleções
INSERT INTO colecoes (nome, descricao) VALUES 
    ('Verão 2025', 'Coleção Verão com peças leves e coloridas'),
    ('Clássicos', 'Peças atemporais que nunca saem de moda'),
    ('Minimalista', 'Design clean e elegante'),
    ('Festa', 'Peças para ocasiões especiais')
ON CONFLICT DO NOTHING;

-- =====================================================
-- AJUSTES NA TABELA: products
-- =====================================================

-- Adicionar coluna de banho
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS banho_id UUID REFERENCES banhos(id);

-- Adicionar coluna de coleção
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS colecao_id UUID REFERENCES colecoes(id);

-- Tipo de venda (unitário ou pacote)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS tipo_venda TEXT DEFAULT 'unitario' 
CHECK (tipo_venda IN ('unitario', 'pacote'));

-- Quantidade por pacote (se tipo_venda = 'pacote')
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS quantidade_pacote INT DEFAULT 1;

-- Código SKU único
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS codigo_sku TEXT;

-- Peso em gramas (para cálculo de frete)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS peso_gramas NUMERIC(8,2) DEFAULT 10;

-- =====================================================
-- TABELA: romaneios (Romaneios de Separação)
-- =====================================================
CREATE TABLE IF NOT EXISTS romaneios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_id UUID REFERENCES lots(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    numero_romaneio TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'gerado' 
        CHECK (status IN ('gerado', 'separando', 'conferido', 'embalado', 'enviado', 'entregue')),
    total_itens INT DEFAULT 0,
    subtotal NUMERIC(10,2) DEFAULT 0,
    frete NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) DEFAULT 0,
    modalidade_frete TEXT, -- 'PAC', 'SEDEX', 'retirada'
    codigo_rastreio TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lot_id, client_id)
);

-- =====================================================
-- AJUSTES NA TABELA: lots (Grupos de Compra)
-- =====================================================

-- Fechamento automático
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS fechamento_automatico BOOLEAN DEFAULT true;

-- Notificar clientes quando fechar
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS notificar_ao_fechar BOOLEAN DEFAULT true;

-- Imagem de capa do link
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS imagem_capa TEXT;

-- Mensagem personalizada
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS mensagem TEXT;

-- =====================================================
-- AJUSTES NA TABELA: orders (Pedidos)
-- =====================================================

-- Referência ao romaneio
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS romaneio_id UUID REFERENCES romaneios(id);

-- =====================================================
-- FUNÇÃO: Gerar número de romaneio
-- =====================================================
CREATE OR REPLACE FUNCTION generate_romaneio_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'ROM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
           LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Gerar romaneios ao fechar grupo
-- =====================================================
CREATE OR REPLACE FUNCTION generate_romaneios_on_lot_close()
RETURNS TRIGGER AS $$
BEGIN
    -- Só executa quando status muda para 'fechado'
    IF NEW.status = 'fechado' AND OLD.status = 'aberto' THEN
        -- Gerar romaneio para cada cliente que tem pedidos neste lote
        INSERT INTO romaneios (lot_id, client_id, numero_romaneio, total_itens, subtotal, total)
        SELECT 
            NEW.id,
            o.client_id,
            generate_romaneio_number(),
            SUM(o.quantidade),
            SUM(o.valor_total),
            SUM(o.valor_total) -- Total sem frete inicialmente
        FROM orders o
        WHERE o.lot_id = NEW.id AND o.status != 'cancelado'
        GROUP BY o.client_id
        ON CONFLICT (lot_id, client_id) DO UPDATE SET
            total_itens = EXCLUDED.total_itens,
            subtotal = EXCLUDED.subtotal,
            total = EXCLUDED.total,
            updated_at = NOW();
        
        -- Atualizar referência do romaneio nos pedidos
        UPDATE orders o
        SET romaneio_id = r.id
        FROM romaneios r
        WHERE o.lot_id = NEW.id 
          AND o.client_id = r.client_id 
          AND r.lot_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS generate_romaneios_trigger ON lots;
CREATE TRIGGER generate_romaneios_trigger
    AFTER UPDATE ON lots
    FOR EACH ROW
    EXECUTE FUNCTION generate_romaneios_on_lot_close();

-- =====================================================
-- TRIGGER: Fechamento automático por quantidade
-- =====================================================
CREATE OR REPLACE FUNCTION check_lot_auto_close()
RETURNS TRIGGER AS $$
DECLARE
    lot_record RECORD;
    total_pedidos INT;
BEGIN
    -- Buscar dados do lote
    SELECT * INTO lot_record FROM lots WHERE id = NEW.lot_id;
    
    -- Verificar se fechamento automático está ativo
    IF lot_record.fechamento_automatico = true AND lot_record.status = 'aberto' THEN
        -- Calcular total de pedidos para este produto
        SELECT COALESCE(SUM(quantidade_pedidos), 0) INTO total_pedidos
        FROM lot_products
        WHERE lot_id = NEW.lot_id;
        
        -- Verificar se atingiu quantidade mínima
        IF total_pedidos >= lot_record.quantidade_minima THEN
            UPDATE lots SET status = 'fechado', updated_at = NOW()
            WHERE id = NEW.lot_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS check_auto_close_trigger ON lot_products;
CREATE TRIGGER check_auto_close_trigger
    AFTER UPDATE ON lot_products
    FOR EACH ROW
    EXECUTE FUNCTION check_lot_auto_close();

-- =====================================================
-- RLS: Ocultar custo e margem de clientes
-- =====================================================

-- Criar view específica para clientes (sem custo/margem)
CREATE OR REPLACE VIEW products_client_view AS
SELECT 
    id,
    nome,
    descricao,
    categoria_id,
    banho_id,
    colecao_id,
    imagem1,
    imagem2,
    preco, -- Preço final apenas
    tipo_venda,
    quantidade_pacote,
    ativo,
    created_at
FROM products
WHERE ativo = true;

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_products_banho ON products(banho_id);
CREATE INDEX IF NOT EXISTS idx_products_colecao ON products(colecao_id);
CREATE INDEX IF NOT EXISTS idx_products_categoria ON products(categoria_id);
CREATE INDEX IF NOT EXISTS idx_romaneios_lot ON romaneios(lot_id);
CREATE INDEX IF NOT EXISTS idx_romaneios_client ON romaneios(client_id);
CREATE INDEX IF NOT EXISTS idx_romaneios_status ON romaneios(status);

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'Banhos criados:' as info, COUNT(*) as total FROM banhos;
SELECT 'Coleções criadas:' as info, COUNT(*) as total FROM colecoes;
SELECT 'Novas colunas em products:' as info, 
       'banho_id, colecao_id, tipo_venda, quantidade_pacote, codigo_sku, peso_gramas' as colunas;
