-- Migration 063: Ao limpar romaneio draft, deletar romaneio_items ANTES do romaneio
-- Assim o trigger trg_update_lot_products_stats consegue ler lot_id em romaneios e atualizar lot_products (quantidade_pedidos volta a diminuir no banco).

CREATE OR REPLACE FUNCTION clear_draft_romaneio(p_lot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_client_id UUID;
    v_lot_status TEXT;
    v_romaneio_ids UUID[];
BEGIN
    SELECT id INTO v_client_id FROM clients WHERE auth_id = auth.uid();
    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Cliente não encontrado para o usuário logado.';
    END IF;

    SELECT status INTO v_lot_status FROM lots WHERE id = p_lot_id;
    IF v_lot_status IS NULL THEN
        RAISE EXCEPTION 'Lote não encontrado.';
    END IF;
    IF v_lot_status != 'aberto' THEN
        RAISE EXCEPTION 'Só é possível limpar o rascunho enquanto o link está aberto.';
    END IF;

    -- 1) Deletar itens primeiro para o trigger update_lot_products_stats conseguir ler romaneios.lot_id e atualizar lot_products
    DELETE FROM romaneio_items
    WHERE romaneio_id IN (
        SELECT id FROM romaneios
        WHERE lot_id = p_lot_id
          AND client_id = v_client_id
          AND status_pagamento IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado')
    );

    -- 2) Depois remover o(s) romaneio(s) draft
    DELETE FROM romaneios
    WHERE lot_id = p_lot_id
      AND client_id = v_client_id
      AND status_pagamento IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado');
END;
$$;

COMMENT ON FUNCTION clear_draft_romaneio IS 'Remove o romaneio draft do cliente para o lote quando o carrinho fica vazio. Itens são deletados antes do romaneio para o trigger atualizar lot_products.';
