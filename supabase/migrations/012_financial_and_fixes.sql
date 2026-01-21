-- =====================================================
-- FINANCEIRO E CORREÇÕES
-- Migration 012
-- =====================================================

-- =====================================================
-- 1. GARANTIR TABELA RESERVAS (Correção Crítica)
-- =====================================================
CREATE TABLE IF NOT EXISTS reservas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_id UUID REFERENCES lots(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantidade INT DEFAULT 1,
    valor_unitario NUMERIC(10,2) DEFAULT 0,
    valor_total NUMERIC(10,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmada', 'cancelada')),
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para reservas
CREATE INDEX IF NOT EXISTS idx_reservas_lot ON reservas(lot_id);
CREATE INDEX IF NOT EXISTS idx_reservas_client ON reservas(client_id);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON reservas(status);

-- =====================================================
-- 2. TABELA FINANCEIRA (Novo Módulo)
-- =====================================================
CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    descricao TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    categoria TEXT,
    valor NUMERIC(10,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
    forma_pagamento TEXT,
    numero_parcela INT DEFAULT 1,
    total_parcelas INT DEFAULT 1,
    observacoes TEXT,
    comprovante_url TEXT,
    
    -- Relacionamentos opcionais
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    romaneio_id UUID REFERENCES romaneios(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_data ON financial_transactions(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financial_tipo ON financial_transactions(tipo);
CREATE INDEX IF NOT EXISTS idx_financial_status ON financial_transactions(status);

-- =====================================================
-- 3. INTEGRAÇÃO FINANCEIRO <-> ROMANEIOS
-- =====================================================
-- Quando um romaneio é marcado como pago, gerar receita automaticamente
CREATE OR REPLACE FUNCTION generate_revenue_on_romaneio_pay()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status_pagamento = 'pago' AND OLD.status_pagamento != 'pago' THEN
        INSERT INTO financial_transactions (
            descricao,
            tipo,
            categoria,
            valor,
            data_vencimento,
            data_pagamento,
            status,
            forma_pagamento,
            client_id,
            romaneio_id
        ) VALUES (
            'Recebimento Romaneio #' || NEW.numero_pedido,
            'receita',
            'Vendas',
            NEW.valor_total,
            CURRENT_DATE,
            CURRENT_DATE,
            'pago',
            'PIX', -- Default, pode ser ajustado
            NEW.client_id,
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_romaneio_revenue ON romaneios;
CREATE TRIGGER trg_romaneio_revenue
    AFTER UPDATE ON romaneios
    FOR EACH ROW
    EXECUTE FUNCTION generate_revenue_on_romaneio_pay();

-- =====================================================
-- 4. ATUALIZAÇÕES DE PERMISSÕES (RLS)
-- =====================================================
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- Política simples: Admins veem tudo
CREATE POLICY "Admins full access financial" ON financial_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM clients 
            WHERE clients.auth_id = auth.uid() 
            AND clients.role = 'admin'
        )
    );

-- Verifica se política existe antes de criar para evitar erro
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'reservas' AND policyname = 'Admins full access reservas'
    ) THEN
        CREATE POLICY "Admins full access reservas" ON reservas
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM clients 
                    WHERE clients.auth_id = auth.uid() 
                    AND clients.role = 'admin'
                )
            );
    END IF;
END $$;
