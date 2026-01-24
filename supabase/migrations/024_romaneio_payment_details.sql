-- =====================================================
-- ROMANEIO ENHANCEMENT: Payment Details & Complete Fees
-- Migration 024: Ensure payment info, fees, and freight
-- =====================================================

-- =====================================================
-- 1. ADICIONAR CAMPOS DE MERCADO PAGO EM LOTS
-- =====================================================

-- Token de acesso do Mercado Pago
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS mercadopago_token TEXT;

-- Public Key do Mercado Pago
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS mercadopago_public_key TEXT;

-- Habilitar pagamento via Mercado Pago
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS habilitar_mercadopago BOOLEAN DEFAULT false;

-- =====================================================
-- 2. ATUALIZAR COMPANY_SETTINGS COM DADOS DE PAGAMENTO
-- =====================================================

ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS mercadopago_token_padrao TEXT;

ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS mercadopago_public_key_padrao TEXT;

-- =====================================================
-- 3. FUNÇÃO MELHORADA: Gerar Romaneios Completos
-- =====================================================
CREATE OR REPLACE FUNCTION generate_complete_romaneios_on_lot_close()
RETURNS TRIGGER AS $$
DECLARE
    v_client RECORD;
    v_valor_produtos NUMERIC;
    v_taxa_separacao NUMERIC;
    v_valor_frete NUMERIC := 0;
    v_valor_total NUMERIC;
    v_cep_destino TEXT;
    v_dados_pagamento JSONB;
BEGIN
    -- Só executa quando status muda para 'fechado'
    IF NEW.status = 'fechado' AND OLD.status = 'aberto' THEN
        
        -- Para cada cliente que tem pedidos neste lote
        FOR v_client IN
            SELECT 
                o.client_id,
                SUM(o.quantidade) as quantidade_itens,
                SUM(o.valor_total) as valor_produtos
            FROM orders o
            WHERE o.lot_id = NEW.id 
              AND o.status = 'aguardando_pagamento'
            GROUP BY o.client_id
        LOOP
            v_valor_produtos := v_client.valor_produtos;
            v_taxa_separacao := COALESCE(NEW.taxa_separacao, 0);
            
            -- Calcular frete se habilitado
            v_valor_frete := 0;
            IF COALESCE(NEW.calculo_frete_automatico, false) THEN
                -- Buscar CEP do cliente
                SELECT 
                    COALESCE(
                        (enderecos->0->>'cep')::TEXT,
                        (enderecos->>0)::JSONB->>'cep'
                    )
                INTO v_cep_destino
                FROM clients
                WHERE id = v_client.client_id;
                
                IF v_cep_destino IS NOT NULL THEN
                    -- Estimar frete (será calculado precisamente no trigger de romaneio)
                    v_valor_frete := 15.00 + ((v_client.quantidade_itens * 50) / 1000.0) * 5.00;
                END IF;
            END IF;
            
            -- Valor total = produtos + taxa de separação + frete
            v_valor_total := v_valor_produtos + v_taxa_separacao + v_valor_frete;
            
            -- Montar dados de pagamento completos
            v_dados_pagamento := jsonb_build_object(
                'pix', jsonb_build_object(
                    'chave', NEW.chave_pix,
                    'nome_beneficiario', NEW.nome_beneficiario,
                    'mensagem', NEW.mensagem_pagamento,
                    'telefone_financeiro', NEW.telefone_financeiro
                ),
                'mercadopago', jsonb_build_object(
                    'habilitado', COALESCE(NEW.habilitar_mercadopago, false),
                    'public_key', NEW.mercadopago_public_key
                ),
                'observacoes', NEW.observacoes_rodape
            );
            
            -- Inserir ou atualizar romaneio
            INSERT INTO romaneios (
                lot_id, 
                client_id, 
                numero_romaneio, 
                numero_pedido,
                quantidade_itens,
                valor_produtos,
                taxa_separacao,
                valor_frete,
                valor_total,
                dados_pagamento,
                status_pagamento
            ) VALUES (
                NEW.id,
                v_client.client_id,
                generate_romaneio_number(),
                generate_pedido_number(),
                v_client.quantidade_itens,
                v_valor_produtos,
                v_taxa_separacao,
                v_valor_frete,
                v_valor_total,
                v_dados_pagamento,
                'aguardando'
            )
            ON CONFLICT (lot_id, client_id) DO UPDATE SET
                quantidade_itens = EXCLUDED.quantidade_itens,
                valor_produtos = EXCLUDED.valor_produtos,
                taxa_separacao = EXCLUDED.taxa_separacao,
                valor_frete = EXCLUDED.valor_frete,
                valor_total = EXCLUDED.valor_total,
                dados_pagamento = EXCLUDED.dados_pagamento,
                updated_at = NOW();
        END LOOP;
        
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

-- Recriar trigger
DROP TRIGGER IF EXISTS generate_romaneios_trigger ON lots;
CREATE TRIGGER generate_romaneios_trigger
    AFTER UPDATE ON lots
    FOR EACH ROW
    EXECUTE FUNCTION generate_complete_romaneios_on_lot_close();

-- =====================================================
-- 4. FUNÇÃO: Recalcular Valores do Romaneio
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_romaneio_values(p_romaneio_id UUID)
RETURNS VOID AS $$
DECLARE
    v_romaneio RECORD;
    v_lot RECORD;
    v_valor_produtos NUMERIC;
    v_taxa_separacao NUMERIC;
    v_valor_frete NUMERIC := 0;
    v_valor_total NUMERIC;
    v_cep_destino TEXT;
BEGIN
    -- Buscar romaneio
    SELECT *
    INTO v_romaneio
    FROM romaneios
    WHERE id = p_romaneio_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Romaneio não encontrado';
    END IF;
    
    -- Buscar lote
    SELECT *
    INTO v_lot
    FROM lots
    WHERE id = v_romaneio.lot_id;
    
    -- Recalcular valor dos produtos
    SELECT COALESCE(SUM(o.valor_total), 0)
    INTO v_valor_produtos
    FROM orders o
    WHERE o.romaneio_id = p_romaneio_id;
    
    -- Taxa de separação
    v_taxa_separacao := COALESCE(v_lot.taxa_separacao, 0);
    
    -- Frete (se habilitado)
    IF COALESCE(v_lot.calculo_frete_automatico, false) THEN
        SELECT 
            COALESCE(
                (enderecos->0->>'cep')::TEXT,
                (enderecos->>0)::JSONB->>'cep'
            )
        INTO v_cep_destino
        FROM clients
        WHERE id = v_romaneio.client_id;
        
        IF v_cep_destino IS NOT NULL THEN
            v_valor_frete := calculate_freight(p_romaneio_id, v_cep_destino, 'PAC');
        END IF;
    ELSE
        v_valor_frete := COALESCE(v_romaneio.valor_frete, 0);
    END IF;
    
    -- Calcular total
    v_valor_total := v_valor_produtos + v_taxa_separacao + v_valor_frete;
    
    -- Atualizar romaneio
    UPDATE romaneios
    SET 
        valor_produtos = v_valor_produtos,
        taxa_separacao = v_taxa_separacao,
        valor_frete = v_valor_frete,
        valor_total = v_valor_total,
        updated_at = NOW()
    WHERE id = p_romaneio_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. VIEW: Romaneio Completo para Cliente
-- =====================================================
CREATE OR REPLACE VIEW romaneio_detalhado AS
SELECT 
    r.id as romaneio_id,
    r.numero_romaneio,
    r.numero_pedido,
    r.lot_id,
    l.nome as lote_nome,
    r.client_id,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    c.enderecos as cliente_enderecos,
    r.quantidade_itens,
    r.valor_produtos,
    r.taxa_separacao,
    r.valor_frete,
    r.valor_total,
    r.desconto_credito,
    r.status_pagamento,
    r.data_pagamento,
    r.comprovante_url,
    r.dados_pagamento,
    r.gerado_em,
    r.updated_at,
    -- Extrair dados de pagamento
    r.dados_pagamento->'pix'->>'chave' as pix_chave,
    r.dados_pagamento->'pix'->>'nome_beneficiario' as pix_beneficiario,
    r.dados_pagamento->'pix'->>'mensagem' as pix_mensagem,
    r.dados_pagamento->'mercadopago'->>'habilitado' as mercadopago_habilitado,
    r.dados_pagamento->'mercadopago'->>'public_key' as mercadopago_public_key,
    -- Lista de produtos
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'produto_nome', p.nome,
                'quantidade', o.quantidade,
                'valor_unitario', o.valor_unitario,
                'valor_total', o.valor_total,
                'imagem', p.imagem1
            )
        )
        FROM orders o
        JOIN products p ON p.id = o.product_id
        WHERE o.romaneio_id = r.id
    ) as produtos
FROM romaneios r
JOIN lots l ON l.id = r.lot_id
JOIN clients c ON c.id = r.client_id;

-- =====================================================
-- 6. RLS PARA VIEW
-- =====================================================
ALTER VIEW romaneio_detalhado SET (security_invoker = true);

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'Migration 024 aplicada com sucesso' as status;
SELECT 'Romaneios agora incluem PIX, Mercado Pago, taxas e frete' as feature;
SELECT 'View romaneio_detalhado criada para clientes' as view_created;
