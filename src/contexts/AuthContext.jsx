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
    // Verificar sessão atual
    checkUser()

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event)
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

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        // Não aguardar fetchClientProfile para não travar o loading
        fetchClientProfile(session.user).catch(err => {
          console.warn('Erro ao buscar perfil (não crítico):', err)
        })
      }
    } catch (error) {
      console.error('Erro ao verificar usuário:', error)
    } finally {
      // Sempre definir loading como false
      setLoading(false)
    }
  }

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
          console.warn('⚠️ Erro ao buscar perfil:', queryError)
        }
      }
    } catch (error) {
      console.error('❌ Exceção ao buscar perfil:', error)
      console.error('❌ Tipo de erro:', error.name)
      console.error('❌ Stack:', error.stack)
      // NÃO resetar isAdmin se já foi definido do metadata
    }
  }

  const signIn = async (telefone, senha) => {
    try {
      console.log('📞 Tentando login com telefone:', telefone)
      
      // Remover formatação do telefone (parênteses, espaços, hífens)
      const telefoneLimpo = telefone.replace(/\D/g, '')
      console.log('📞 Telefone limpo:', telefoneLimpo)
      
      // Tentar diferentes variações do email
      const emailVariations = [
        `${telefoneLimpo}@artea.local`,           // Formato padrão
        `+55${telefoneLimpo}@artea.local`,        // Com código do país
        `55${telefoneLimpo}@artea.local`,         // Com código sem +
        telefoneLimpo.length === 11 ? `${telefoneLimpo.slice(0, 2)}${telefoneLimpo.slice(2)}@artea.local` : null, // Com DDD separado
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
            .or(`telefone.eq.${telefoneLimpo},telefone.eq.${telefoneLimpo.slice(2)},telefone.eq.+55${telefoneLimpo}`)
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
      const email = `${telefone.replace(/\D/g, '')}@artea.local`
      
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

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setClient(null)
      setIsAdmin(false)
    } catch (error) {
      console.error('Erro ao sair:', error)
    }
  }

  const value = {
    user,
    client,
    isAdmin,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile: () => user && fetchClientProfile(user)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
