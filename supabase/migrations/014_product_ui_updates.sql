-- =====================================================
-- MIGRATION 014: Atualização de Campos de Produto (UI Nova)
-- =====================================================

-- 1. Adicionar campos de Variações e Descrição detalhada
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variacoes TEXT, -- Para "Variações/Tamanho (separados por vírgula)"
ADD COLUMN IF NOT EXISTS observacoes TEXT; -- Para "Observações" (descrição longa pública)

-- 2. Adicionar campos de Regras de Quantidade
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS qtd_minima_fornecedor INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS qtd_maxima_fornecedor INT,
ADD COLUMN IF NOT EXISTS qtd_minima_cliente INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS multiplo_pacote INT DEFAULT 1; -- "Múltiplo do Fornecedor Peças por pacote"

-- 3. Adicionar campos de Gestão e Metadados
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS posicao_catalogo INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS anotacoes_internas TEXT, -- "Anotações Internas"
ADD COLUMN IF NOT EXISTS revisar_produto BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS registrar_peso BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS registrar_preco_custo BOOLEAN DEFAULT false;

-- 4. Índices para performance (opcional mas recomendado)
CREATE INDEX IF NOT EXISTS idx_products_posicao ON products(posicao_catalogo);

-- 5. Verificar aplicação
DO $$
BEGIN
    RAISE NOTICE 'Migration 014 aplicada com sucesso: Campos de UI adicionados.';
END $$;
