-- DIAGNOSTICO CLIENTES
-- 1. Contar total real (bypass RLS)
SELECT 'Total Real Clientes: ' || count(*) FROM clients;

-- 2. Ver Policies atuais
select * from pg_policies where tablename = 'clients';

-- 3. Simular query de admin (se possivel, mas aqui sou superuser)
-- O problema provavel é que falta uma policy "Admin vê tudo" na tabela clients.
-- Na migration 017 eu adicionei "Ler proprio perfil", mas esqueci de permitir que Admin leia OS OUTROS.
