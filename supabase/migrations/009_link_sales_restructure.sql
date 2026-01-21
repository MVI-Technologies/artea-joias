-- =====================================================
-- FASE 2: Reestruturação para Grupo de Compras
-- Sistema de Semijoias - Modelo de Revendedoras
-- =====================================================

-- =====================================================
-- AJUSTES NA TABELA: lots (Grupo de Compras)
-- =====================================================

-- =====================================================
-- SEÇÃO: TAXAS (Custos operacionais do grupo)
-- =====================================================

-- Custo de Separação (R$)
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS custo_separacao NUMERIC(10,2) DEFAULT 0;

-- Custo Operacional (R$ por produto)
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS custo_operacional NUMERIC(10,2) DEFAULT 0;

-- Custo Motoboy (R$)
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS custo_motoboy NUMERIC(10,2) DEFAULT 0;

-- Custo Digitação (R$)
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS custo_digitacao NUMERIC(10,2) DEFAULT 0;

-- Escritório (% sobre produtos)
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS escritorio_pct NUMERIC(5,2) DEFAULT 0;

-- Percentual de Entrada (%)
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS percentual_entrada NUMERIC(5,2) DEFAULT 0;

-- Taxa de Separação Dinâmica (campo descritivo)
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS taxa_separacao_dinamica TEXT;

-- =====================================================
-- SEÇÃO: CONFIGURAÇÕES DO GRUPO
-- =====================================================

-- Indica se o grupo requer que pacotes sejam fechados
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS requer_pacote_fechado BOOLEAN DEFAULT false;

-- Margem fixa aplicada aos produtos deste grupo
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS margem_fixa_pct NUMERIC(5,2);

-- Chave PIX para pagamento
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS chave_pix TEXT;

-- Nome do beneficiário do PIX
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS nome_beneficiario TEXT;

-- Mensagem personalizada de pagamento
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS mensagem_pagamento TEXT;

-- Telefone do setor financeiro
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS telefone_financeiro TEXT;

-- Observações adicionais (taxas, regras)
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS observacoes_rodape TEXT;

-- =====================================================
-- TABELA: reservas (Reservas antes do fechamento)
-- =====================================================
CREATE TABLE IF NOT EXISTS reservas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantidade INT NOT NULL DEFAULT 1,
    valor_unitario NUMERIC(10,2) NOT NULL,
    valor_total NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmada', 'cancelada')),
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lot_id, client_id, product_id)
);

-- Índices para reservas
CREATE INDEX IF NOT EXISTS idx_reservas_lot ON reservas(lot_id);
CREATE INDEX IF NOT EXISTS idx_reservas_client ON reservas(client_id);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON reservas(status);

-- RLS para reservas
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes podem ver suas próprias reservas"
    ON reservas FOR SELECT
    USING (
        client_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Clientes podem criar suas próprias reservas"
    ON reservas FOR INSERT
    WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Clientes podem atualizar suas próprias reservas"
    ON reservas FOR UPDATE
    USING (
        client_id IN (
            SELECT id FROM clients WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Admins podem gerenciar todas as reservas"
    ON reservas FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clients c 
            WHERE c.auth_id = auth.uid() AND c.role = 'admin'
        )
    );

-- =====================================================
-- AJUSTES NA TABELA: orders (Novos status)
-- =====================================================

-- Remover constraint antiga e adicionar nova com mais status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN (
        'reservado',           -- Reserva confirmada, aguardando fechamento do link
        'aguardando_pagamento', -- Link fechado, aguardando pagamento
        'pago',                -- Pagamento confirmado
        'em_separacao',        -- Em processo de separação
        'enviado',             -- Enviado para o cliente
        'concluido',           -- Entregue e finalizado
        'cancelado',           -- Cancelado
        -- Manter status antigos para compatibilidade
        'pendente',
        'em_preparacao',
        'entregue'
    ));

-- Adicionar referência à reserva original
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS reserva_id UUID REFERENCES reservas(id);

-- =====================================================
-- AJUSTES NA TABELA: romaneios (Estrutura completa)
-- =====================================================

-- Recriar estrutura de romaneios
ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS numero_pedido TEXT;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS valor_produtos NUMERIC(10,2) DEFAULT 0;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS desconto_credito NUMERIC(10,2) DEFAULT 0;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS taxa_separacao NUMERIC(10,2) DEFAULT 0;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS valor_frete NUMERIC(10,2) DEFAULT 0;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS valor_total NUMERIC(10,2) DEFAULT 0;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS quantidade_itens INT DEFAULT 0;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS dados_pagamento JSONB;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'pendente' 
    CHECK (status_pagamento IN ('pendente', 'aguardando', 'pago', 'cancelado'));

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMPTZ;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS comprovante_url TEXT;

-- =====================================================
-- FUNÇÃO: Gerar número de pedido
-- =====================================================
CREATE OR REPLACE FUNCTION generate_pedido_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'GC-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÃO: Converter reservas em pedidos ao fechar link
-- =====================================================
CREATE OR REPLACE FUNCTION convert_reservas_to_orders_on_lot_close()
RETURNS TRIGGER AS $$
DECLARE
    reserva RECORD;
    new_order_id UUID;
BEGIN
    -- Só executa quando status muda para 'fechado'
    IF NEW.status = 'fechado' AND OLD.status = 'aberto' THEN
        -- Para cada reserva confirmada deste lote
        FOR reserva IN
            SELECT * FROM reservas 
            WHERE lot_id = NEW.id AND status = 'confirmada'
        LOOP
            -- Criar pedido a partir da reserva
            INSERT INTO orders (
                lot_id, 
                client_id, 
                product_id, 
                quantidade, 
                valor_unitario, 
                valor_total, 
                status,
                reserva_id,
                observacoes
            ) VALUES (
                reserva.lot_id,
                reserva.client_id,
                reserva.product_id,
                reserva.quantidade,
                reserva.valor_unitario,
                reserva.valor_total,
                'aguardando_pagamento',
                reserva.id,
                reserva.observacoes
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS convert_reservas_trigger ON lots;
CREATE TRIGGER convert_reservas_trigger
    AFTER UPDATE ON lots
    FOR EACH ROW
    EXECUTE FUNCTION convert_reservas_to_orders_on_lot_close();

-- =====================================================
-- FUNÇÃO: Gerar romaneios com dados completos ao fechar
-- =====================================================
CREATE OR REPLACE FUNCTION generate_complete_romaneios_on_lot_close()
RETURNS TRIGGER AS $$
BEGIN
    -- Só executa quando status muda para 'fechado'
    IF NEW.status = 'fechado' AND OLD.status = 'aberto' THEN
        -- Gerar romaneio para cada cliente que tem pedidos neste lote
        INSERT INTO romaneios (
            lot_id, 
            client_id, 
            numero_romaneio, 
            numero_pedido,
            quantidade_itens,
            valor_produtos,
            taxa_separacao,
            valor_total,
            dados_pagamento,
            status_pagamento
        )
        SELECT 
            NEW.id,
            o.client_id,
            generate_romaneio_number(),
            generate_pedido_number(),
            SUM(o.quantidade),
            SUM(o.valor_total),
            NEW.taxa_separacao,
            SUM(o.valor_total) + COALESCE(NEW.taxa_separacao, 0),
            jsonb_build_object(
                'chave_pix', NEW.chave_pix,
                'nome_beneficiario', NEW.nome_beneficiario,
                'mensagem', NEW.mensagem_pagamento,
                'telefone_financeiro', NEW.telefone_financeiro
            ),
            'aguardando'
        FROM orders o
        WHERE o.lot_id = NEW.id AND o.status = 'aguardando_pagamento'
        GROUP BY o.client_id
        ON CONFLICT (lot_id, client_id) DO UPDATE SET
            quantidade_itens = EXCLUDED.quantidade_itens,
            valor_produtos = EXCLUDED.valor_produtos,
            taxa_separacao = EXCLUDED.taxa_separacao,
            valor_total = EXCLUDED.valor_total,
            dados_pagamento = EXCLUDED.dados_pagamento,
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

-- Recriar trigger com nova função
DROP TRIGGER IF EXISTS generate_romaneios_trigger ON lots;
CREATE TRIGGER generate_romaneios_trigger
    AFTER UPDATE ON lots
    FOR EACH ROW
    EXECUTE FUNCTION generate_complete_romaneios_on_lot_close();

-- =====================================================
-- TRIGGER: Atualizar updated_at em reservas
-- =====================================================
CREATE TRIGGER update_reservas_updated_at BEFORE UPDATE ON reservas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ADICIONAR CAMPOS À COMPANY_SETTINGS
-- =====================================================
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS chave_pix_padrao TEXT;

ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS nome_beneficiario_padrao TEXT;

ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS mensagem_pagamento_padrao TEXT;

ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS telefone_financeiro TEXT;

ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS observacoes_romaneio_padrao TEXT DEFAULT 
'- *Pedidos até R$ 30,00*: isentos da taxa de serviço.
- *Pedidos entre R$ 30,01 e R$ 100,00*: cobrança de R$ 20,00 de taxa de serviço.
- *Pedidos acima de R$ 100,00*: cobrança da taxa de serviço no valor integral.

As taxas visam cobrir custos operacionais, de manutenção das plataforma, e dos serviços prestados.';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'Novos campos em lots:' as info, 
       'taxa_separacao, requer_pacote_fechado, margem_fixa_pct, chave_pix, etc.' as colunas;
SELECT 'Tabela reservas criada' as info;
SELECT 'Novos status em orders' as info;
SELECT 'Campos completos em romaneios' as info;
