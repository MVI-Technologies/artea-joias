import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { LogIn, Phone } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PasswordInput from '../../components/ui/PasswordInput'
import PhoneInput from '../../components/ui/PhoneInput'
import './Login.css'

export default function Login() {
  const [legacyMode, setLegacyMode] = useState(false)

  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn, signInWithEmail, user, isAdmin, loading: authLoading } = useAuth()
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

  const describeError = (loginError) => {
    if (loginError.message?.includes('PENDING_APPROVAL')) {
      return loginError.message.split(':')[1] || 'Cadastro pendente de aprovação'
    }
    if (loginError.message?.includes('Invalid login credentials')) {
      return legacyMode
        ? 'Telefone ou senha incorretos.'
        : 'E-mail ou senha incorretos.'
    }
    if (loginError.message?.includes('Email not confirmed')) {
      return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.'
    }
    return `Erro ao fazer login: ${loginError.message || 'Tente novamente.'}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: loginError } = legacyMode
        ? await signIn(telefone, senha)
        : await signInWithEmail(email, senha)

      if (loginError) {
        console.error('Erro de login:', loginError)
        setError(describeError(loginError))
        return
      }

      // O redirecionamento é feito pelo useEffect acima quando o user for definido
    } catch (err) {
      console.error('Exceção no login:', err)
      setError(describeError(err))
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

          {legacyMode ? (
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <PhoneInput
                className="form-input"
                value={telefone}
                onChange={setTelefone}
                required
              />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input
                type="email"
                className="form-input"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Senha</label>
            <PasswordInput
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              required
              className="form-input-reset"
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

          <button
            type="button"
            className="auth-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', width: '100%' }}
            onClick={() => {
              setError('')
              setLegacyMode((v) => !v)
            }}
          >
            <Phone size={14} />
            {legacyMode ? 'Entrar com e-mail' : 'Cliente antigo sem e-mail? Entrar com telefone'}
          </button>
        </form>
      </div>
    </div>
  )
}
