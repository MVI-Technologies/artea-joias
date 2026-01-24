-- =====================================================
-- FREIGHT INTEGRATION & CALCULATIONS
-- Migration 023: Correios Integration Structure
-- =====================================================

-- =====================================================
-- 1. ADICIONAR CAMPOS DE INTEGRAÇÃO EM LOTS
-- =====================================================

-- Habilitar cálculo automático de frete
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS calculo_frete_automatico BOOLEAN DEFAULT false;

-- CEP de origem (remetente)
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS cep_origem TEXT;

-- Peso padrão por produto (em gramas) se não especificado
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS peso_padrao_gramas INT DEFAULT 50;

-- =====================================================
-- 2. ADICIONAR CAMPOS DE FRETE EM PRODUCTS
-- =====================================================

-- Peso do produto em gramas
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS peso_gramas INT DEFAULT 50;

-- Dimensões (cm) - para cálculo preciso de frete
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS altura_cm NUMERIC(5,2);

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS largura_cm NUMERIC(5,2);

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS comprimento_cm NUMERIC(5,2);

-- =====================================================
-- 3. TABELA: freight_calculations (Cache de Frete)
-- =====================================================
CREATE TABLE IF NOT EXISTS freight_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identificação
    romaneio_id UUID REFERENCES romaneios(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Endereço
    cep_destino TEXT NOT NULL,
    cep_origem TEXT NOT NULL,
    
    -- Peso total da encomenda
    peso_total_gramas INT NOT NULL,
    
    -- Dimensões da embalagem
    altura_cm NUMERIC(5,2),
    largura_cm NUMERIC(5,2),
    comprimento_cm NUMERIC(5,2),
    
    -- Valores calculados
    valor_frete NUMERIC(10,2) NOT NULL DEFAULT 0,
    prazo_entrega_dias INT,
    
    -- Método de envio
    metodo TEXT DEFAULT 'PAC' CHECK (metodo IN ('PAC', 'SEDEX', 'MANUAL')),
    
    -- Status da consulta
    calculo_manual BOOLEAN DEFAULT true,
    api_response JSONB,
    erro TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint para evitar duplicatas
    UNIQUE(romaneio_id)
);

CREATE INDEX IF NOT EXISTS idx_freight_romaneio ON freight_calculations(romaneio_id);
CREATE INDEX IF NOT EXISTS idx_freight_client ON freight_calculations(client_id);

-- =====================================================
-- 4. FUNÇÃO: Calcular Peso Total do Romaneio
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_romaneio_weight(p_romaneio_id UUID)
RETURNS INT AS $$
DECLARE
    v_total_weight INT := 0;
BEGIN
    SELECT COALESCE(SUM(o.quantidade * COALESCE(p.peso_gramas, 50)), 0)
    INTO v_total_weight
    FROM orders o
    JOIN products p ON p.id = o.product_id
    WHERE o.romaneio_id = p_romaneio_id;
    
    RETURN v_total_weight;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. FUNÇÃO: Calcular Frete (Placeholder para API)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_freight(
    p_romaneio_id UUID,
    p_cep_destino TEXT,
    p_metodo TEXT DEFAULT 'PAC'
) RETURNS NUMERIC AS $$
DECLARE
    v_peso_total INT;
    v_valor_base NUMERIC := 15.00;
    v_valor_por_kg NUMERIC := 5.00;
    v_cep_origem TEXT;
BEGIN
    -- Buscar peso total
    v_peso_total := calculate_romaneio_weight(p_romaneio_id);
    
    -- Buscar CEP de origem do lote
    SELECT COALESCE(l.cep_origem, cs.cep) INTO v_cep_origem
    FROM romaneios r
    LEFT JOIN lots l ON l.id = r.lot_id
    CROSS JOIN company_settings cs
    WHERE r.id = p_romaneio_id
    LIMIT 1;
    
    -- FÓRMULA SIMPLIFICADA (substituir por API Correios)
    -- Valor base + (peso em kg * valor por kg)
    RETURN v_valor_base + ((v_peso_total::NUMERIC / 1000) * v_valor_por_kg);
    
    -- TODO: Integrar com API Correios
    -- Exemplo de chamada:
    -- SELECT * FROM http_post(
    --     'https://api.correios.com.br/...',
    --     jsonb_build_object(
    --         'cepOrigem', v_cep_origem,
    --         'cepDestino', p_cep_destino,
    --         'peso', v_peso_total,
    --         'formato', 1
    --     )
    -- );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. TRIGGER: Atualizar Frete no Romaneio
-- =====================================================
CREATE OR REPLACE FUNCTION update_freight_on_romaneio()
RETURNS TRIGGER AS $$
DECLARE
    v_cep_destino TEXT;
    v_valor_frete NUMERIC;
    v_lot RECORD;
BEGIN
    -- Buscar configurações do lote
    SELECT 
        l.calculo_frete_automatico,
        l.cep_origem
    INTO v_lot
    FROM lots l
    WHERE l.id = NEW.lot_id;
    
    -- Só calcular se habilitado no lote
    IF NOT COALESCE(v_lot.calculo_frete_automatico, false) THEN
        RETURN NEW;
    END IF;
    
    -- Buscar endereço do cliente
    SELECT 
        COALESCE(
            (enderecos->0->>'cep')::TEXT,
            (enderecos->>0)::JSONB->>'cep'
        )
    INTO v_cep_destino
    FROM clients
    WHERE id = NEW.client_id;
    
    -- Se não tem CEP, não calcular
    IF v_cep_destino IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Calcular frete
    v_valor_frete := calculate_freight(NEW.id, v_cep_destino, 'PAC');
    
    -- Atualizar valor de frete no romaneio
    NEW.valor_frete := v_valor_frete;
    NEW.valor_total := COALESCE(NEW.valor_produtos, 0) + 
                       COALESCE(NEW.taxa_separacao, 0) + 
                       v_valor_frete;
    
    -- Registrar cálculo
    INSERT INTO freight_calculations (
        romaneio_id,
        client_id,
        cep_destino,
        cep_origem,
        peso_total_gramas,
        valor_frete,
        metodo,
        calculo_manual
    ) VALUES (
        NEW.id,
        NEW.client_id,
        v_cep_destino,
        v_lot.cep_origem,
        calculate_romaneio_weight(NEW.id),
        v_valor_frete,
        'PAC',
        true
    )
    ON CONFLICT (romaneio_id) DO UPDATE SET
        valor_frete = EXCLUDED.valor_frete,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_freight_on_romaneio ON romaneios;
CREATE TRIGGER calculate_freight_on_romaneio
    BEFORE INSERT OR UPDATE ON romaneios
    FOR EACH ROW
    EXECUTE FUNCTION update_freight_on_romaneio();

-- =====================================================
-- 7. RLS PARA FREIGHT_CALCULATIONS
-- =====================================================
ALTER TABLE freight_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access freight" ON freight_calculations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM clients 
            WHERE clients.auth_id = auth.uid() 
            AND clients.role = 'admin'
        )
    );

CREATE POLICY "Clients can view their freight" ON freight_calculations
    FOR SELECT USING (
        client_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
    );

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'Migration 023 aplicada com sucesso' as status;
SELECT 'Estrutura de frete criada' as freight_structure;
SELECT 'Funções de cálculo prontas para integração com API' as api_ready;
