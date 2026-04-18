-- =====================================================
-- Migration 069: Sistema de Pagamentos Parciais
-- Permite registrar múltiplos pagamentos em um romaneio
-- =====================================================

-- 1. Tabela de pagamentos parciais
CREATE TABLE IF NOT EXISTS romaneio_pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    romaneio_id UUID NOT NULL REFERENCES romaneios(id) ON DELETE CASCADE,
    valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    meio_pagamento TEXT DEFAULT 'pix' CHECK (meio_pagamento IN ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro')),
    observacao TEXT,
    registrado_por UUID REFERENCES clients(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_romaneio_pagamentos_romaneio ON romaneio_pagamentos(romaneio_id);
CREATE INDEX IF NOT EXISTS idx_romaneio_pagamentos_data ON romaneio_pagamentos(created_at DESC);

-- 3. Campo de cache na tabela romaneios
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10,2) DEFAULT 0;

COMMENT ON TABLE romaneio_pagamentos IS 'Registros individuais de pagamentos parciais de um romaneio';
COMMENT ON COLUMN romaneios.valor_pago IS 'Cache do total já pago (soma de romaneio_pagamentos.valor)';

-- 4. RLS
ALTER TABLE romaneio_pagamentos ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar todos os pagamentos
CREATE POLICY "Admins gerenciam pagamentos"
ON romaneio_pagamentos FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM clients
        WHERE auth_id = auth.uid() AND role = 'admin'
    )
);

-- Clientes veem pagamentos dos seus romaneios
CREATE POLICY "Clientes veem seus pagamentos"
ON romaneio_pagamentos FOR SELECT
USING (
    romaneio_id IN (
        SELECT r.id FROM romaneios r
        JOIN clients c ON c.id = r.client_id
        WHERE c.auth_id = auth.uid()
    )
);

-- 5. Atualizar constraint de status para incluir parcialmente_pago
ALTER TABLE romaneios
DROP CONSTRAINT IF EXISTS romaneios_status_pagamento_check;

ALTER TABLE romaneios
ADD CONSTRAINT romaneios_status_pagamento_check
CHECK (status_pagamento IN (
  'aguardando_pagamento',
  'aguardando',
  'parcialmente_pago',
  'pago',
  'pago_frete_incluso',
  'pago_50_pct',
  'pago_50_pct_s_frete',
  'em_separacao',
  'enviado',
  'concluido',
  'cancelado',
  'fechado_insuficiente',
  'admin_purchase',
  'pendente'
));

-- 6. Função para recalcular valor_pago de um romaneio
CREATE OR REPLACE FUNCTION recalculate_romaneio_valor_pago()
RETURNS TRIGGER AS $$
DECLARE
    v_total_pago NUMERIC;
    v_romaneio_id UUID;
BEGIN
    -- Determinar romaneio_id baseado na operação
    v_romaneio_id := COALESCE(NEW.romaneio_id, OLD.romaneio_id);

    -- Recalcular soma
    v_total_pago := (
        SELECT COALESCE(SUM(valor), 0)
        FROM romaneio_pagamentos
        WHERE romaneio_id = v_romaneio_id
    );

    -- Atualizar cache
    UPDATE romaneios
    SET valor_pago = v_total_pago,
        updated_at = NOW()
    WHERE id = v_romaneio_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Triggers para manter cache sincronizado
DROP TRIGGER IF EXISTS trg_recalc_valor_pago_insert ON romaneio_pagamentos;
CREATE TRIGGER trg_recalc_valor_pago_insert
    AFTER INSERT ON romaneio_pagamentos
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_romaneio_valor_pago();

DROP TRIGGER IF EXISTS trg_recalc_valor_pago_delete ON romaneio_pagamentos;
CREATE TRIGGER trg_recalc_valor_pago_delete
    AFTER DELETE ON romaneio_pagamentos
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_romaneio_valor_pago();

-- 8. Inicializar valor_pago para romaneios existentes que já estão pagos
UPDATE romaneios
SET valor_pago = valor_total
WHERE status_pagamento IN ('pago', 'pago_frete_incluso', 'concluido', 'em_separacao', 'enviado', 'admin_purchase')
  AND (valor_pago IS NULL OR valor_pago = 0)
  AND valor_total > 0;

-- Inicializar 50% para os que estão como pago_50_pct
UPDATE romaneios
SET valor_pago = ROUND(valor_total / 2, 2)
WHERE status_pagamento IN ('pago_50_pct', 'pago_50_pct_s_frete')
  AND (valor_pago IS NULL OR valor_pago = 0)
  AND valor_total > 0;

-- Verificação
SELECT 'Migration 069 aplicada com sucesso' as status;
SELECT 'Tabela romaneio_pagamentos criada, campo valor_pago adicionado, triggers configurados' as feature;
