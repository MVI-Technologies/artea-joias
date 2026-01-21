-- =====================================================
-- CORREÇÕES CRÍTICAS: Products e Estrutura
-- Sistema Artea Joias
-- =====================================================

-- =====================================================
-- 1. CORRIGIR TABELA PRODUCTS
-- =====================================================

-- Remover constraint NOT NULL de custo para permitir produtos sem custo definido
ALTER TABLE products ALTER COLUMN custo DROP NOT NULL;
ALTER TABLE products ALTER COLUMN custo SET DEFAULT 0;

-- Adicionar campo tipo_venda se não existir
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS tipo_venda TEXT DEFAULT 'individual' 
CHECK (tipo_venda IN ('individual', 'pacote'));

-- Adicionar campo quantidade_pacote se não existir
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS quantidade_pacote INT DEFAULT 12;

-- Adicionar campo código interno opcional
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS codigo_interno TEXT;

-- Adicionar campo estoque se não existir
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS estoque INT DEFAULT 0;

-- =====================================================
-- 2. CORRIGIR COLUNA PREÇO (IMPORTANTE)
-- O campo 'preco' foi criado como GENERATED ALWAYS.
-- Precisamos convertê-lo para uma coluna comum para permitir edição manual.
-- =====================================================
DO $$
BEGIN
    -- Verificar se é uma coluna gerada e remover a expressão
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'preco' 
        AND is_generated = 'ALWAYS'
    ) THEN
        ALTER TABLE products ALTER COLUMN preco DROP EXPRESSION;
    END IF;
END $$;

-- Garantir que preço não é nulo e tem default 0
ALTER TABLE products ALTER COLUMN preco SET DEFAULT 0;

-- =====================================================
-- 3. FUNÇÕES AUXILIARES
-- =====================================================

-- Criar função para calcular preço com margem (uso manual se necessário)
CREATE OR REPLACE FUNCTION calculate_product_price(product_custo NUMERIC, product_margem NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
    IF product_custo IS NULL OR product_custo = 0 THEN
        RETURN 0;
    END IF;
    RETURN product_custo * (1 + COALESCE(product_margem, 10) / 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 4. AUTOMAÇÃO DE CAMPANHAS
-- =====================================================
CREATE OR REPLACE FUNCTION update_campaign_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar para 'ativa' se data_inicio passou e data_fim não
    IF NEW.data_inicio <= NOW() AND NEW.data_fim > NOW() THEN
        NEW.status := 'ativa';
    -- Atualizar para 'encerrada' se data_fim passou
    ELSIF NEW.data_fim <= NOW() THEN
        NEW.status := 'encerrada';
    -- Manter como 'agendada' se data_inicio ainda não chegou
    ELSE
        NEW.status := 'agendada';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para campanhas
DROP TRIGGER IF EXISTS update_campaign_status_trigger ON marketing_campaigns;
CREATE TRIGGER update_campaign_status_trigger
    BEFORE INSERT OR UPDATE ON marketing_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_status();

-- =====================================================
-- 5. VALIDAÇÃO DE CUPONS
-- =====================================================
CREATE OR REPLACE FUNCTION validate_coupon(
    p_codigo TEXT,
    p_client_id UUID
) RETURNS TABLE (
    valid BOOLEAN,
    message TEXT,
    coupon_id UUID,
    discount_type TEXT,
    discount_value NUMERIC
) AS $$
DECLARE
    v_coupon RECORD;
BEGIN
    -- Buscar cupom
    SELECT * INTO v_coupon 
    FROM coupons 
    WHERE codigo = UPPER(p_codigo) AND ativo = true;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Cupom não encontrado'::TEXT, NULL::UUID, NULL::TEXT, NULL::NUMERIC;
        RETURN;
    END IF;
    
    -- Verificar validade
    IF v_coupon.data_validade IS NOT NULL AND v_coupon.data_validade < NOW() THEN
        RETURN QUERY SELECT false, 'Cupom expirado'::TEXT, NULL::UUID, NULL::TEXT, NULL::NUMERIC;
        RETURN;
    END IF;
    
    -- Verificar limite total
    IF v_coupon.limite_uso_total IS NOT NULL AND v_coupon.usos_atuais >= v_coupon.limite_uso_total THEN
        RETURN QUERY SELECT false, 'Limite de uso atingido'::TEXT, NULL::UUID, NULL::TEXT, NULL::NUMERIC;
        RETURN;
    END IF;
    
    -- Cupom válido
    RETURN QUERY SELECT 
        true, 
        'Cupom válido'::TEXT, 
        v_coupon.id, 
        v_coupon.tipo, 
        v_coupon.valor;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. ÍNDICES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_products_ativo ON products(ativo);
CREATE INDEX IF NOT EXISTS idx_lots_status ON lots(status);

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'Migration 011 aplicada com sucesso' as status;
SELECT 'Coluna preco convertida para editavel' as fix_preco;
SELECT 'Novas colunas adicionadas' as fix_cols;
