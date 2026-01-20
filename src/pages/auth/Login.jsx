import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import './Login.css'

export default function Login() {
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const successMessage = location.state?.message

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
      const { error } = await signIn(telefone, senha)
      
      if (error) {
        setError('Telefone ou senha incorretos')
        return
      }

      navigate('/admin')
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.')
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
            <input
              type="password"
              className="form-input"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
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
