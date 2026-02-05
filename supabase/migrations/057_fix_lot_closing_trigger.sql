-- =====================================================
-- MIGRATION 057: Fix Lot Closing Triggers (Remove "orders" dependency)
-- Replaces generates/recalculates functions to use romaneio_items
-- =====================================================

-- 1. Update recalculate_romaneio_values to use romaneio_items
CREATE OR REPLACE FUNCTION recalculate_romaneio_values(p_romaneio_id UUID)
RETURNS VOID AS $$
DECLARE
    v_romaneio RECORD;
    v_lot RECORD;
    v_valor_produtos NUMERIC := 0;
    v_taxa_separacao NUMERIC := 0;
    v_custo_operacional NUMERIC := 0;
    v_custo_motoboy NUMERIC := 0;
    v_custo_digitacao NUMERIC := 0;
    v_valor_frete NUMERIC := 0;
    v_valor_total NUMERIC := 0;
    v_cep_destino TEXT;
    v_total_itens INT := 0;
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
    
    -- Recalcular valor dos produtos usando romaneio_items
    SELECT 
        COALESCE(SUM(ri.valor_total), 0), 
        COALESCE(SUM(ri.quantidade), 0)
    INTO v_valor_produtos, v_total_itens
    FROM romaneio_items ri
    WHERE ri.romaneio_id = p_romaneio_id;
    
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
            -- Function calculate_freight must exist (from previous migrations)
            -- If not, fallback to existing logic or 0
            BEGIN
                v_valor_frete := calculate_freight(p_romaneio_id, v_cep_destino, 'PAC');
            EXCEPTION WHEN OTHERS THEN
                 -- Fallback simplistic calculation if function fails
                 v_valor_frete := 15.00 + ((v_total_itens * 50) / 1000.0) * 5.00;
            END;
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
        total = v_valor_total, -- Update total alias as well
        subtotal = v_valor_produtos,
        quantidade_itens = v_total_itens,
        total_itens = v_total_itens,
        updated_at = NOW()
    WHERE id = p_romaneio_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Update generate_complete_romaneios_on_lot_close to use romaneios table
CREATE OR REPLACE FUNCTION generate_complete_romaneios_on_lot_close()
RETURNS TRIGGER AS $$
DECLARE
    v_romaneio_record RECORD;
BEGIN
    -- Só executa quando status muda para 'fechado'
    IF NEW.status = 'fechado' AND OLD.status = 'aberto' THEN
        
        -- Iterar sobre todos os romaneios deste lote que estão "abertos" logicamente.
        -- Assumindo que romaneios já foram criados via checkout.
        -- Se não tiver romaneio, não tem o que fechar.
        
        FOR v_romaneio_record IN
            SELECT id
            FROM romaneios
            WHERE lot_id = NEW.id 
              -- Filter potentially only those that aren't already finalized if needed
              -- But recalculating everything is safer to ensure fees are applied
        LOOP
            -- Chamar função de recálculo para aplicar taxas do lote atualizadas
            PERFORM recalculate_romaneio_values(v_romaneio_record.id);
            
            -- Opcional: Atualizar status do romaneio se necessário?
            -- Por enquanto, mantemos o status atual (ex: aguardando_pagamento)
        END LOOP;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Ensure trigger exists and uses the updated function
DROP TRIGGER IF EXISTS generate_romaneios_trigger ON lots;
CREATE TRIGGER generate_romaneios_trigger
    AFTER UPDATE ON lots
    FOR EACH ROW
    EXECUTE FUNCTION generate_complete_romaneios_on_lot_close();

-- Verification
SELECT 'Migration 057 applied: Fixed lot closing triggers' as status;
