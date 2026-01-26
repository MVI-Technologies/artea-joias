import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Configurar dotenv
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../.env') })

if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Erro: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env')
  process.exit(1)
}

// Criar cliente Admin (Service Role)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function migrateClients() {
  console.log('🚀 Iniciando migração de clientes para Auth...')
  
  // 1. Buscar clientes sem auth_id
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .is('auth_id', null)

  if (error) {
    console.error('❌ Erro ao buscar clientes:', error)
    return
  }

  if (!clients || clients.length === 0) {
    console.log('✅ Nenhum cliente pendente de migração.')
    return
  }

  console.log(`📋 Encontrados ${clients.length} clientes para processar.`)

  let successCount = 0
  let errorCount = 0
  let skippedCount = 0

  for (const client of clients) {
    try {
      console.log(`\nProcessando: ${client.nome} (ID: ${client.id})`)

      // Validar dados mínimos
      if (!client.email && !client.telefone) {
        console.warn(`⚠️ Cliente sem email e telefone. Pulando.`)
        skippedCount++
        continue
      }

      // Definir Email (Gerar fictício se não tiver)
      let email = client.email
      if (!email) {
        // Formatar telefone para remover caracteres não numéricos
        const phoneNumbers = client.telefone.replace(/\D/g, '')
        email = `${phoneNumbers}@arteajoias.temp`
        console.log(`   ℹ️ Email gerado: ${email}`)
      }

      const password = '123456' // Senha temporária
      let authUserId = null

      // 2. Verificar se usuário já existe no Auth
      // Nota: listUsers não permite filtro direto por email de forma eficiente individualmente API pública,
      // mas podemos tentar criar e capturar o erro de "User already registered" ou usar admin.listUsers() 
      // Para eficiência e atomicidade, vamos tentar criar.

      const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Auto confirmar
        user_metadata: {
          nome: client.nome,
          telefone: client.telefone,
          legacy_migration: true
        }
      })

      if (createError) {
        // Se erro for "Email already exists", buscamos o usuário existente
        /* 
           Nota: A mensagem exata pode variar, geralmente checamos o status ou mensagem.
           Mas a Admin API tem um método getUserById, mas não getByEmail direto simples sem listar.
           Porém, create retorna erro específico.
        */
        
        // Estratégia alternativa: Listar usuários para encontrar o ID se já existir
        // (Isso é um pouco mais pesado, mas seguro para script de migração one-off)
        const { data: { users } } = await supabase.auth.admin.listUsers()
        const existingUser = users.find(u => u.email === email)

        if (existingUser) {
          console.log(`   ℹ️ Usuário já existe no Auth. Vinculando ID: ${existingUser.id}`)
          authUserId = existingUser.id
        } else {
          console.error(`   ❌ Erro ao criar usuário e não encontrado: ${createError.message}`)
          errorCount++
          continue
        }
      } else {
        console.log(`   ✅ Usuário criado no Auth. ID: ${createdUser.user.id}`)
        authUserId = createdUser.user.id
      }

      // 3. Atualizar tabela clients
      if (authUserId) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ 
            auth_id: authUserId,
            approved: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', client.id)

        if (updateError) {
          console.error(`   ❌ Erro ao atualizar cliente no banco: ${updateError.message}`)
          errorCount++
        } else {
          console.log(`   ✨ Cliente vinculado e aprovado com sucesso!`)
          successCount++
        }
      }

    } catch (err) {
      console.error(`   ❌ Erro inesperado no cliente ${client.id}:`, err)
      errorCount++
    }
  }

  console.log('\n==========================================')
  console.log('🏁 Migração Finalizada')
  console.log(`✅ Sucessos: ${successCount}`)
  console.log(`⚠️ Pulados: ${skippedCount}`)
  console.log(`❌ Falhas: ${errorCount}`)
  console.log('==========================================')
}

migrateClients()
