-- =====================================================
-- MIGRATION 037: INSERT DEFAULT PAYMENT OPTIONS
-- Insere opções de pagamento padrão para uso nos catálogos
-- IMPORTANTE: Execute a migration 036 primeiro!
-- =====================================================

-- Verificar se a tabela existe antes de inserir
DO $$
BEGIN
  -- Verificar se a tabela payment_options existe
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_options'
  ) THEN
    -- Inserir opção de pagamento padrão (exemplo)
    INSERT INTO payment_options (nome, descricao, tipo, dados_config, ativo)
    VALUES (
      'PIX e Cartão via Link',
      'PIX: CPF 37497876844 Caio Vinícius Puiani - Itaú S/A CARTÃO DE CRÉDITO (com taxas): Via Link',
      'outro',
      '{"chave_pix": "37497876844", "banco": "Itaú", "nome_beneficiario": "Caio Vinícius Puiani", "link_pagamento": ""}'::jsonb,
      true
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Opção de pagamento padrão inserida com sucesso!';
  ELSE
    RAISE EXCEPTION 'Tabela payment_options não existe. Execute a migration 036 primeiro!';
  END IF;
END $$;

-- Comentário: Para adicionar mais opções de pagamento, você pode:
-- 1. Usar a interface de administração (quando implementada)
-- 2. Executar INSERTs SQL diretamente na tabela payment_options
-- 3. Usar o Supabase Dashboard

SELECT 'Migration 037 applied successfully!' as status;
SELECT 'Default payment option inserted' as feature;
