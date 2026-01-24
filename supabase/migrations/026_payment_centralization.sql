-- =====================================================
-- MIGRATION 026: ROMANEIO PAYMENT CENTRALIZATION & RLS DISABLE
-- Centralizes all payment config in integrations table
-- Disables RLS for all tables (to be re-enabled later)
-- =====================================================

-- =====================================================
-- 1. DISABLE ALL RLS POLICIES
-- =====================================================

-- Disable RLS on all main tables
ALTER TABLE romaneios DISABLE ROW LEVEL SECURITY;
ALTER TABLE romaneio_status_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE lots DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE lot_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE integrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies on romaneios
DROP POLICY IF EXISTS "Clientes veem seus romaneios" ON romaneios;
DROP POLICY IF EXISTS "Admins veem todos romaneios" ON romaneios;
DROP POLICY IF EXISTS "Admins podem gerenciar romaneios" ON romaneios;
DROP POLICY IF EXISTS "Clientes podem criar seus romaneios" ON romaneios;
DROP POLICY IF EXISTS "Clientes podem atualizar seus romaneios" ON romaneios;

-- Drop all existing RLS policies on romaneio_status_log
DROP POLICY IF EXISTS "Admins veem todo histórico" ON romaneio_status_log;
DROP POLICY IF EXISTS "Clientes veem histórico de seus romaneios" ON romaneio_status_log;
DROP POLICY IF EXISTS "Apenas admins criam audit logs" ON romaneio_status_log;

-- =====================================================
-- 2. REMOVE PAYMENT FIELDS FROM LOTS TABLE
-- (Payment config is now centralized in integrations)
-- =====================================================

-- Keep columns for backwards compatibility but mark as deprecated
COMMENT ON COLUMN lots.chave_pix IS 'DEPRECATED: Use integrations table instead';
COMMENT ON COLUMN lots.nome_beneficiario IS 'DEPRECATED: Use integrations table instead';
COMMENT ON COLUMN lots.telefone_financeiro IS 'DEPRECATED: Use integrations table instead';
COMMENT ON COLUMN lots.mensagem_pagamento IS 'DEPRECATED: Use integrations table instead';

-- =====================================================
-- 3. STANDARDIZE ROMANEIO STATUS VALUES
-- =====================================================

-- Create enum-like check constraint for status_pagamento
ALTER TABLE romaneios 
DROP CONSTRAINT IF EXISTS romaneios_status_pagamento_check;

-- Valid statuses: aguardando_pagamento, pago, em_separacao, enviado, concluido, cancelado
ALTER TABLE romaneios 
ADD CONSTRAINT romaneios_status_pagamento_check 
CHECK (status_pagamento IN (
    'aguardando_pagamento', 
    'aguardando',  -- legacy alias
    'pendente',    -- legacy alias
    'pago', 
    'em_separacao', 
    'enviado', 
    'concluido', 
    'cancelado'
));

-- Normalize existing status values
UPDATE romaneios SET status_pagamento = 'aguardando_pagamento' 
WHERE status_pagamento IN ('aguardando', 'pendente', 'gerado');

-- =====================================================
-- 4. FUNCTION: Get Payment Config (Centralized)
-- =====================================================

CREATE OR REPLACE FUNCTION get_payment_config()
RETURNS TABLE (
    pix_configured BOOLEAN,
    pix_chave TEXT,
    pix_nome_beneficiario TEXT,
    pix_cidade TEXT,
    mercadopago_configured BOOLEAN,
    mercadopago_public_key TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT config->>'chave' IS NOT NULL 
         FROM integrations WHERE type = 'pix') AS pix_configured,
        (SELECT config->>'chave' 
         FROM integrations WHERE type = 'pix') AS pix_chave,
        (SELECT config->>'nome_beneficiario' 
         FROM integrations WHERE type = 'pix') AS pix_nome_beneficiario,
        (SELECT config->>'cidade' 
         FROM integrations WHERE type = 'pix') AS pix_cidade,
        (SELECT config->>'access_token' IS NOT NULL 
         FROM integrations WHERE type = 'mercadopago') AS mercadopago_configured,
        (SELECT config->>'public_key' 
         FROM integrations WHERE type = 'mercadopago') AS mercadopago_public_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_payment_config IS 'Returns centralized payment configuration from integrations table';

-- =====================================================
-- 5. FUNCTION: Validate Romaneio Can Be Created
-- =====================================================

CREATE OR REPLACE FUNCTION validate_romaneio_creation()
RETURNS TRIGGER AS $$
DECLARE
    v_pix_configured BOOLEAN;
BEGIN
    -- Check if PIX is configured
    SELECT (config->>'chave' IS NOT NULL AND config->>'chave' != '')
    INTO v_pix_configured
    FROM integrations 
    WHERE type = 'pix';
    
    IF NOT v_pix_configured THEN
        RAISE EXCEPTION 'Não é possível gerar romaneio: Configuração PIX não encontrada. Configure em Configurações > Integrações.';
    END IF;
    
    -- Set default status if not provided
    IF NEW.status_pagamento IS NULL THEN
        NEW.status_pagamento := 'aguardando_pagamento';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate before insert
DROP TRIGGER IF EXISTS trg_validate_romaneio_creation ON romaneios;
-- COMMENTED OUT FOR NOW - Enable when ready for production
-- CREATE TRIGGER trg_validate_romaneio_creation
--     BEFORE INSERT ON romaneios
--     FOR EACH ROW
--     EXECUTE FUNCTION validate_romaneio_creation();

-- =====================================================
-- 6. FUNCTION: Validate Status Transition
-- =====================================================

CREATE OR REPLACE FUNCTION validate_status_transition(
    p_current_status VARCHAR(50),
    p_new_status VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_valid_transitions JSONB := '{
        "aguardando_pagamento": ["pago", "cancelado"],
        "aguardando": ["pago", "cancelado"],
        "pendente": ["pago", "cancelado"],
        "pago": ["em_separacao", "cancelado"],
        "em_separacao": ["enviado", "cancelado"],
        "enviado": ["concluido", "cancelado"],
        "concluido": [],
        "cancelado": []
    }'::JSONB;
    v_allowed_next JSONB;
BEGIN
    -- Get allowed transitions for current status
    v_allowed_next := v_valid_transitions->p_current_status;
    
    -- Check if new status is in allowed list
    IF v_allowed_next IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN v_allowed_next ? p_new_status;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_status_transition IS 'Validates if a status transition is allowed';

-- =====================================================
-- 7. UPDATE: update_romaneio_status with Validation
-- =====================================================

-- Drop existing function first (return type is changing)
DROP FUNCTION IF EXISTS update_romaneio_status(UUID, VARCHAR, UUID, TEXT);

CREATE OR REPLACE FUNCTION update_romaneio_status(
    p_romaneio_id UUID,
    p_novo_status VARCHAR(50),
    p_admin_id UUID,
    p_observacao TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_status_anterior VARCHAR(50);
    v_client_id UUID;
    v_is_valid BOOLEAN;
BEGIN
    -- Get current status and client_id
    SELECT status_pagamento, client_id 
    INTO v_status_anterior, v_client_id
    FROM romaneios 
    WHERE id = p_romaneio_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Romaneio não encontrado: %', p_romaneio_id;
    END IF;
    
    -- Validate transition (skip for initial or same status)
    IF v_status_anterior IS NOT NULL AND v_status_anterior != p_novo_status THEN
        v_is_valid := validate_status_transition(v_status_anterior, p_novo_status);
        IF NOT v_is_valid THEN
            RAISE EXCEPTION 'Transição de status inválida: % -> %', v_status_anterior, p_novo_status;
        END IF;
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
            WHEN p_novo_status IN ('aguardando_pagamento', 'aguardando') THEN 'aguardando_pagamento'
            WHEN p_novo_status = 'em_separacao' THEN 'em_separacao'
            WHEN p_novo_status = 'enviado' THEN 'enviado'
            WHEN p_novo_status = 'concluido' THEN 'concluido'
            ELSE status
        END,
        updated_at = NOW()
    WHERE romaneio_id = p_romaneio_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. UPDATE: get_romaneio_payment_info (Centralized)
-- =====================================================

-- Drop existing function first (return type is changing)
DROP FUNCTION IF EXISTS get_romaneio_payment_info(UUID);

CREATE OR REPLACE FUNCTION get_romaneio_payment_info(p_romaneio_id UUID)
RETURNS TABLE (
    romaneio_id UUID,
    valor_total NUMERIC,
    status_pagamento VARCHAR,
    pix_chave TEXT,
    pix_beneficiario TEXT,
    pix_cidade TEXT,
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
        -- PIX data from centralized integrations table
        (SELECT config->>'chave' FROM integrations WHERE type = 'pix') as pix_chave,
        (SELECT config->>'nome_beneficiario' FROM integrations WHERE type = 'pix') as pix_beneficiario,
        (SELECT config->>'cidade' FROM integrations WHERE type = 'pix') as pix_cidade,
        NULL::TEXT as pix_mensagem,
        -- Mercado Pago from integrations
        COALESCE((SELECT (config->>'access_token') IS NOT NULL FROM integrations WHERE type = 'mercadopago'), false) as mercadopago_habilitado,
        (SELECT config->>'public_key' FROM integrations WHERE type = 'mercadopago') as mercadopago_public_key,
        COALESCE(l.prazo_pagamento_horas, 48) as prazo_pagamento_horas
    FROM romaneios r
    LEFT JOIN lots l ON l.id = r.lot_id
    WHERE r.id = p_romaneio_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. CLEANUP dados_pagamento COLUMN
-- =====================================================

-- Mark dados_pagamento as deprecated (will be removed in future migration)
COMMENT ON COLUMN romaneios.dados_pagamento IS 'DEPRECATED: Payment config now comes from integrations table. This column will be removed.';

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 'Migration 026 applied successfully!' as status;
SELECT 'Features: RLS disabled, payment centralized, status validation' as features;

-- Show payment config status
SELECT 
    CASE WHEN (SELECT config->>'chave' FROM integrations WHERE type = 'pix') IS NOT NULL 
    THEN 'PIX Configurado: ' || (SELECT config->>'chave' FROM integrations WHERE type = 'pix')
    ELSE 'PIX NÃO CONFIGURADO - Configure em Integrações!'
    END as pix_status;
