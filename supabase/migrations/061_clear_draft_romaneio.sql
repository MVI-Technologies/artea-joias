-- Migration 061: RPC para limpar rascunho de romaneio quando o cliente esvazia o carrinho (link ainda aberto)
-- Usado no fluxo de auto-save: carrinho vazio = remover romaneio draft no servidor.

CREATE OR REPLACE FUNCTION clear_draft_romaneio(p_lot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_client_id UUID;
    v_lot_status TEXT;
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

    DELETE FROM romaneios
    WHERE lot_id = p_lot_id
      AND client_id = v_client_id
      AND status_pagamento IN ('aguardando_pagamento', 'aguardando', 'pendente', 'gerado');
END;
$$;

COMMENT ON FUNCTION clear_draft_romaneio IS 'Remove o romaneio draft do cliente para o lote quando o carrinho fica vazio (link aberto).';

GRANT EXECUTE ON FUNCTION clear_draft_romaneio(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_draft_romaneio(UUID) TO service_role;
