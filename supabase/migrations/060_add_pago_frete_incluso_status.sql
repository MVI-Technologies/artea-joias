-- Migration 060: Status "Pago com Frete Incluso" para romaneios
-- Permite ao admin marcar quando o cliente pagou já com frete incluso.

ALTER TABLE romaneios
DROP CONSTRAINT IF EXISTS romaneios_status_pagamento_check;

ALTER TABLE romaneios
ADD CONSTRAINT romaneios_status_pagamento_check
CHECK (status_pagamento IN (
  'aguardando_pagamento',
  'aguardando',
  'pago',
  'pago_frete_incluso',
  'em_separacao',
  'enviado',
  'concluido',
  'cancelado',
  'fechado_insuficiente',
  'admin_purchase',
  'pendente'
));

COMMENT ON CONSTRAINT romaneios_status_pagamento_check ON romaneios IS 'Inclui pago_frete_incluso para pagamento com frete incluso';
