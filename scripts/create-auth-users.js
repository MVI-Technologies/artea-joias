// Script Node.js para criar usuários auth para clientes existentes
// Execute com: node create-auth-users.js
// Requer: npm install @supabase/supabase-js dotenv

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

// ⚠️ Use sua SERVICE_ROLE_KEY (não a anon key)
const supabase = createClient(
  process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY'
)

async function createAuthUsersForClients() {
  console.log('🔍 Buscando clientes sem auth_id...')
  
  // Buscar todos os clientes sem auth_id
  const { data: clients, error: fetchError } = await supabase
    .from('clients')
    .select('*')
    .is('auth_id', null)
    .not('telefone', 'is', null)
  
  if (fetchError) {
    console.error('❌ Erro ao buscar clientes:', fetchError)
    return
  }
  
  if (!clients || clients.length === 0) {
    console.log('✅ Todos os clientes já têm usuário auth!')
    return
  }
  
  console.log(`📋 Encontrados ${clients.length} clientes sem usuário auth`)
  console.log('---')
  
  let success = 0
  let failed = 0
  
  // Criar usuário para cada cliente
  for (const client of clients) {
    const email = `${client.telefone}@artea.local`
    
    console.log(`\n📝 Criando usuário para: ${client.nome}`)
    console.log(`   Telefone: ${client.telefone}`)
    console.log(`   Email: ${email}`)
    
    try {
      // Criar usuário no auth
      const { data: user, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: '123456',
        email_confirm: true, // Auto-confirmar email
        user_metadata: {
          nome: client.nome,
          telefone: client.telefone,
          email_real: client.email || '',
          role: 'cliente'
        }
      })
      
      if (authError) throw authError
      
      console.log(`   ✅ Auth user criado: ${user.user.id}`)
      
      // Atualizar cliente com auth_id
      const { error: updateError } = await supabase
        .from('clients')
        .update({ 
          auth_id: user.user.id,
          approved: true,
          cadastro_status: 'completo',
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id)
      
      if (updateError) throw updateError
      
      console.log(`   ✅ Cliente atualizado com auth_id`)
      success++
      
    } catch (error) {
      console.error(`   ❌ Erro: ${error.message}`)
      failed++
    }
  }
  
  console.log('\n' + '='.repeat(50))
  console.log(`\n📊 Resumo:`)
  console.log(`   ✅ Sucesso: ${success}`)
  console.log(`   ❌ Falhas: ${failed}`)
  console.log(`   📋 Total: ${clients.length}`)
  console.log('\n💡 Senha padrão para todos: 123456')
  console.log('🔐 Login: usar telefone no formato (XX) XXXXX-XXXX\n')
}

// Executar
createAuthUsersForClients()
  .then(() => {
    console.log('✅ Script finalizado!')
    process.exit(0)
  })
  .catch(err => {
    console.error('❌ Erro fatal:', err)
    process.exit(1)
  })
