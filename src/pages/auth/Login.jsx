import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PasswordInput from '../../components/ui/PasswordInput'
import './Login.css'

export default function Login() {
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  // showPassword state removed (handled by component)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn, user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const successMessage = location.state?.message

  // Redirecionar automaticamente se já estiver logado
  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin) {
        navigate('/admin', { replace: true })
      } else {
        navigate('/app', { replace: true })
      }
    }
  }, [user, isAdmin, authLoading, navigate])

  const formatTelefone = (value) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const handleTelefoneChange = (e) => {
    setTelefone(formatTelefone(e.target.value))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: loginError } = await signIn(telefone, senha)
      
      if (loginError) {
        console.error('Erro de login:', loginError)
        
        // Check for pending approval error
        if (loginError.message?.includes('PENDING_APPROVAL')) {
          const message = loginError.message.split(':')[1] || 'Cadastro pendente de aprovação'
          setError(message)
          return
        }
        
        // Mensagem mais específica baseada no tipo de erro
        if (loginError.message?.includes('Invalid login credentials')) {
          setError('Telefone ou senha incorretos. Verifique se o telefone está no formato correto (ex: (11) 99999-9999) e se a senha está correta.')
        } else if (loginError.message?.includes('Email not confirmed')) {
          setError('Email não confirmado. Verifique sua caixa de entrada.')
        } else {
          setError(`Erro ao fazer login: ${loginError.message || 'Tente novamente.'}`)
        }
        return
      }

      // Login bem-sucedido - aguardar um pouco para o AuthContext processar
      console.log('✅ Login bem-sucedido, aguardando redirecionamento...')
      
      // O redirecionamento será feito pelo useEffect acima quando o user for definido
      // Não precisamos fazer nada aqui, apenas aguardar
    } catch (err) {
      console.error('Exceção no login:', err)
      
      // Check for pending approval in catch block too
      if (err.message?.includes('PENDING_APPROVAL')) {
        const message = err.message.split(':')[1] || 'Cadastro pendente de aprovação'
        setError(message)
      } else {
        setError('Erro ao fazer login. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <img src="/logo.png" alt="Artea Joias" />
        </div>

        <h1>Bem-vindo</h1>
        <p className="auth-subtitle">Faça login para acessar o sistema</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {successMessage && (
            <div className="auth-success">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input
              type="tel"
              className="form-input"
              placeholder="(00) 00000-0000"
              value={telefone}
              onChange={handleTelefoneChange}
              maxLength={15}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <PasswordInput
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              required
              className="form-input-reset" /* Reset some Login.css specific styles if needed */
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="loading-spinner" />
            ) : (
              <>
                <LogIn size={18} />
                Entrar
              </>
            )}
          </button>

          <div className="auth-links">
            <Link to="/esqueci-senha" className="auth-link">
              Esqueci minha senha
            </Link>
            <span className="auth-divider">•</span>
            <Link to="/cadastro" className="auth-link">
              Solicitar cadastro
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
