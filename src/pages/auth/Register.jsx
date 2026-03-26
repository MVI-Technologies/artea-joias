import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PasswordInput from '../../components/ui/PasswordInput'
import './Register.css'

export default function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    instagram: '',
    dataNascimento: '',
    senha: '',
    confirmarSenha: ''
  })

  const validateField = (name, value) => {
    switch (name) {
      case 'nome':
        return value.trim().length < 3 ? 'Nome deve ter pelo menos 3 caracteres.' : ''
      case 'telefone': {
        const digits = value.replace(/\D/g, '')
        return digits.length < 10 ? 'Telefone inválido. Use (XX) XXXXX-XXXX.' : ''
      }
      case 'email':
        return value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? 'E-mail inválido.' : ''
      case 'instagram':
        return value.trim().length < 2 ? 'Instagram é obrigatório.' : ''
      case 'dataNascimento':
        return !value ? 'Data de nascimento é obrigatória.' : ''
      case 'senha':
        return value.length < 6 ? 'A senha deve ter pelo menos 6 caracteres.' : ''
      case 'confirmarSenha':
        return value !== formData.senha ? 'As senhas não coincidem.' : ''
      default:
        return ''
    }
  }

  const handleFieldChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    const fieldError = validateField(name, value)
    setFormErrors(prev => ({ ...prev, [name]: fieldError }))
  }

  const formatTelefone = (value) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate all fields
    const fieldsToValidate = ['nome', 'telefone', 'email', 'instagram', 'dataNascimento', 'senha', 'confirmarSenha']
    const newErrors = {}
    for (const field of fieldsToValidate) {
      const err = validateField(field, formData[field] || '')
      if (err) newErrors[field] = err
    }
    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors)
      setError('Por favor, corrija os erros antes de continuar.')
      return
    }

    setLoading(true)

    try {
      // Converter telefone para email fake (mesmo esquema do login)
      const emailFake = `${formData.telefone.replace(/\D/g, '')}@artea.local`
      
      // Preparar dados para metadados
      const instagramValue = formData.instagram.trim().replace(/^@/, '')
      
      // Criar usuário no Supabase Auth usando telefone como base do email
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailFake,
        password: formData.senha,
        options: {
          data: {
            nome: formData.nome,
            telefone: formData.telefone.replace(/\D/g, ''),
            email_real: formData.email, // Email real (agora obrigatório)
            instagram: instagramValue,
            data_nascimento: formData.dataNascimento,
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
              className={`form-input ${formErrors.nome ? 'input-error' : ''}`}
              value={formData.nome}
              onChange={(e) => handleFieldChange('nome', e.target.value)}
              required
            />
            {formErrors.nome && <span className="field-error">{formErrors.nome}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Telefone/WhatsApp *</label>
            <input
              type="tel"
              className={`form-input ${formErrors.telefone ? 'input-error' : ''}`}
              placeholder="(00) 00000-0000"
              value={formData.telefone}
              onChange={(e) => handleFieldChange('telefone', formatTelefone(e.target.value))}
              maxLength={15}
              required
            />
            {formErrors.telefone && <span className="field-error">{formErrors.telefone}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">E-mail *</label>
            <input
              type="email"
              className={`form-input ${formErrors.email ? 'input-error' : ''}`}
              placeholder="seu@email.com"
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              required
            />
            {formErrors.email && <span className="field-error">{formErrors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Instagram *</label>
            <input
              type="text"
              className={`form-input ${formErrors.instagram ? 'input-error' : ''}`}
              placeholder="@seuusuario ou seuusuario"
              value={formData.instagram}
              onChange={(e) => handleFieldChange('instagram', e.target.value)}
              required
            />
            {formErrors.instagram && <span className="field-error">{formErrors.instagram}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Data de Nascimento *</label>
            <input
              type="date"
              className={`form-input ${formErrors.dataNascimento ? 'input-error' : ''}`}
              value={formData.dataNascimento}
              onChange={(e) => handleFieldChange('dataNascimento', e.target.value)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
              required
            />
            {formErrors.dataNascimento && <span className="field-error">{formErrors.dataNascimento}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Senha *</label>
            <PasswordInput
              value={formData.senha}
              onChange={(e) => handleFieldChange('senha', e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              className={formErrors.senha ? 'input-error' : ''}
            />
            {formErrors.senha && <span className="field-error">{formErrors.senha}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar Senha *</label>
            <PasswordInput
              value={formData.confirmarSenha}
              onChange={(e) => handleFieldChange('confirmarSenha', e.target.value)}
              placeholder="Confirme sua senha"
              required
              className={formErrors.confirmarSenha ? 'input-error' : ''}
            />
            {formErrors.confirmarSenha && <span className="field-error">{formErrors.confirmarSenha}</span>}
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
