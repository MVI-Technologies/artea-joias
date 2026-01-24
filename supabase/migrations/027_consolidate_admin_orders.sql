-- =====================================================
-- MIGRATION 027: CONSOLIDATE ADMIN ORDERS & EXPAND ROMANEIOS
-- =====================================================

-- 1. Add Admin Purchase Support & Financial Fields
ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS is_admin_purchase BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_reference TEXT, -- ID do pagamento (PIX E2E, MP ID, etc)
ADD COLUMN IF NOT EXISTS total_bruto NUMERIC(10,2), -- Valor total sem descontos
ADD COLUMN IF NOT EXISTS total_liquido NUMERIC(10,2), -- Valor recebido de fato (após taxas MP)
ADD COLUMN IF NOT EXISTS taxa_link NUMERIC(10,2) DEFAULT 0; -- Taxa do link/plataforma

COMMENT ON COLUMN romaneios.is_admin_purchase IS 'Indica se foi uma venda/compra lançada administrativamente';
COMMENT ON COLUMN romaneios.payment_reference IS 'Referência externa do pagamento (e.g. ID do PIX ou MP)';

-- 2. Update Status Enum Constraint (Drop old check, add new extended check)
-- First, drop the existing constraint if possible. 
-- Since multiple migrations might have added checks with different names, we try to be safe.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'romaneios'::regclass 
        AND contype = 'c' 
        AND pg_get_constraintdef(oid) LIKE '%status_pagamento%'
    ) LOOP
        EXECUTE 'ALTER TABLE romaneios DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- Add new comprehensive constraint
-- Valid statuses:
-- aguardando_pagamento: Criado, espera pagamento
-- pago: Pagamento confirmado
-- em_separacao: Admin marcou para separação
-- enviado: Admin enviou (código rastreio?)
-- concluido: Entregue/Finalizado
-- fechado_insuficiente: Lote fechou mas não atingiu meta (opcional)
-- admin_purchase: Compra manual do admin (pode pular etapas)
-- cancelado: Cancelado
ALTER TABLE romaneios
ADD CONSTRAINT romaneios_status_pagamento_check 
CHECK (status_pagamento IN (
    'aguardando_pagamento', 
    'aguardando', -- Legacy support (will be migrated)
    'pago', 
    'em_separacao', 
    'enviado', 
    'concluido', 
    'cancelado', 
    'fechado_insuficiente', 
    'admin_purchase',
    'pendente' -- Legacy
));

-- 3. Migration: Update Legacy 'aguardando' to 'aguardando_pagamento'
UPDATE romaneios 
SET status_pagamento = 'aguardando_pagamento' 
WHERE status_pagamento = 'aguardando';

-- 4. Function: Update Romaneio Status with Extended Logic
DROP FUNCTION IF EXISTS update_romaneio_status(UUID, VARCHAR, UUID, TEXT);

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
    v_msg TEXT;
BEGIN
    -- Get current status
    SELECT status_pagamento, client_id 
    INTO v_status_anterior, v_client_id
    FROM romaneios 
    WHERE id = p_romaneio_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Romaneio não encontrado: %', p_romaneio_id;
    END IF;

    -- Validate transition (Basic validation, more complex logic can be in app)
    -- Allow admins to force changes usually, but we can prevent silly things
    
    v_msg := CASE
        WHEN p_observacao IS NOT NULL THEN p_observacao
        ELSE 'Status alterado manualmente para ' || p_novo_status
    END;
    
    -- Update romaneio
    UPDATE romaneios
    SET 
        status_pagamento = p_novo_status,
        data_pagamento = CASE 
            WHEN p_novo_status IN ('pago', 'admin_purchase') AND data_pagamento IS NULL THEN NOW() 
            ELSE data_pagamento 
        END,
        observacoes_admin = CASE
            WHEN p_observacao IS NOT NULL THEN 
                COALESCE(observacoes_admin || E'\n\n', '') || 
                '[' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI') || '] ' || p_observacao
            ELSE observacoes_admin
        END,
        is_admin_purchase = CASE
            WHEN p_novo_status = 'admin_purchase' THEN true
            ELSE is_admin_purchase
        END,
        updated_at = NOW()
    WHERE id = p_romaneio_id;
    
    -- Log Audit
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
        v_msg
    );
    
    -- Sync Orders if needed
    IF p_novo_status IN ('pago', 'cancelado', 'admin_purchase') THEN
        UPDATE orders
        SET status = CASE 
            WHEN p_novo_status = 'admin_purchase' THEN 'pago' -- Admin purchase conta como pago
            ELSE p_novo_status 
        END
        WHERE romaneio_id = p_romaneio_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_romaneios_is_admin ON romaneios(is_admin_purchase);

-- 6. Verification
SELECT 'Migration 027 applied: Admin consolidation fields added' as status;
