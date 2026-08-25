// Teste de regressão para a Edge Function reset-password (fluxo de
// recuperação de senha por telefone para clientes legados).
//
// Contexto do bug corrigido: a função buscava o usuário do Auth via
// GET /auth/v1/admin/users?email=... construindo variações do e-mail
// sintético {telefone}@artea.local. Esse endpoint do GoTrue IGNORA o
// parâmetro `email` e devolve a primeira página de todos os usuários
// ordenada por atividade recente — o código sempre pegava `users[0]`,
// ou seja, trocava a senha do usuário mais recentemente ativo no
// sistema INTEIRO, não a do dono do telefone/código validados. A
// correção usa `clients.auth_id` (já obtido pelo join na consulta a
// password_reset_codes) diretamente, eliminando a adivinhação.
//
// Este teste prova o cenário exato do bug: cria a conta "alvo" (dona
// do telefone/código), depois cria uma segunda conta "bystander" mais
// recentemente ativa, roda a recuperação para o telefone da conta alvo
// e confirma que (a) a senha da conta alvo mudou e (b) a senha da
// conta bystander permaneceu intocada.
//
// Uso: node scripts/test_reset_password_legacy.js

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

async function createTestUser(suffix, senha) {
  const telefone = `1197${RUN_ID}${suffix}` // 4 + 6 + 2 = 12 dígitos, únicos por execução
  const email = `__e2e_test__resetpwd_${suffix}_${RUN_ID}@example.com`
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha, nome: `E2E ResetPwd ${suffix}`, telefone })
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`create-user falhou para ${suffix}: ${JSON.stringify(body)}`)
  createdUserIds.push(body.user.id)
  return { id: body.user.id, email, telefone }
}

async function signInOk(email, password) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  return !error
}

async function main() {
  console.log(`Rodando teste de regressão do reset-password legado (run ${RUN_ID})\n`)

  const alvoSenhaOriginal = 'Original#Pass1'
  const alvoSenhaNova = 'Recovered#Pass2'
  const bystanderSenha = 'Bystander#Pass1'

  const alvo = await createTestUser('01', alvoSenhaOriginal)
  // Cria o "bystander" DEPOIS, para que ele seja o usuário mais
  // recentemente ativo no momento da recuperação — exatamente a
  // condição que disparava o bug antigo.
  const bystander = await createTestUser('02', bystanderSenha)

  const codigo = '5' + String(Math.floor(10000 + Math.random() * 89999)) // 6 dígitos
  const { data: client, error: clientError } = await admin
    .from('clients')
    .select('id')
    .eq('auth_id', alvo.id)
    .single()
  if (clientError) throw clientError

  const { error: insertError } = await admin
    .from('password_reset_codes')
    .insert({
      client_id: client.id,
      telefone: alvo.telefone,
      code: codigo,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      used: false
    })
  if (insertError) throw insertError

  const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: codigo, telefone: alvo.telefone, newPassword: alvoSenhaNova })
  })
  const body = await res.json()
  report('reset-password aceita código válido do telefone alvo', res.ok && body.success, JSON.stringify(body))

  const alvoLogouComSenhaNova = await signInOk(alvo.email, alvoSenhaNova)
  report('conta ALVO: login com a nova senha funciona', alvoLogouComSenhaNova, 'esperado sucesso no login com a senha recém-definida')

  const bystanderContinuaComSenhaOriginal = await signInOk(bystander.email, bystanderSenha)
  report('conta BYSTANDER (mais recentemente ativa): senha original intocada', bystanderContinuaComSenhaOriginal, 'a senha do bystander foi alterada — regressão do bug de conta errada')

  console.log('\nLimpando usuários de teste...')
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  console.log(`Removidos ${createdUserIds.length} usuário(s) de teste.`)

  console.log(`\nResultado: ${passed} passaram, ${failed} falharam.`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Erro inesperado ao rodar o teste:', err)
  process.exit(1)
})
