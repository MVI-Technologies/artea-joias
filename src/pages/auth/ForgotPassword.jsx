import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './ForgotPassword.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const emailLimpo = email.trim().toLowerCase()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailLimpo, {
        redirectTo: `${window.location.origin}/redefinir-senha`
      })

      if (resetError) {
        // Não expõe se o e-mail existe ou não no sistema (evita enumeração).
        console.error('Erro ao solicitar recuperação:', resetError)
      }

      setSent(true)
    } catch (err) {
      console.error('Erro ao processar recuperação:', err)
      setError('Erro ao processar solicitação. Tente novamente.')
    } finally {
      setLoading(false)
    }
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
              Digite seu e-mail cadastrado e enviaremos um link para redefinir sua senha
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              {error && <div className="auth-error">{error}</div>}

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
                    Enviar Link de Recuperação
                  </>
                )}
              </button>
            </form>

            <Link
              to="/recuperar-legado"
              className="auth-link"
              style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
            >
              <Phone size={14} />
              Cliente antigo sem e-mail? Recuperar por telefone
            </Link>
          </>
        ) : (
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>Verifique seu e-mail</h2>
            <p>
              Se <strong>{email}</strong> estiver cadastrado, você receberá em instantes
              um link para redefinir sua senha.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
