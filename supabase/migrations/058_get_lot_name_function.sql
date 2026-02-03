CREATE OR REPLACE FUNCTION get_lot_name_by_id(p_lot_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nome TEXT;
BEGIN
  SELECT nome INTO v_nome FROM lots WHERE id = p_lot_id;
  RETURN v_nome;
END;
$$;
