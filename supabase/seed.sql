-- =====================================================
-- SEED DATA - Artea Joias
-- Dados de exemplo para desenvolvimento e testes
-- =====================================================

-- =====================================================
-- PRODUTOS DE EXEMPLO
-- =====================================================

INSERT INTO products (nome, descricao, categoria_id, imagem1, custo, margem_pct, ativo) VALUES
-- Pulseiras
('Pulseira Dourada Elegante', 'Pulseira banhada a ouro 18k com design moderno', 
  (SELECT id FROM categories WHERE nome = 'Pulseira' LIMIT 1), 
  '/images/products/pulseira-dourada.jpg', 25.00, 15, true),

('Pulseira Prata Delicada', 'Pulseira em prata com detalhe de coração',
  (SELECT id FROM categories WHERE nome = 'Pulseira' LIMIT 1),
  '/images/products/pulseira-prata.jpg', 20.00, 18, true),

-- Conjuntos
('Conjunto Coração', 'Conjunto colar + brincos com pingente de coração',
  (\SELECT id FROM categories WHERE nome = 'Conjunto' LIMIT 1),
  '/images/products/conjunto-coracao.jpg', 45.00, 20, true),

('Conjunto Luxo Rosa', 'Conjunto completo com pedras rosa',
  (SELECT id FROM categories WHERE nome = 'Conjunto' LIMIT 1),
  '/images/products/conjunto-rosa.jpg', 55.00, 22, true),

-- Brincos
('Brinco Argola Grande', 'Brinco argola banhado a ouro',
  (SELECT id FROM categories WHERE nome = 'Brinco' LIMIT 1),
  '/images/products/brinco-argola.jpg', 18.00, 15, true),

('Brinco Pérola Clássico', 'Brinco com pérola sintética elegante',
  (SELECT id FROM categories WHERE nome = 'Brinco' LIMIT 1),
  '/images/products/brinco-perola.jpg', 22.00, 16, true),

-- Colares
('Colar Pingente Estrela','Colar delicado com pingente de estrela',
  (SELECT id FROM categories WHERE nome = 'Colar' LIMIT 1),
  '/images/products/colar-estrela.jpg', 28.00, 18, true),

('Colar Corrente Grossa', 'Colar estilo corrente dourada',
  (SELECT id FROM categories WHERE nome = 'Colar' LIMIT 1),
  '/images/products/colar-corrente.jpg', 32.00, 20, true),

-- Anéis
('Anel Solitário Zircônia', 'Anel com pedra de zircônia cúbica',
  (SELECT id FROM categories WHERE nome = 'Anel' LIMIT 1),
  '/images/products/anel-solitario.jpg', 15.00, 15, true),

('Anel Aliança Fina', 'Anel aliança banhado a ouro rosé',
  (SELECT id FROM categories WHERE nome = 'Anel' LIMIT 1),
  '/images/products/anel-alianca.jpg', 12.00, 14, true),

-- Tornozeleira
('Tornozeleira Estrelas', 'Tornozeleira delicada com pingentes de estrela',
  (SELECT id FROM categories WHERE nome = 'Tornozeleira' LIMIT 1),
  '/images/products/tornozeleira-estrelas.jpg', 18.00, 16, true),

-- Piercing
('Piercing Pequeno Dourado', 'Piercing para nariz ou orelha banhado a ouro',
  (SELECT id FROM categories WHERE nome = 'Piercing' LIMIT 1),
  '/images/products/piercing-dourado.jpg', 8.00, 12, true),

('Piercing Argola Prata', 'Piercing argola em prata',
  (SELECT id FROM categories WHERE nome = 'Piercing' LIMIT 1),
  '/images/products/piercing-argola.jpg', 10.00, 13, true)

ON CONFLICT DO NOTHING;

-- =====================================================
-- LOTE DE EXEMPLO
-- =====================================================

INSERT INTO lots (nome, descricao, quantidade_minima, data_inicio, data_fim, status, link_compra) VALUES
('Link Janeiro 2025', 'Coleção Verão 2025 - Peças exclusivas para a temporada', 12, 
  NOW(), NOW() + INTERVAL '7 days', 'aberto', 'link-janeiro-2025')
ON CONFLICT (link_compra) DO NOTHING;

-- =====================================================
-- PRODUTOS DO LOTE
-- =====================================================

-- Adicionar produtos ao lote
INSERT INTO lot_products (lot_id, product_id, quantidade_pedidos)
SELECT 
  (SELECT id FROM lots WHERE link_compra = 'link-janeiro-2025' LIMIT 1),
  p.id,
  0
FROM products p
WHERE p.ativo = true
LIMIT 8
ON CONFLICT (lot_id, product_id) DO NOTHING;

-- =====================================================
-- PEDIDOS DE EXEMPLO (se houver clientes)
-- =====================================================

-- Nota: Pedidos só serão criados se houver clientes cadastrados
-- Isso será feito manualmente ou após cadastro de clientes

-- =====================================================
-- VERIFICAÇÃO DOS DADOS
-- =====================================================

-- Ver categorias
SELECT 
  'Categorias' as tipo,
  COUNT(*) as total
FROM categories;

-- Ver produtos por categoria
SELECT 
  c.nome as categoria,
  COUNT(p.id) as total_produtos
FROM categories c
LEFT JOIN products p ON p.categoria_id = c.id
GROUP BY c.nome
ORDER BY c.nome;

-- Ver lotes
SELECT 
  nome,
  status,
  quantidade_minima,
  data_fim,
  (SELECT COUNT(*) FROM lot_products WHERE lot_id = lots.id) as produtos_no_lote
FROM lots;

-- Ver resumo geral
SELECT 
  'Produtos' as tipo,
  COUNT(*) as total
FROM products
UNION ALL
SELECT 
  'Categorias',
  COUNT(*)
FROM categories
UNION ALL
SELECT 
  'Lotes',
  COUNT(*)
FROM lots;
