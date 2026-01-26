-- Fix romaneios schema: dados column is NOT NULL but checkout uses dados_pagamento
-- This causes "null value in column 'dados' violates not-null constraint" errors

-- Option 1: Make 'dados' nullable (safest if it exists)
ALTER TABLE romaneios ALTER COLUMN dados DROP NOT NULL;

-- Option 2: Set default value for 'dados' if it needs to remain NOT NULL
-- ALTER TABLE romaneios ALTER COLUMN dados SET DEFAULT '{}'::jsonb;

-- Verify the fix
COMMENT ON COLUMN romaneios.dados IS 'Legacy column - nullable to prevent checkout errors. Use dados_pagamento instead.';
