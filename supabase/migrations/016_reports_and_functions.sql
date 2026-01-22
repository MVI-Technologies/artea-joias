-- =====================================================
-- MIGRATION 016: Relatórios, Rastreabilidade e Webhooks (FIXED)
-- =====================================================

-- 0. GARANTIR COLUNAS DE DEPENDÊNCIA (Fix Forward)
-- Adiciona colunas se não existirem, evitando erro na criação das views
ALTER TABLE products ADD COLUMN IF NOT EXISTS codigo_sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS peso_gramas NUMERIC(8,2) DEFAULT 10;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 1. TABELA DE LOGS/NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'payment', 'system', 'stock'
    message TEXT NOT NULL,
    reference_id UUID,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SNAPSHOTS EM ROMANEIOS (Rastreabilidade)
ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS cliente_nome_snapshot TEXT;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS cliente_telefone_snapshot TEXT;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS endereco_entrega_snapshot JSONB;

-- 3. VIEWS DE RELATÓRIOS (Performance)

-- Drop views if exist to allow changes
DROP VIEW IF EXISTS report_financial_daily;
DROP VIEW IF EXISTS report_ranking_products;
DROP VIEW IF EXISTS report_ranking_clients;

-- View: Relatório Financeiro Diário (Apenas Pagos - Output Financeiro)
CREATE OR REPLACE VIEW report_financial_daily AS
SELECT 
    DATE(created_at) as data_venda,
    COUNT(*) as total_pedidos,
    SUM(valor_total) as receita_total,
    SUM(quantidade) as itens_vendidos
FROM orders
WHERE status = 'pago'
GROUP BY DATE(created_at)
ORDER BY data_venda DESC;

-- View: Ranking de Produtos (Apenas Pagos = Vendas Reais)
CREATE OR REPLACE VIEW report_ranking_products AS
SELECT 
    p.nome as produto_nome,
    p.codigo_sku as sku,
    SUM(o.quantidade) as total_vendido,
    SUM(o.valor_total) as receita_gerada
FROM orders o
JOIN products p ON o.product_id = p.id
WHERE o.status = 'pago'
GROUP BY p.id, p.nome, p.codigo_sku
ORDER BY total_vendido DESC;

-- View: Ranking de Clientes
CREATE OR REPLACE VIEW report_ranking_clients AS
SELECT 
    c.nome as cliente_nome,
    c.telefone,
    COUNT(o.id) as total_pedidos,
    SUM(o.valor_total) as total_gasto,
    MAX(o.created_at) as ultima_compra
FROM orders o
JOIN clients c ON o.client_id = c.id
WHERE o.status = 'pago'
GROUP BY c.id, c.nome, c.telefone
ORDER BY total_gasto DESC;

-- 4. ATUALIZAR TRIGGER DE ROMANEIOS (Com Snapshot)
CREATE OR REPLACE FUNCTION generate_romaneios_on_lot_close()
RETURNS TRIGGER AS $$
BEGIN
    -- Só executa quando status muda para 'fechado'
    IF NEW.status = 'fechado' AND OLD.status = 'aberto' THEN
        -- Gerar romaneio para cada cliente que tem pedidos neste lote
        INSERT INTO romaneios (
            lot_id, client_id, numero_romaneio, total_itens, subtotal, total,
            cliente_nome_snapshot, cliente_telefone_snapshot, endereco_entrega_snapshot,
            dados -- Coluna obrigatória legada
        )
        SELECT 
            NEW.id,
            o.client_id,
            generate_romaneio_number(),
            SUM(o.quantidade),
            SUM(o.valor_total),
            SUM(o.valor_total), -- Total sem frete inicialmente
            c.nome,
            c.telefone,
            c.enderecos->0, -- Pega o primeiro endereço do array JSONB
            '{}'::jsonb -- Valor vazio para dados
        FROM orders o
        JOIN clients c ON o.client_id = c.id
        WHERE o.lot_id = NEW.id AND o.status != 'cancelado'
        GROUP BY o.client_id, c.nome, c.telefone, c.enderecos
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

-- 5. RPC: Marcar Separado (Concorrência)
CREATE OR REPLACE FUNCTION mark_item_separated(p_item_id UUID, p_is_separated BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    -- Atualiza status para em_preparacao ou pago (volta)
    -- Isso permite fluxo visual simples
    UPDATE orders
    SET 
        status = CASE WHEN p_is_separated THEN 'em_preparacao' ELSE 'pago' END,
        updated_at = NOW()
    WHERE id = p_item_id
    RETURNING true INTO v_updated;

    RETURN COALESCE(v_updated, false);
END;
$$;

-- 6. RPC: Webhook Pagamento
CREATE OR REPLACE FUNCTION process_payment_webhook(
    p_external_ref TEXT, 
    p_payment_id TEXT, 
    p_status TEXT,
    p_valor NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_current_status TEXT;
BEGIN
    BEGIN
        v_order_id := p_external_ref::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid ID format');
    END;

    SELECT status INTO v_current_status FROM orders WHERE id = v_order_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    IF v_current_status = 'pago' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already paid');
    END IF;

    IF p_status = 'approved' THEN
        UPDATE orders 
        SET 
            status = 'pago',
            updated_at = NOW()
        -- Se houvesse coluna payment_id, atualizaríamos aqui também
        WHERE id = v_order_id;
        
        INSERT INTO notifications (type, message, reference_id)
        VALUES ('payment', 'Pagamento confirmado via Webhook MP', v_order_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'new_status', 'pago');
END;
$$;
