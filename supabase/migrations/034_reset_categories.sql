-- Migration 034: Reset Categories List
-- Description: Clears existing categories and inserts a specific list of new categories.
--              Unassociates existing products to prevent foreign key errors.

-- 1. Desassociar produtos de categorias existentes (para evitar erro de FK)
UPDATE products SET categoria_id = NULL;

-- 2. Limpar tabela de categorias
DELETE FROM categories;

-- 3. Inserir novas categorias
INSERT INTO categories (nome) VALUES 
    ('Aliança'),
    ('Anel'),
    ('Bracelete'),
    ('Brinco'),
    ('Choker'),
    ('Colar'),
    ('Conjunto'),
    ('Corrente'),
    ('Elo'),
    ('Escapulário'),
    ('Gargantilha'),
    ('Piercing'),
    ('Pingente'),
    ('Pulseira'),
    ('Tornozeleira');
