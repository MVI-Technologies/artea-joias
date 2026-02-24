-- Adiciona flag de esgotado manual por produto dentro do lote.
-- Permite o admin marcar um produto como "esgotado" mesmo com disponibilidade > 0.

ALTER TABLE lot_products
ADD COLUMN IF NOT EXISTS manual_esgotado BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN lot_products.manual_esgotado IS
  'Quando TRUE, o produto é tratado como esgotado no catálogo, mesmo que a disponibilidade calculada do lote seja > 0.';

