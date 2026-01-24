-- =====================================================
-- ROMANEIO SYSTEM REFACTOR - Migration 025
-- Comprehensive fix for payment visibility, admin management, and financial tracking
-- =====================================================

-- =====================================================
-- 1. SCHEMA ENHANCEMENTS
-- =====================================================

-- Add romaneio type tracking (cliente vs admin_purchase)
ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS tipo_romaneio VARCHAR(50) DEFAULT 'cliente'
CHECK (tipo_romaneio IN ('cliente', 'admin_purchase'));

COMMENT ON COLUMN romaneios.tipo_romaneio IS 'Tipo de romaneio: cliente (venda normal) ou admin_purchase (compra administrativa)';

-- Add admin observations field
ALTER TABLE romaneios
ADD COLUMN IF NOT EXISTS observacoes_admin TEXT;

COMMENT ON COLUMN romaneios.observacoes_admin IS 'Observações administrativas internas sobre este romaneio';

-- Ensure gerado_em exists (from migration 013)
ALTER TABLE romaneios
ADD COLUMN IF NOT EXISTS gerado_em TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- 2. AUDIT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS romaneio_status_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    romaneio_id UUID NOT NULL REFERENCES romaneios(id) ON DELETE CASCADE,
    status_anterior VARCHAR(50),
    status_novo VARCHAR(50) NOT NULL,
    alterado_por UUID REFERENCES clients(id),
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_log_romaneio ON romaneio_status_log(romaneio_id);
CREATE INDEX IF NOT EXISTS idx_status_log_data ON romaneio_status_log(created_at DESC);

COMMENT ON TABLE romaneio_status_log IS 'Registro de auditoria de mudanças de status em romaneios';

-- =====================================================
-- 3. RLS POLICIES FOR ROMANEIOS
-- =====================================================

-- Enable RLS if not already enabled
ALTER TABLE romaneios ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Clientes veem seus romaneios" ON romaneios;
DROP POLICY IF EXISTS "Admins veem todos romaneios" ON romaneios;
DROP POLICY IF EXISTS "Admins podem gerenciar romaneios" ON romaneios;

-- Policy: Clients can see their own romaneios
CREATE POLICY "Clientes veem seus romaneios"
ON romaneios FOR SELECT
USING (
    client_id IN (
        SELECT id FROM clients WHERE auth_id = auth.uid()
    )
);

-- Policy: Admins can see ALL romaneios
CREATE POLICY "Admins veem todos romaneios"
ON romaneios FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM clients 
        WHERE auth_id = auth.uid() AND role = 'admin'
    )
);

-- Policy: Admins can insert/update/delete romaneios
CREATE POLICY "Admins podem gerenciar romaneios"
ON romaneios FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM clients 
        WHERE auth_id = auth.uid() AND role = 'admin'
    )
);

-- Policy: Clients can insert their own romaneios (for cart checkout)
CREATE POLICY "Clientes podem criar seus romaneios"
ON romaneios FOR INSERT
WITH CHECK (
    client_id IN (
        SELECT id FROM clients WHERE auth_id = auth.uid()
    )
);

-- Policy: Clients can update their own romaneios
CREATE POLICY "Clientes podem atualizar seus romaneios"
ON romaneios FOR UPDATE
USING (
    client_id IN (
        SELECT id FROM clients WHERE auth_id = auth.uid()
    )
)
WITH CHECK (
    client_id IN (
        SELECT id FROM clients WHERE auth_id = auth.uid()
    )
);

-- =====================================================
-- 4. RLS POLICIES FOR AUDIT LOG
-- =====================================================

ALTER TABLE romaneio_status_log ENABLE ROW LEVEL SECURITY;

-- Admins can see all audit logs
CREATE POLICY "Admins veem todo histórico"
ON romaneio_status_log FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM clients 
        WHERE auth_id = auth.uid() AND role = 'admin'
    )
);

-- Clients can see audit logs for their own romaneios
CREATE POLICY "Clientes veem histórico de seus romaneios"
ON romaneio_status_log FOR SELECT
USING (
    romaneio_id IN (
        SELECT r.id FROM romaneios r
        JOIN clients c ON c.id = r.client_id
        WHERE c.auth_id = auth.uid()
    )
);

-- Only system/admins can insert audit logs
CREATE POLICY "Apenas admins criam audit logs"
ON romaneio_status_log FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM clients 
        WHERE auth_id = auth.uid() AND role = 'admin'
    )
);

-- =====================================================
-- 5. FUNCTION: Update Romaneio Status with Audit
-- =====================================================

CREATE OR REPLACE FUNCTION update_romaneio_status(
    p_romaneio_id UUID,
    p_novo_status VARCHAR(50),
    p_admin_id UUID,
    p_observacao TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_status_anterior VARCHAR(50);
    v_client_id UUID;
BEGIN
    -- Get current status and client_id
    SELECT status_pagamento, client_id 
    INTO v_status_anterior, v_client_id
    FROM romaneios 
    WHERE id = p_romaneio_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Romaneio não encontrado: %', p_romaneio_id;
    END IF;
    
    -- Update romaneio status
    UPDATE romaneios
    SET 
        status_pagamento = p_novo_status,
        data_pagamento = CASE 
            WHEN p_novo_status = 'pago' AND data_pagamento IS NULL THEN NOW() 
            ELSE data_pagamento 
        END,
        observacoes_admin = CASE
            WHEN p_observacao IS NOT NULL THEN 
                COALESCE(observacoes_admin || E'\n\n', '') || 
                '[' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI') || '] ' || p_observacao
            ELSE observacoes_admin
        END,
        updated_at = NOW()
    WHERE id = p_romaneio_id;
    
    -- Log the status change
    INSERT INTO romaneio_status_log (
        romaneio_id, 
        status_anterior, 
        status_novo, 
        alterado_por, 
        observacao
    ) VALUES (
        p_romaneio_id, 
        v_status_anterior, 
        p_novo_status, 
        p_admin_id, 
        p_observacao
    );
    
    -- Update linked orders status
    UPDATE orders
    SET 
        status = CASE 
            WHEN p_novo_status = 'pago' THEN 'pago'
            WHEN p_novo_status = 'cancelado' THEN 'cancelado'
            WHEN p_novo_status = 'aguardando' THEN 'aguardando_pagamento'
            ELSE status
        END,
        updated_at = NOW()
    WHERE romaneio_id = p_romaneio_id;
    
    RAISE NOTICE 'Romaneio % atualizado: % -> %', p_romaneio_id, v_status_anterior, p_novo_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_romaneio_status IS 'Atualiza status do romaneio com auditoria e propagação para pedidos';

-- =====================================================
-- 6. FUNCTION: Get Romaneio Payment Data
-- =====================================================

CREATE OR REPLACE FUNCTION get_romaneio_payment_info(p_romaneio_id UUID)
RETURNS TABLE (
    romaneio_id UUID,
    valor_total NUMERIC,
    status_pagamento VARCHAR,
    pix_chave TEXT,
    pix_beneficiario TEXT,
    pix_mensagem TEXT,
    mercadopago_habilitado BOOLEAN,
    mercadopago_public_key TEXT,
    prazo_pagamento_horas INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.valor_total,
        r.status_pagamento,
        r.dados_pagamento->'pix'->>'chave' as pix_chave,
        r.dados_pagamento->'pix'->>'nome_beneficiario' as pix_beneficiario,
        r.dados_pagamento->'pix'->>'mensagem' as pix_mensagem,
        COALESCE((r.dados_pagamento->'mercadopago'->>'habilitado')::boolean, false) as mercadopago_habilitado,
        r.dados_pagamento->'mercadopago'->>'public_key' as mercadopago_public_key,
        COALESCE(l.prazo_pagamento_horas, 48) as prazo_pagamento_horas
    FROM romaneios r
    JOIN lots l ON l.id = r.lot_id
    WHERE r.id = p_romaneio_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_romaneio_payment_info IS 'Retorna informações de pagamento formatadas para o cliente';

-- =====================================================
-- 7. FUNCTION: Get Financial Summary
-- =====================================================

CREATE OR REPLACE FUNCTION get_financial_summary(
    p_data_inicio DATE DEFAULT NULL,
    p_data_fim DATE DEFAULT NULL
)
RETURNS TABLE (
    total_romaneios BIGINT,
    romaneios_pagos BIGINT,
    romaneios_pendentes BIGINT,
    valor_total_bruto NUMERIC,
    valor_total_pago NUMERIC,
    valor_total_pendente NUMERIC,
    valor_produtos NUMERIC,
    valor_taxas NUMERIC,
    valor_frete NUMERIC,
    compras_admin BIGINT,
    valor_compras_admin NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_romaneios,
        COUNT(*) FILTER (WHERE status_pagamento = 'pago')::BIGINT as romaneios_pagos,
        COUNT(*) FILTER (WHERE status_pagamento IN ('aguardando', 'pendente'))::BIGINT as romaneios_pendentes,
        COALESCE(SUM(r.valor_total), 0) as valor_total_bruto,
        COALESCE(SUM(r.valor_total) FILTER (WHERE status_pagamento = 'pago'), 0) as valor_total_pago,
        COALESCE(SUM(r.valor_total) FILTER (WHERE status_pagamento IN ('aguardando', 'pendente')), 0) as valor_total_pendente,
        COALESCE(SUM(r.valor_produtos), 0) as valor_produtos,
        COALESCE(SUM(r.taxa_separacao), 0) as valor_taxas,
        COALESCE(SUM(r.valor_frete), 0) as valor_frete,
        COUNT(*) FILTER (WHERE tipo_romaneio = 'admin_purchase')::BIGINT as compras_admin,
        COALESCE(SUM(r.valor_total) FILTER (WHERE tipo_romaneio = 'admin_purchase'), 0) as valor_compras_admin
    FROM romaneios r
    WHERE 
        (p_data_inicio IS NULL OR r.created_at::DATE >= p_data_inicio)
        AND (p_data_fim IS NULL OR r.created_at::DATE <= p_data_fim);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_financial_summary IS 'Retorna resumo financial para relatórios administrativos';

-- =====================================================
-- 8. UPDATE EXISTING ROMANEIOS
-- =====================================================

-- Set tipo_romaneio for existing records (all are 'cliente' by default)
UPDATE romaneios 
SET tipo_romaneio = 'cliente'
WHERE tipo_romaneio IS NULL;

-- =====================================================
-- 9. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_romaneios_tipo ON romaneios(tipo_romaneio);
CREATE INDEX IF NOT EXISTS idx_romaneios_status_pagamento ON romaneios(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_romaneios_data_pagamento ON romaneios(data_pagamento) WHERE data_pagamento IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_romaneios_created_at ON romaneios(created_at DESC);

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 'Migration 025 aplicada com sucesso!' as status;
SELECT 'Romaneio system refactor: audit log, RLS, status management' as features;
SELECT COUNT(*) as total_romaneios, 
       COUNT(*) FILTER (WHERE tipo_romaneio = 'cliente') as clientes,
       COUNT(*) FILTER (WHERE tipo_romaneio = 'admin_purchase') as admin_purchases
FROM romaneios;
