-- =====================================================
-- MIGRATION: Aplicar TODAS as taxas do lote nos romaneios
-- Adiciona custo_operacional, custo_motoboy, custo_digitacao
-- aos cálculos de romaneio
-- =====================================================

-- 1. Adicionar colunas no romaneio para armazenar cada taxa separadamente
ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS custo_operacional NUMERIC(10,2) DEFAULT 0;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS custo_motoboy NUMERIC(10,2) DEFAULT 0;

ALTER TABLE romaneios 
ADD COLUMN IF NOT EXISTS custo_digitacao NUMERIC(10,2) DEFAULT 0;

-- 2. Atualizar a função que gera romaneios para incluir todas as taxas
CREATE OR REPLACE FUNCTION generate_complete_romaneios_on_lot_close()
RETURNS TRIGGER AS $$
DECLARE
    v_client RECORD;
    v_valor_produtos NUMERIC;
    v_taxa_separacao NUMERIC;
    v_custo_operacional NUMERIC;
    v_custo_motoboy NUMERIC;
    v_custo_digitacao NUMERIC;
    v_valor_frete NUMERIC := 0;
    v_valor_total NUMERIC;
    v_cep_destino TEXT;
    v_dados_pagamento JSONB;
    v_total_itens INT;
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
            v_total_itens := v_client.quantidade_itens;
            
            -- Buscar todas as taxas do lote
            v_taxa_separacao := COALESCE(NEW.custo_separacao, 0);
            v_custo_motoboy := COALESCE(NEW.custo_motoboy, 0);
            v_custo_digitacao := COALESCE(NEW.custo_digitacao, 0);
            
            -- Custo operacional é por produto
            v_custo_operacional := COALESCE(NEW.custo_operacional, 0) * v_total_itens;
            
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
            
            -- Valor total = produtos + todas as taxas + frete
            v_valor_total := v_valor_produtos + v_taxa_separacao + v_custo_operacional + 
                           v_custo_motoboy + v_custo_digitacao + v_valor_frete;
            
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
                custo_operacional,
                custo_motoboy,
                custo_digitacao,
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
                v_custo_operacional,
                v_custo_motoboy,
                v_custo_digitacao,
                v_valor_frete,
                v_valor_total,
                v_dados_pagamento,
                'aguardando'
            )
            ON CONFLICT (lot_id, client_id) DO UPDATE SET
                quantidade_itens = EXCLUDED.quantidade_itens,
                valor_produtos = EXCLUDED.valor_produtos,
                taxa_separacao = EXCLUDED.taxa_separacao,
                custo_operacional = EXCLUDED.custo_operacional,
                custo_motoboy = EXCLUDED.custo_motoboy,
                custo_digitacao = EXCLUDED.custo_digitacao,
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

-- 3. Atualizar função de recálculo para incluir todas as taxas
CREATE OR REPLACE FUNCTION recalculate_romaneio_values(p_romaneio_id UUID)
RETURNS VOID AS $$
DECLARE
    v_romaneio RECORD;
    v_lot RECORD;
    v_valor_produtos NUMERIC;
    v_taxa_separacao NUMERIC;
    v_custo_operacional NUMERIC;
    v_custo_motoboy NUMERIC;
    v_custo_digitacao NUMERIC;
    v_valor_frete NUMERIC := 0;
    v_valor_total NUMERIC;
    v_cep_destino TEXT;
    v_total_itens INT;
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
    SELECT COALESCE(SUM(o.valor_total), 0), COUNT(*)
    INTO v_valor_produtos, v_total_itens
    FROM orders o
    WHERE o.romaneio_id = p_romaneio_id;
    
    -- Buscar todas as taxas do lote
    v_taxa_separacao := COALESCE(v_lot.custo_separacao, 0);
    v_custo_motoboy := COALESCE(v_lot.custo_motoboy, 0);
    v_custo_digitacao := COALESCE(v_lot.custo_digitacao, 0);
    
    -- Custo operacional é por produto
    v_custo_operacional := COALESCE(v_lot.custo_operacional, 0) * v_total_itens;
    
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
    
    -- Calcular total com todas as taxas
    v_valor_total := v_valor_produtos + v_taxa_separacao + v_custo_operacional + 
                   v_custo_motoboy + v_custo_digitacao + v_valor_frete;
    
    -- Atualizar romaneio
    UPDATE romaneios
    SET 
        valor_produtos = v_valor_produtos,
        taxa_separacao = v_taxa_separacao,
        custo_operacional = v_custo_operacional,
        custo_motoboy = v_custo_motoboy,
        custo_digitacao = v_custo_digitacao,
        valor_frete = v_valor_frete,
        valor_total = v_valor_total,
        updated_at = NOW()
    WHERE id = p_romaneio_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'Migration aplicada: Todas as taxas agora são calculadas nos romaneios' as status;
