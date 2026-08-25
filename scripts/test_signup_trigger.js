// Testes de regressão para o trigger public.handle_new_user (migration 076)
// e para a RPC public.check_telefone_disponivel (migration 077).
//
// Cobre os cenários pedidos na revisão do fluxo de cadastro:
//   1. cadastro normal
//   2. cadastro sem telefone (deve falhar, rollback completo)
//   3. telefone já utilizado (deve falhar, rollback completo)
//   4. e-mail de negócio já utilizado (deve falhar, rollback completo)
//   5. chamada direta à API sem passar pelo formulário (create-user Edge
//      Function, valida a regressão do bypass legacy_migration)
//   6. verificação de rollback completo de auth.users nas falhas acima
//
// Roda contra o projeto Supabase real configurado em .env (não é
// "unit test" isolado — é um smoke test de ponta a ponta, seguindo o
// mesmo padrão dos demais scripts em scripts/). Cria e remove seus
// próprios usuários de teste; NUNCA toca em contas fora do prefixo
// __e2e_test__ usado aqui.
//
// Uso: node scripts/test_signup_trigger.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Defina VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const RUN_ID = Date.now().toString().slice(-6)
const telefone = (suffix) => `119${RUN_ID}${suffix}` // 3 + 6 + 2 = 11 dígitos, únicos por execução
const createdUserIds = []

let passed = 0
let failed = 0

function report(name, ok, detail) {
  if (ok) {
    passed++
    console.log(`  OK   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name} -- ${detail}`)
  }
}

// Assina sempre com um client anônimo novo (evita reaproveitar sessão
// entre chamadas, igual a um cadastro real feito por um visitante).
function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function authUserExists(email) {
  // list_users não filtra por e-mail diretamente; para o volume de teste
  // usado aqui, paginar as primeiras páginas é suficiente.
  let page = 1
  while (page <= 5) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    if (data.users.some(u => u.email === email)) return true
    if (data.users.length < 200) break
    page++
  }
  return false
}

async function cleanupAuthUser(id) {
  if (!id) return
  await admin.auth.admin.deleteUser(id).catch(() => {})
}

async function test1_cadastroNormal() {
  const tel = telefone('01')
  const email = `__e2e_test__normal_${RUN_ID}@example.com`
  const client = anonClient()
  const { data, error } = await client.auth.signUp({
    email,
    password: 'E2eTest#Normal1',
    options: { data: { nome: 'E2E Normal', telefone: tel, role: 'cliente' } }
  })

  if (error) {
    report('cadastro normal', false, error.message)
    return
  }
  createdUserIds.push(data.user.id)

  const { data: clientRow, error: fetchError } = await admin
    .from('clients')
    .select('telefone, email, role, cadastro_status')
    .eq('auth_id', data.user.id)
    .single()

  const ok = !fetchError && clientRow?.telefone === tel && clientRow?.cadastro_status === 'pendente'
  report('cadastro normal (clients criado corretamente)', ok, fetchError?.message || JSON.stringify(clientRow))
}

async function test2_semTelefone() {
  const email = `__e2e_test__sem_telefone_${RUN_ID}@example.com`
  const client = anonClient()
  const { error } = await client.auth.signUp({
    email,
    password: 'E2eTest#NoPhone1',
    options: { data: { nome: 'E2E Sem Telefone', role: 'cliente' } }
  })

  report('cadastro sem telefone é rejeitado', !!error, 'signUp deveria ter falhado mas retornou sucesso')

  const orphan = await authUserExists(email)
  report('rollback completo (sem telefone): nenhum usuário órfão em auth.users', !orphan, 'usuário ficou criado em auth.users apesar da falha em clients')
}

async function test3_telefoneDuplicado() {
  // usa o telefone do teste 1, que já existe em clients neste momento
  const tel = telefone('01')
  const email = `__e2e_test__tel_dup_${RUN_ID}@example.com`
  const client = anonClient()

  const { data: disponivel } = await client.rpc('check_telefone_disponivel', { p_telefone: tel })
  report('RPC check_telefone_disponivel detecta telefone em uso', disponivel === false, `retornou ${disponivel}`)

  const { error } = await client.auth.signUp({
    email,
    password: 'E2eTest#DupTel1',
    options: { data: { nome: 'E2E Tel Duplicado', telefone: tel, role: 'cliente' } }
  })

  report('cadastro com telefone duplicado é rejeitado', !!error, 'signUp deveria ter falhado mas retornou sucesso')

  const orphan = await authUserExists(email)
  report('rollback completo (telefone duplicado): nenhum usuário órfão em auth.users', !orphan, 'usuário ficou criado em auth.users apesar da falha em clients')
}

async function test4_emailDuplicado() {
  // Duplicidade de clients.email só é alcançável pelo trigger quando
  // auth.users.email é sintético (fluxo legado) e email_real duplica um
  // e-mail de negócio já cadastrado — e-mail real duplicado como
  // auth.users.email é barrado antes disso pelo próprio GoTrue.
  const emailDuplicado = `__e2e_test__normal_${RUN_ID}@example.com` // criado no teste 1
  const tel = telefone('02')
  const client = anonClient()

  const { error } = await client.auth.signUp({
    email: `${tel}@artea.local`,
    password: 'E2eTest#DupEmail1',
    options: { data: { nome: 'E2E Email Duplicado', telefone: tel, email_real: emailDuplicado } }
  })

  report('cadastro com e-mail de negócio duplicado é rejeitado', !!error, 'signUp deveria ter falhado mas retornou sucesso')

  const orphan = await authUserExists(`${tel}@artea.local`)
  report('rollback completo (e-mail duplicado): nenhum usuário órfão em auth.users', !orphan, 'usuário ficou criado em auth.users apesar da falha em clients')
}

async function test5_createUserEdgeFunction() {
  // Chamada direta à API (Edge Function), sem passar pelo formulário
  // Register.jsx. Também cobre a regressão do bypass legacy_migration:
  // antes da migration 076, essa chamada falhava com conflito de
  // auth_id porque o trigger também tentava inserir em clients.
  const tel = telefone('03')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'E2eTest#CreateFn1', nome: 'E2E CreateUser Fn', telefone: tel })
  })
  const body = await res.json()

  report('create-user Edge Function cria usuário sem conflito com o trigger', res.ok, JSON.stringify(body))

  if (res.ok && body.user?.id) {
    createdUserIds.push(body.user.id)
    const { data: clientRow, error } = await admin
      .from('clients')
      .select('telefone')
      .eq('auth_id', body.user.id)
      .single()
    report('create-user Edge Function: exatamente uma linha em clients', !error && clientRow?.telefone === tel, error?.message)
  }
}

async function main() {
  console.log(`Rodando testes do trigger handle_new_user (run ${RUN_ID})\n`)

  await test1_cadastroNormal()
  await test2_semTelefone()
  await test3_telefoneDuplicado()
  await test4_emailDuplicado()
  await test5_createUserEdgeFunction()

  console.log('\nLimpando usuários de teste...')
  for (const id of createdUserIds) {
    await cleanupAuthUser(id)
  }
  console.log(`Removidos ${createdUserIds.length} usuário(s) de teste.`)

  console.log(`\nResultado: ${passed} passaram, ${failed} falharam.`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Erro inesperado ao rodar os testes:', err)
  process.exit(1)
})
