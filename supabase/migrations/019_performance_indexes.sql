-- MIGRATION 019: Performance Indexes
-- Motivo: Usuário relatou lentidão nas requisições do cliente.
-- Causa provavel: Falta de índices em colunas usadas para filtros e joins frequentes.

-- 1. Clients: Busca por auth_id (login/perfil) e status
CREATE INDEX IF NOT EXISTS idx_clients_auth_id ON clients(auth_id);
CREATE INDEX IF NOT EXISTS idx_clients_role ON clients(role); -- Filtrar quem é cliente vs admin

-- 2. Lots: Busca por status (aberto) e ordenação por data
CREATE INDEX IF NOT EXISTS idx_lots_status ON lots(status);
CREATE INDEX IF NOT EXISTS idx_lots_created_at ON lots(created_at DESC);

-- 3. Orders: Busca por client_id (histórico) e lot_id (carrinho/vendas)
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_lot_id ON orders(lot_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 4. Lot Products: Join com lotes
CREATE INDEX IF NOT EXISTS idx_lot_products_lot_id ON lot_products(lot_id);

-- 5. Romaneios: Busca por cliente
CREATE INDEX IF NOT EXISTS idx_romaneios_client_id ON romaneios(client_id);

-- Otimizar RLS da tabela de clientes (Crítico)
-- Se a policy usa "EXISTS" ou checagens, índices ajudam muito.
ANALYZE clients;
ANALYZE orders;
