import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Lock, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/common/Toast'
import PasswordInput from '../../components/ui/PasswordInput'
import './ForgotPassword.css'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()

  const telefone = searchParams.get('telefone') || ''
  const code = searchParams.get('code') || ''

  const [formData, setFormData] = useState({
    code: code,
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  // local showPassword states removed

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (formData.newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }

    if (!formData.code || formData.code.length !== 6) {
      toast.error('Código inválido')
      return
    }

    setLoading(true)

    try {
      // Validar código e resetar senha
      const { data: resetData, error: resetError } = await supabase
        .from('password_reset_codes')
        .select('*, client:clients(*)')
        .eq('code', formData.code)
        .eq('telefone', telefone.replace(/\D/g, ''))
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (resetError || !resetData) {
        toast.error('Código inválido ou expirado')
        setLoading(false)
        return
      }

      // Chamar Edge Function para atualizar senha
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

      // Usar o telefone do resetData para garantir consistência
      const response = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          code: formData.code,
          telefone: resetData.telefone, // ← Usar o telefone do banco
          newPassword: formData.newPassword
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        toast.error(result.error || 'Erro ao atualizar senha')
        setLoading(false)
        return
      }

      toast.success('Senha alterada com sucesso!')

      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate('/login')
      }, 2000)

    } catch (error) {
      console.error('Erro ao resetar senha:', error)
      toast.error('Erro ao resetar senha. Tente novamente.')
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

        <h1>Redefinir Senha</h1>
        <p className="auth-subtitle">
          Digite o código recebido no WhatsApp e sua nova senha
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Código de Verificação</label>
            <input
              type="text"
              className="form-input"
              placeholder="000000"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              maxLength={6}
              required
              style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '20px', fontWeight: 'bold' }}
            />
            <small style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
              Código enviado para {telefone}
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Nova Senha</label>
            <PasswordInput
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              placeholder="Digite sua nova senha"
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar Nova Senha</label>
            <PasswordInput
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
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

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Link to="/esqueci-senha" style={{ color: 'var(--color-primary)', fontSize: '14px' }}>
            Não recebeu o código? Reenviar
          </Link>
        </div>
      </div>
    </div>
  )
}
