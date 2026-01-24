DROP FUNCTION IF EXISTS generate_revenue_on_romaneio_pay() CASCADE;

CREATE OR REPLACE FUNCTION generate_revenue_on_romaneio_pay()
RETURNS TRIGGER AS $$
DECLARE
    v_descricao TEXT;
BEGIN
    IF NEW.status_pagamento = 'pago' AND OLD.status_pagamento != 'pago' THEN
        
        -- Garante descrição válida com fallback
        v_descricao := 'Recebimento Romaneio #' || COALESCE(NEW.numero_pedido, NEW.numero_romaneio, 'ND');

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
            v_descricao,
            'receita',
            'Vendas',
            COALESCE(NEW.valor_total, 0),
            CURRENT_DATE,
            CURRENT_DATE,
            'pago',
            'PIX',
            NEW.client_id,
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger just in case
DROP TRIGGER IF EXISTS trg_romaneio_revenue ON romaneios;
CREATE TRIGGER trg_romaneio_revenue
    AFTER UPDATE ON romaneios
    FOR EACH ROW
    EXECUTE FUNCTION generate_revenue_on_romaneio_pay();

SELECT 'Migration 031 applied successfully' as status;
