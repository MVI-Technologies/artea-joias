-- Migration 056: Adicionar campo recipients à tabela whatsapp_messages
-- Permite armazenar a lista completa de destinatários com status de envio

ALTER TABLE whatsapp_messages 
ADD COLUMN IF NOT EXISTS recipients JSONB;

COMMENT ON COLUMN whatsapp_messages.recipients IS 'Lista completa de destinatários com status: [{nome, telefone, success, error?}]';
