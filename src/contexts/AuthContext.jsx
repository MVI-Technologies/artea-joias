import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // NÃO chamar supabase.auth.getSession() aqui além do listener abaixo.
    // onAuthStateChange já emite um evento INITIAL_SESSION assim que se
    // inscreve (depois de aguardar a inicialização do client), então uma
    // segunda chamada concorrente a getSession() nesse mesmo instante disputa
    // o mesmo lock exclusivo do navigator.locks (chave "lock:<storageKey>")
    // usado internamente pelo supabase-js. Quando a inicialização demora mais
    // que o timeout do lock — como acontece ao abrir a página vindo de um
    // link de confirmação de e-mail/recuperação de senha, cujo token na URL
    // precisa ser trocado via rede antes da sessão ficar pronta — a segunda
    // chamada é abortada e rejeita com "signal is aborted without reason",
    // quebrando silenciosamente a confirmação. Ver também ResetPassword.jsx,
    // que tinha o mesmo padrão.

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event)
        
        // Proteção de LocalStorage: Evitar vazamento de carrinho entre contas
        if (event === 'SIGNED_IN' && session?.user) {
          const currentOwner = localStorage.getItem('cart_owner_id')
          if (currentOwner && currentOwner !== session.user.id) {
            console.log('🧹 Diferente usuário detectado. Limpando LocalStorage...')
            clearCartLocalStorage()
          }
          localStorage.setItem('cart_owner_id', session.user.id)
        } else if (event === 'SIGNED_OUT') {
          console.log('🧹 Usuário saiu. Limpando LocalStorage...')
          clearCartLocalStorage()
          localStorage.removeItem('cart_owner_id')
        }

        if (session?.user) {
          setUser(session.user)
          // Não aguardar fetchClientProfile para não travar o loading
          fetchClientProfile(session.user).catch(err => {
            console.warn('Erro ao buscar perfil (não crítico):', err)
          })
        } else {
          setUser(null)
          setClient(null)
          setIsAdmin(false)
        }
        // Sempre definir loading como false após mudança de auth
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchClientProfile = async (authUser) => {
    try {
      console.log('🔍 Iniciando busca de perfil para:', authUser.id)
      
      // ✅ PRIORITY 1: Ler role do metadata da sessão (INSTANTÂNEO!)
      const roleFromMetadata = authUser.user_metadata?.role || authUser.app_metadata?.role
      
      if (roleFromMetadata) {
        console.log('✅ Role encontrada no metadata:', roleFromMetadata)
        const isAdminFromMetadata = roleFromMetadata === 'admin'
        setIsAdmin(isAdminFromMetadata)
        console.log('✅ isAdmin definido como:', isAdminFromMetadata)
      } else {
        console.warn('⚠️ Role não encontrada no metadata, buscando no banco...')
      }
      
      // ✅ PRIORITY 2: Buscar perfil completo da tabela clients (dados adicionais)
      console.log('📊 Consultando tabela clients...')
      
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('auth_id', authUser.id)
          .single()

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Erro ao buscar perfil da tabela:', error)
        console.error('Código do erro:', error.code)
        console.error('Mensagem:', error.message)
        
        // Se já temos role do metadata, não é crítico
        if (roleFromMetadata) {
          console.log('✅ Mas temos role do metadata, continuando...')
        } else {
          console.error('❌ E não temos role no metadata! Problema crítico.')
        }
        return
      }

      if (data) {
        console.log('✅ Perfil encontrado na tabela clients:', data)
        
        // ⚠️ CRITICAL: Check if client is approved (only for non-admin users)
        if (data.role !== 'admin' && data.approved === false) {
          console.warn('⛔ Cliente não aprovado! Bloqueando acesso...')
          
          // Sign out the user
          await supabase.auth.signOut()
          
          // Throw error to be caught by login flow
          throw new Error('PENDING_APPROVAL:Seu cadastro ainda está pendente de aprovação pela administração. Aguarde o contato do administrador.')
        }
        
        setClient(data)
        
        // Verificar se role do DB é diferente do metadata
        if (roleFromMetadata && data.role !== roleFromMetadata) {
          console.warn('⚠️ DISCREPÂNCIA DE ROLE!')
          console.warn('   Metadata:', roleFromMetadata)
          console.warn('   Database:', data.role)
          console.warn('   Usando role do DATABASE (mais atualizado)')
        }
        
        // Sempre usar role do database se disponível (source of truth)
        const isAdminFromDB = data.role === 'admin'
        setIsAdmin(isAdminFromDB)
        console.log('✅ isAdmin atualizado do DB:', isAdminFromDB)
      } else if (!roleFromMetadata) {
        // FALLBACK: nem metadata nem DB
        console.warn('⚠️ Nenhum perfil encontrado e sem metadata')
        console.warn('⚠️ Definindo como cliente por padrão')
        setIsAdmin(false)
      } else {
        console.log('ℹ️ Perfil não encontrado no DB, mas temos metadata')
      }
      } catch (queryError) {
        // Se der erro na query, não é crítico se temos metadata
        if (roleFromMetadata) {
          console.warn('⚠️ Erro ao buscar perfil do DB, mas temos metadata. Continuando...')
        } else {
          console.error('⚠️ Erro ao buscar perfil:', queryError)
        }
      }
    } catch (error) {
      console.error('❌ Exceção ao buscar perfil:', error)
      
      // Check if it's the PENDING_APPROVAL error - if so, re-throw it
      if (error.message?.includes('PENDING_APPROVAL')) {
        throw error
      }
      
      console.error('❌ Tipo de erro:', error.name)
      console.error('❌ Stack:', error.stack)
      // NÃO resetar isAdmin se já foi definido do metadata
    }
  }

  // Login principal: e-mail + senha (Supabase Auth nativo).
  const signInWithEmail = async (email, senha) => {
    try {
      const emailLimpo = (email || '').trim().toLowerCase()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailLimpo,
        password: senha
      })
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  }

  // Login legado: apenas para clientes antigos que ainda não têm e-mail
  // cadastrado. Mantido temporariamente durante a migração para e-mail.
  const signIn = async (telefone, senha) => {
    try {
      console.log('📞 Tentando login com telefone:', telefone)
      
      // Remover formatação mas manter +
      const telefoneLimpo = telefone.replace(/[^\d+]/g, '')
      const emailBase = telefoneLimpo.replace(/\+/g, '')
      console.log('📞 Telefone limpo:', telefoneLimpo, '| emailBase:', emailBase)

      // Derivação sem prefixo do país para compatibilidade com contas legadas.
      // Ex: usuário seleciona +55 e digita (44) 99982-9082
      // → emailBase = "5544999829082" mas o email no Auth é "44999829082@artea.local"
      const stripCountryPrefix = (digits) => {
        if (digits.startsWith('55') && (digits.length === 13 || digits.length === 12)) return digits.slice(2)
        if (digits.startsWith('1') && digits.length === 11) return digits.slice(1)
        return null
      }
      const semPrefixo = stripCountryPrefix(emailBase)

      // Tentar diferentes variações do email
      const emailVariations = [
        `${emailBase}@artea.local`,                        // Ex: 5544999829082@artea.local (novo)
        semPrefixo ? `${semPrefixo}@artea.local` : null,  // Ex: 44999829082@artea.local (legado)
      ].filter(Boolean)
      
      console.log('📧 Tentando emails:', emailVariations)
      
      // Tentar cada variação até encontrar uma que funcione
      let lastError = null
      for (const email of emailVariations) {
        try {
          console.log(`🔄 Tentando login com email: ${email}`)
          
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: senha
          })

          if (!error) {
            console.log('✅ Login bem-sucedido!', data)
            console.log(`✅ Email correto encontrado: ${email}`)
            return { data, error: null }
          }
          
          lastError = error
          console.log(`❌ Falhou com ${email}:`, error.message)
        } catch (err) {
          lastError = err
          console.log(`❌ Exceção com ${email}:`, err.message)
        }
      }
      
      // Se nenhuma variação funcionou, retornar o último erro
      if (lastError) {
        console.error('❌ Todas as tentativas falharam')
        console.error('❌ Último erro:', lastError)
        console.error('❌ Código do erro:', lastError.status || lastError.code)
        console.error('❌ Mensagem:', lastError.message)
        
        // Verificar se o usuário existe no banco de dados
        try {
          const { data: clientData } = await supabase
            .from('clients')
            .select('telefone, auth_id')
            .or(`telefone.eq.${telefoneLimpo},telefone.eq.${telefoneLimpo.replace('+', '')},telefone.eq.${emailBase.slice(2)},telefone.eq.+55${emailBase}`)
            .limit(1)
          
          if (clientData && clientData.length > 0) {
            console.log('⚠️ Cliente encontrado no banco:', clientData[0])
            console.log('⚠️ Mas não foi possível fazer login no Supabase Auth')
            console.log('⚠️ Possíveis causas:')
            console.log('   1. Email no Auth não corresponde ao telefone')
            console.log('   2. Senha está incorreta')
            console.log('   3. Usuário não existe no Supabase Auth')
          } else {
            console.log('⚠️ Cliente não encontrado no banco de dados')
          }
        } catch (checkError) {
          console.error('Erro ao verificar cliente:', checkError)
        }
        
        throw lastError
      }

      return { data: null, error: new Error('Não foi possível fazer login') }
    } catch (error) {
      console.error('❌ Exceção no signIn:', error)
      console.error('❌ Tipo:', error.name)
      console.error('❌ Mensagem completa:', error.message)
      return { data: null, error }
    }
  }

  const signUp = async (telefone, senha, nome) => {
    try {
      const emailFormated = telefone.replace(/[^\d+]/g, '')
      const email = `${emailFormated.replace(/\+/g, '')}@artea.local`
      
      // Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: senha
      })

      if (authError) throw authError

      // Criar perfil do cliente
      if (authData.user) {
        const { error: clientError } = await supabase
          .from('clients')
          .insert({
            auth_id: authData.user.id,
            nome,
            telefone,
            email: '',
            approved: false,
            role: 'cliente',
            cadastro_status: 'pendente'
          })

        if (clientError) throw clientError
      }

      return { data: authData, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  // Cliente legado autenticado por telefone, ainda sem e-mail real associado
  // à conta do Supabase Auth (auth.users.email ainda é o e-mail sintético
  // {telefone}@artea.local). Centraliza a regra usada pelo ProtectedRoute
  // para bloquear o acesso às páginas normais até o e-mail ser cadastrado.
  const needsEmailMigration = !!(
    user &&
    client &&
    !isAdmin &&
    (user.email || '').toLowerCase().endsWith('@artea.local')
  )

  // Associa um e-mail real à conta do cliente legado autenticado por telefone
  // (ou permite a um cliente já migrado trocar de e-mail). Atualiza primeiro
  // o Supabase Auth (fonte de verdade da autenticação) e só então sincroniza
  // clients.email via RPC — nunca abre uma policy de UPDATE geral em clients.
  const completeEmailMigration = async (novoEmail) => {
    try {
      const email = (novoEmail || '').trim().toLowerCase()
      if (!user) {
        return { error: { message: 'Sessão inválida. Faça login novamente.' } }
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return { error: { message: 'Informe um e-mail válido.' } }
      }

      // Checagem amigável antes de chamar o Auth (a checagem definitiva
      // e autoritativa acontece dentro da RPC set_client_email).
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .ilike('email', email)
        .neq('auth_id', user.id)
        .maybeSingle()

      if (existing) {
        return { error: { message: 'Este e-mail já está sendo utilizado por outra conta.' } }
      }

      // emailRedirectTo explícito: sem isso, o link de confirmação enviado
      // pelo Supabase Auth usa o "Site URL" configurado no Dashboard como
      // fallback — se esse valor estiver desatualizado (ex.: apontando
      // para localhost, resquício de configuração local), o link de
      // confirmação de e-mail quebra em produção mesmo com o app rodando
      // no domínio certo.
      const { data: updateData, error: updateError } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/login` }
      )
      if (updateError) {
        return { error: updateError }
      }

      const { error: rpcError } = await supabase.rpc('set_client_email', { p_email: email })
      if (rpcError) {
        console.warn('Auth atualizado, mas falha ao sincronizar clients.email:', rpcError)
      }

      // Alguns projetos Supabase exigem confirmação por e-mail para trocar
      // o endereço (double opt-in). Nesse caso a sessão ainda mostra o
      // e-mail antigo até o link de confirmação ser clicado.
      const { data: sessionData } = await supabase.auth.getSession()
      const confirmedNow = sessionData?.session?.user?.email?.toLowerCase() === email
      if (confirmedNow) {
        setUser(sessionData.session.user)
      }

      return { data: updateData, error: null, pendingConfirmation: !confirmedNow }
    } catch (error) {
      return { error }
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setClient(null)
      setIsAdmin(false)
      clearCartLocalStorage()
      localStorage.removeItem('cart_owner_id')
    } catch (error) {
      console.error('Erro ao sair:', error)
    }
  }

  const clearCartLocalStorage = () => {
    try {
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('cart_') || key.startsWith('cart-warn-'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (e) {
      console.error('Erro ao limpar localStorage:', e)
    }
  }

  const value = {
    user,
    client,
    isAdmin,
    loading,
    needsEmailMigration,
    signIn,
    signInWithEmail,
    signUp,
    signOut,
    completeEmailMigration,
    refreshProfile: () => user && fetchClientProfile(user)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
