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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        markValid()
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) markValid()
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
