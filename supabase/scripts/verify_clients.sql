-- Verificação Definitiva de Clientes
SELECT 
    id, 
    nome, 
    role, 
    approved,
    email 
FROM clients 
LIMIT 20;

-- Ver se RLS está realmemte off
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'clients';
