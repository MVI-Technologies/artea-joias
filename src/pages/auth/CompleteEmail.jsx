import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Mail, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import './ForgotPassword.css'

// Etapa obrigatória para clientes antigos que entraram pelo telefone e ainda
// não têm e-mail cadastrado no Supabase Auth. Enquanto isso não for
// resolvido, o ProtectedRoute (src/App.jsx) redireciona qualquer rota do
// cliente para cá — inclusive em acesso direto por URL.
export default function CompleteEmail() {
  const { user, client, isAdmin, needsEmailMigration, completeEmailMigration, signOut } = useAuth()
  // Pré-preenche com um e-mail já salvo em clients.email (ex.: cliente que
  // já informou um e-mail de contato no passado, mas cuja conta de
  // autenticação ainda não foi migrada) — inicialização única, sem efeito.
  const [email, setEmail] = useState(client?.email || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!needsEmailMigration) {
    return <Navigate to={isAdmin ? '/admin' : '/app'} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: migrationError, pendingConfirmation } = await completeEmailMigration(email)

    if (migrationError) {
      setError(migrationError.message || 'Não foi possível cadastrar este e-mail. Tente novamente.')
      setLoading(false)
      return
    }

    if (pendingConfirmation) {
      setPending(true)
    }
    // Se não houver confirmação pendente, needsEmailMigration recalcula
    // automaticamente a partir da sessão atualizada e o guard libera o acesso.

    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <img src="/logo.png" alt="Artea Joias" />
        </div>

        {pending ? (
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>Confirme seu e-mail</h2>
            <p>
              Enviamos um link de confirmação para <strong>{email}</strong>.
              Abra o link para concluir a atualização e depois volte aqui.
            </p>
            <button
              className="btn btn-primary btn-lg w-full"
              style={{ marginTop: 16 }}
              onClick={() => window.location.reload()}
            >
              Já confirmei, verificar novamente
            </button>
          </div>
        ) : (
          <>
            <h1>Complete seu cadastro</h1>
            <p className="auth-subtitle">
              Para continuar utilizando a Artea Joias, cadastre um e-mail.
              Ele passa a ser usado para login e recuperação de senha.
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
                    Continuar
                  </>
                )}
              </button>
            </form>

            <button
              type="button"
              className="auth-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', width: '100%' }}
              onClick={signOut}
            >
              <LogOut size={14} />
              Sair
            </button>
          </>
        )}
      </div>
    </div>
  )
}
