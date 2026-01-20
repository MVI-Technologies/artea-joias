import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import './ForgotPassword.css'

export default function ForgotPassword() {
  const [telefone, setTelefone] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const formatTelefone = (value) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    // Simular envio (implementar integração real depois)
    setTimeout(() => {
      setSent(true)
      setLoading(false)
    }, 1500)
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Link to="/login" className="back-link">
          <ArrowLeft size={18} />
          Voltar para login
        </Link>

        <div className="auth-logo">
          <img src="/logo.png" alt="Artea Joias" />
        </div>

        {!sent ? (
          <>
            <h1>Recuperar Senha</h1>
            <p className="auth-subtitle">
              Digite seu telefone cadastrado e enviaremos instruções para redefinir sua senha
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="(00) 00000-0000"
                  value={telefone}
                  onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                  maxLength={15}
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
                    <Mail size={18} />
                    Enviar Instruções
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>Instruções Enviadas!</h2>
            <p>
              Enviamos as instruções de recuperação para o WhatsApp cadastrado no número {telefone}.
            </p>
            <Link to="/login" className="btn btn-primary">
              Voltar para Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
