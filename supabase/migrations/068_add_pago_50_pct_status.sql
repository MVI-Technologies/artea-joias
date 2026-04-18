-- Migration 068: Status "Pago 50%" para romaneios

ALTER TABLE romaneios
DROP CONSTRAINT IF EXISTS romaneios_status_pagamento_check;

ALTER TABLE romaneios
ADD CONSTRAINT romaneios_status_pagamento_check
CHECK (status_pagamento IN (
  'aguardando_pagamento',
  'aguardando',
  'pago',
  'pago_frete_incluso',
  'pago_50_pct',
  'em_separacao',
  'enviado',
  'concluido',
  'cancelado',
  'fechado_insuficiente',
  'admin_purchase',
  'pendente'
));

COMMENT ON CONSTRAINT romaneios_status_pagamento_check ON romaneios IS 'Inclui pago_50_pct para pagamentos parciais (50%) do romaneio';
