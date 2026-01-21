-- =====================================================
-- FIX COMPLETO: Estrutura da tabela romaneios
-- A tabela original não tem as colunas necessárias
-- =====================================================

-- Adicionar TODAS as colunas necessárias
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS numero_romaneio TEXT;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS numero_pedido TEXT;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS total_itens INT DEFAULT 0;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS valor_produtos NUMERIC(10,2) DEFAULT 0;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS desconto_credito NUMERIC(10,2) DEFAULT 0;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS taxa_separacao NUMERIC(10,2) DEFAULT 0;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS valor_frete NUMERIC(10,2) DEFAULT 0;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS valor_total NUMERIC(10,2) DEFAULT 0;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS quantidade_itens INT DEFAULT 0;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS dados_pagamento JSONB;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'gerado';
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'pendente';
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMPTZ;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS comprovante_url TEXT;
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE romaneios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_romaneios_client ON romaneios(client_id);
CREATE INDEX IF NOT EXISTS idx_romaneios_lot ON romaneios(lot_id);
CREATE INDEX IF NOT EXISTS idx_romaneios_status ON romaneios(status);

-- DESATIVAR o trigger automático de romaneios (causa problemas)
DROP TRIGGER IF EXISTS generate_romaneios_trigger ON lots;
DROP TRIGGER IF EXISTS generate_complete_romaneios_trigger ON lots;

-- Verificação
SELECT 'Migration 013: Tabela romaneios corrigida e trigger desativado' as info;

