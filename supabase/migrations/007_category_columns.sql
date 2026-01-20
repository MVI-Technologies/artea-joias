-- =====================================================
-- Ajustes para CategoryList (Imagem 4 de referência)
-- =====================================================

-- Adicionar colunas para código e percentuais
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS codigo TEXT;

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS comissao_pct NUMERIC(5,2) DEFAULT 0;

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS desconto_pct NUMERIC(5,2) DEFAULT 0;

-- Atualizar categorias existentes com códigos
UPDATE categories SET codigo = 'AL' WHERE nome = 'Aliança';
UPDATE categories SET codigo = 'AN' WHERE nome = 'Anel';
UPDATE categories SET codigo = 'BIT' WHERE nome = 'Bracelete';
UPDATE categories SET codigo = 'BR' WHERE nome = 'Brinco';
UPDATE categories SET codigo = 'CHO' WHERE nome = 'Choker';
UPDATE categories SET codigo = 'CL' WHERE nome = 'Colar';
UPDATE categories SET codigo = 'CON' WHERE nome = 'Conjunto';
UPDATE categories SET codigo = 'COR' WHERE nome = 'Corrente';
UPDATE categories SET codigo = 'ELO' WHERE nome = 'Elo';
UPDATE categories SET codigo = 'ESC' WHERE nome = 'Escapulário';
UPDATE categories SET codigo = 'GAR' WHERE nome = 'Gargantilha';
UPDATE categories SET codigo = 'PIE' WHERE nome = 'Piercing';
UPDATE categories SET codigo = 'PIN' WHERE nome = 'Pingente';
UPDATE categories SET codigo = 'PUL' WHERE nome = 'Pulseira';
UPDATE categories SET codigo = 'TOR' WHERE nome = 'Tornozeleira';
UPDATE categories SET codigo = 'OUT' WHERE nome = 'Outros';

-- Para categorias sem código, gerar automaticamente
UPDATE categories 
SET codigo = UPPER(LEFT(nome, 3))
WHERE codigo IS NULL;

-- Verificar
SELECT codigo, nome, comissao_pct, desconto_pct FROM categories ORDER BY nome;
