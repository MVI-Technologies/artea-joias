-- =====================================================
-- TABELA: whatsapp_messages (Histórico de Mensagens WhatsApp)
-- =====================================================

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message TEXT NOT NULL,
    destination_filter TEXT DEFAULT 'todos' 
        CHECK (destination_filter IN ('todos', 'aprovados', 'pendentes')),
    total_recipients INT DEFAULT 0,
    success_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    status TEXT DEFAULT 'enviando' 
        CHECK (status IN ('enviando', 'enviado', 'parcial', 'erro')),
    errors JSONB, -- Array de erros [{client: "Nome", error: "Mensagem"}]
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);

-- RLS (Row Level Security)
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins podem ver e criar mensagens
CREATE POLICY "Admins can view whatsapp messages" ON whatsapp_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM clients 
            WHERE clients.id = auth.uid() 
            AND clients.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert whatsapp messages" ON whatsapp_messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM clients 
            WHERE clients.id = auth.uid() 
            AND clients.role = 'admin'
        )
    );

CREATE POLICY "Admins can update whatsapp messages" ON whatsapp_messages
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM clients 
            WHERE clients.id = auth.uid() 
            AND clients.role = 'admin'
        )
    );

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'Tabela whatsapp_messages criada com sucesso!' as info;

