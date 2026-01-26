import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './Register.css'

export default function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false) // New state for success modal
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    senha: '',
    confirmarSenha: ''
  })

  const formatTelefone = (value) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.senha !== formData.confirmarSenha) {
      setError('As senhas não coincidem')
      return
    }

    if (formData.senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      // Converter telefone para email fake (mesmo esquema do login)
      const emailFake = `${formData.telefone.replace(/\D/g, '')}@artea.local`
      
      // Criar usuário no Supabase Auth usando telefone como base do email
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailFake,
        password: formData.senha,
        options: {
          data: {
            nome: formData.nome,
            telefone: formData.telefone.replace(/\D/g, ''),
            email_real: formData.email || '', // Guardar email real nos metadados
            role: 'cliente' // ✅ CRÍTICO: Armazenar role no metadata para persistência
          }
        }
      })

      if (authError) throw authError

      console.log('✅ Auth signup bem-sucedido!', authData.user)
      
      // ✅ Cliente é criado automaticamente pelo trigger on_auth_user_created
      // Não precisa inserir manualmente - a migration 040 cuida disso
      
      // ⚠️ IMPORTANT: Sign out immediately to prevent auto-login redirect
      console.log('🚪 Fazendo logout para evitar redirecionamento...')
      await supabase.auth.signOut()
      
      console.log('✅ Cadastro completo! Mostrando modal de sucesso...')
      
      // Show success modal
      setSuccess(true)
      
      // Clear form
      setFormData({
        nome: '',
        telefone: '',
        email: '',
        senha: '',
        confirmarSenha: ''
      })
      setError('')
    } catch (err) {
      console.error('❌ Erro ao cadastrar:', err)
      console.error('❌ Nome do erro:', err.name)
      console.error('❌ Stack:', err.stack)
      setError(err.message || 'Erro ao criar cadastro. Verifique os dados e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container register-container">
        <Link to="/login" className="back-link">
          <ArrowLeft size={18} />
          Voltar para login
        </Link>

        <div className="auth-logo">
          <img src="/logo.png" alt="Artea Joias" />
        </div>

        <h1>Solicitar Cadastro</h1>
        <p className="auth-subtitle">
          Preencha os dados abaixo para solicitar seu cadastro
        </p>

        {/* Success Modal */}
        {success && (
          <div className="success-modal-overlay" onClick={() => {
            setSuccess(false)
            navigate('/login')
          }}>
            <div className="success-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="success-modal-icon">✓</div>
              <h2>Cadastro Realizado!</h2>
              <p>
                Seu cadastro foi enviado com sucesso e está aguardando aprovação da administração.
              </p>
              <p className="success-modal-note">
                Você receberá uma notificação quando seu cadastro for aprovado.
              </p>
              <button 
                className="btn btn-primary btn-lg w-full"
                onClick={() => {
                  setSuccess(false)
                  navigate('/login')
                }}
              >
                Entendi
              </button>
            </div>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nome Completo *</label>
            <input
              type="text"
              className="form-input"
              value={formData.nome}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Telefone/WhatsApp *</label>
            <input
              type="tel"
              className="form-input"
              placeholder="(00) 00000-0000"
              value={formData.telefone}
              onChange={(e) => setFormData({...formData, telefone: formatTelefone(e.target.value)})}
              maxLength={15}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">E-mail (opcional)</label>
            <input
              type="email"
              className="form-input"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha *</label>
            <input
              type="password"
              className="form-input"
              placeholder="Mínimo 6 caracteres"
              value={formData.senha}
              onChange={(e) => setFormData({...formData, senha: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar Senha *</label>
            <input
              type="password"
              className="form-input"
              value={formData.confirmarSenha}
              onChange={(e) => setFormData({...formData, confirmarSenha: e.target.value})}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-success btn-lg w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="loading-spinner" />
            ) : (
              <>
                <UserPlus size={18} />
                Solicitar Cadastro
              </>
            )}
          </button>

          <p className="auth-note">
            * Seu cadastro será analisado pela administração antes de ser aprovado
          </p>
        </form>
      </div>
    </div>
  )
}
