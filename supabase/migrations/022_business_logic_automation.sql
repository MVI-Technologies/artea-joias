-- =====================================================
-- BUSINESS LOGIC AUTOMATION
-- Migration 022: Automatic Closure & Product Rules
-- =====================================================

-- =====================================================
-- 1. ADICIONAR CAMPOS DE CONTROLE EM LOTS
-- =====================================================

-- Flag para permitir fechamento manual antes do prazo
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS permite_fechamento_manual BOOLEAN DEFAULT true;

-- Flag para indicar se o fechamento foi automático
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS fechamento_automatico BOOLEAN DEFAULT false;

-- Data/hora do último check de fechamento automático
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS ultimo_check_automatico TIMESTAMPTZ;

-- =====================================================
-- 2. FUNÇÃO: Verificar se produto fracionado atingiu mínimo
-- =====================================================
CREATE OR REPLACE FUNCTION check_fractional_product_complete(
    p_lot_id UUID,
    p_product_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_tipo_venda TEXT;
    v_quantidade_minima INT;
    v_quantidade_pedida INT;
BEGIN
    -- Buscar tipo de venda do produto
    SELECT tipo_venda INTO v_tipo_venda
    FROM products
    WHERE id = p_product_id;
    
    -- Produtos individuais sempre podem fechar
    IF v_tipo_venda = 'individual' THEN
        RETURN true;
    END IF;
    
    -- Para produtos tipo 'pacote', verificar quantidade mínima
    SELECT 
        COALESCE(p.quantidade_pacote, 12),
        COALESCE(lp.quantidade_pedidos, 0)
    INTO v_quantidade_minima, v_quantidade_pedida
    FROM products p
    LEFT JOIN lot_products lp ON lp.product_id = p.id AND lp.lot_id = p_lot_id
    WHERE p.id = p_product_id;
    
    -- Retorna true se atingiu a quantidade mínima
    RETURN v_quantidade_pedida >= v_quantidade_minima;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. FUNÇÃO: Verificar se todos os produtos fracionados estão completos
-- =====================================================
CREATE OR REPLACE FUNCTION check_all_fractional_products_complete(
    p_lot_id UUID
) RETURNS TABLE (
    all_complete BOOLEAN,
    incomplete_count INT,
    incomplete_products JSONB
) AS $$
DECLARE
    v_incomplete_count INT := 0;
    v_incomplete_products JSONB := '[]'::jsonb;
    v_product RECORD;
BEGIN
    -- Verificar cada produto do lote
    FOR v_product IN
        SELECT 
            p.id,
            p.nome,
            p.tipo_venda,
            p.quantidade_pacote,
            COALESCE(lp.quantidade_pedidos, 0) as quantidade_pedida
        FROM lot_products lp
        JOIN products p ON p.id = lp.product_id
        WHERE lp.lot_id = p_lot_id
    LOOP
        -- Pular produtos individuais
        IF v_product.tipo_venda = 'individual' THEN
            CONTINUE;
        END IF;
        
        -- Verificar se produto fracionado está completo
        IF v_product.quantidade_pedida < COALESCE(v_product.quantidade_pacote, 12) THEN
            v_incomplete_count := v_incomplete_count + 1;
            v_incomplete_products := v_incomplete_products || jsonb_build_object(
                'id', v_product.id,
                'nome', v_product.nome,
                'minimo', COALESCE(v_product.quantidade_pacote, 12),
                'atual', v_product.quantidade_pedida,
                'faltam', COALESCE(v_product.quantidade_pacote, 12) - v_product.quantidade_pedida
            );
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT 
        v_incomplete_count = 0,
        v_incomplete_count,
        v_incomplete_products;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. FUNÇÃO: Fechamento Automático de Lotes por Deadline
-- =====================================================
CREATE OR REPLACE FUNCTION auto_close_lots_by_deadline()
RETURNS TABLE (
    lot_id UUID,
    lot_name TEXT,
    action TEXT,
    message TEXT
) AS $$
DECLARE
    v_lot RECORD;
    v_check_result RECORD;
BEGIN
    -- Buscar lotes abertos com deadline vencido
    FOR v_lot IN
        SELECT 
            id,
            nome,
            data_fim,
            requer_pacote_fechado
        FROM lots
        WHERE status = 'aberto'
          AND data_fim IS NOT NULL
          AND data_fim <= NOW()
    LOOP
        -- Verificar produtos fracionados
        SELECT * INTO v_check_result
        FROM check_all_fractional_products_complete(v_lot.id);
        
        -- Se requer pacotes fechados e existem incompletos, não fechar
        IF v_lot.requer_pacote_fechado AND NOT v_check_result.all_complete THEN
            -- Atualizar último check
            UPDATE lots 
            SET ultimo_check_automatico = NOW()
            WHERE id = v_lot.id;
            
            RETURN QUERY SELECT 
                v_lot.id,
                v_lot.nome,
                'BLOCKED'::TEXT,
                format('Lote não pode fechar: %s produto(s) fracionado(s) incompleto(s)', 
                       v_check_result.incomplete_count)::TEXT;
            CONTINUE;
        END IF;
        
        -- Fechar o lote
        UPDATE lots
        SET 
            status = 'fechado',
            fechamento_automatico = true,
            ultimo_check_automatico = NOW(),
            updated_at = NOW()
        WHERE id = v_lot.id;
        
        RETURN QUERY SELECT 
            v_lot.id,
            v_lot.nome,
            'CLOSED'::TEXT,
            'Lote fechado automaticamente por deadline'::TEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. FUNÇÃO: Aplicar Margem do Lote aos Produtos
-- =====================================================
CREATE OR REPLACE FUNCTION apply_lot_margin_to_products()
RETURNS TRIGGER AS $$
DECLARE
    v_product RECORD;
BEGIN
    -- Só aplica se margem_fixa_pct estiver definida
    IF NEW.margem_fixa_pct IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Aplicar margem a todos os produtos do lote
    FOR v_product IN
        SELECT DISTINCT p.id, p.custo
        FROM lot_products lp
        JOIN products p ON p.id = lp.product_id
        WHERE lp.lot_id = NEW.id AND p.custo > 0
    LOOP
        UPDATE products
        SET 
            margem_pct = NEW.margem_fixa_pct,
            preco = v_product.custo * (1 + NEW.margem_fixa_pct / 100),
            updated_at = NOW()
        WHERE id = v_product.id;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para aplicar margem ao criar/atualizar lote
DROP TRIGGER IF EXISTS apply_margin_on_lot_update ON lots;
CREATE TRIGGER apply_margin_on_lot_update
    AFTER INSERT OR UPDATE OF margem_fixa_pct ON lots
    FOR EACH ROW
    WHEN (NEW.margem_fixa_pct IS NOT NULL)
    EXECUTE FUNCTION apply_lot_margin_to_products();

-- =====================================================
-- 6. EXTENSÃO: pg_cron (se disponível)
-- =====================================================
-- Nota: pg_cron precisa ser habilitado manualmente no Supabase
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar verificação de fechamento a cada hora
-- SELECT cron.schedule(
--     'auto-close-lots',
--     '0 * * * *', -- A cada hora
--     $$SELECT auto_close_lots_by_deadline();$$
-- );

-- =====================================================
-- 7. ÍNDICES DE PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_lots_auto_close 
ON lots(status, data_fim) 
WHERE status = 'aberto' AND data_fim IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tipo_venda 
ON products(tipo_venda);

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'Migration 022 aplicada com sucesso' as status;
SELECT 'Funções de fechamento automático criadas' as functions;
SELECT 'Triggers de margem configurados' as triggers;
