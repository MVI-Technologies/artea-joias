import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/common/Toast'
import PasswordInput from '../../components/ui/PasswordInput'
import './ForgotPassword.css'

// Página de callback do link de recuperação por e-mail
// (supabase.auth.resetPasswordForEmail redirectTo). O supabase-js processa
// o token da URL automaticamente e estabelece uma sessão de recovery.
export default function ResetPassword() {
  const navigate = useNavigate()
  const toast = useToast()

  const [checking, setChecking] = useState(true)
  const [validLink, setValidLink] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let resolved = false

    const markValid = () => {
      if (resolved) return
      resolved = true
      setValidLink(true)
      setChecking(false)
    }

    // Não chamar supabase.auth.getSession() aqui em paralelo ao listener
    // abaixo — as duas chamadas disputam o mesmo lock exclusivo interno do
    // supabase-js (navigator.locks) e, quando a troca do token de
    // recuperação na URL demora mais que o timeout do lock, a chamada extra
    // é abortada com "signal is aborted without reason", fazendo esta
    // página achar (erradamente) que o link expirou. onAuthStateChange já
    // cobre os dois casos que a chamada extra tentava cobrir: PASSWORD_RECOVERY
    // (link de recuperação recém-processado) e INITIAL_SESSION com sessão já
    // existente (usuário que abriu a página já autenticado).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'INITIAL_SESSION' && session)) {
        markValid()
      }
    })

    // Se nenhuma sessão de recovery aparecer em alguns segundos, o link é
    // inválido/expirado.
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        setChecking(false)
      }
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        toast.error(error.message || 'Erro ao atualizar senha')
        setLoading(false)
        return
      }

      await supabase.auth.signOut()
      toast.success('Senha alterada com sucesso!')
      navigate('/login', { state: { message: 'Senha alterada com sucesso! Faça login com sua nova senha.' } })
    } catch (error) {
      console.error('Erro ao redefinir senha:', error)
      toast.error('Erro ao redefinir senha. Tente novamente.')
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

        {checking ? (
          <div className="success-message">
            <span className="loading-spinner" />
            <p style={{ marginTop: 12 }}>Verificando link...</p>
          </div>
        ) : !validLink ? (
          <div className="success-message">
            <h2>Link inválido ou expirado</h2>
            <p>
              Este link de recuperação não é mais válido. Solicite um novo link de recuperação de senha.
            </p>
            <Link to="/esqueci-senha" className="btn btn-primary btn-lg w-full" style={{ marginTop: 16 }}>
              Solicitar novo link
            </Link>
          </div>
        ) : (
          <>
            <h1>Redefinir Senha</h1>
            <p className="auth-subtitle">Escolha sua nova senha</p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nova Senha</label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite sua nova senha"
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirmar Nova Senha</label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme sua nova senha"
                  required
                  minLength={6}
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
                    <Lock size={18} />
                    Redefinir Senha
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
