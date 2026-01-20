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
        if (session?.user) {
          setUser(session.user)
          await fetchClientProfile(session.user) // Passar objeto completo
        } else {
          setUser(null)
          setClient(null)
          setIsAdmin(false)
        }
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
        await fetchClientProfile(session.user) // Passar objeto completo
      }
    } catch (error) {
      console.error('Erro ao verificar usuário:', error)
    } finally {
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
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao buscar perfil')), 5000)
      )
      
      const queryPromise = supabase
        .from('clients')
        .select('*')
        .eq('auth_id', authUser.id)
        .single()
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise])

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
      
      // Usar telefone como email para simplificar
      // Em produção, use phone auth ou adapte conforme necessário
      const email = `${telefone.replace(/\D/g, '')}@artea.local`
      console.log('📧 Email gerado:', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha
      })

      if (error) {
        console.error('❌ Erro no login:', error)
        throw error
      }

      console.log('✅ Login bem-sucedido!', data)
      return { data, error: null }
    } catch (error) {
      console.error('❌ Exceção no signIn:', error)
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
    refreshProfile: () => user && fetchClientProfile(user.id)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
