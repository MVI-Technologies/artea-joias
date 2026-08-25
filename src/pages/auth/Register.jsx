import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PasswordInput from '../../components/ui/PasswordInput'
import PhoneInput from '../../components/ui/PhoneInput'
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
    cpfCnpj: '',
    dataNascimento: '',
    senha: '',
    confirmarSenha: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: ''
  })

  const validateField = (name, value) => {
    switch (name) {
      case 'nome':
        return value.trim().length < 3 ? 'Nome deve ter pelo menos 3 caracteres.' : ''
      case 'telefone': {
        const digits = value.replace(/\D/g, '')
        return digits.length < 10 ? 'Telefone inválido. Verifique o número digitado.' : ''
      }
      case 'email':
        if (!value.trim()) return 'E-mail é obrigatório.'
        return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? 'E-mail inválido.' : ''
      case 'instagram':
        return value.trim().length < 2 ? 'Instagram é obrigatório.' : ''
      case 'cpfCnpj': {
        const digits = value.replace(/\D/g, '')
        if (digits.length === 0) return 'CPF ou CNPJ é obrigatório.'
        if (digits.length !== 11 && digits.length !== 14) return 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos.'
        // Rejeita sequências inválidas (00000000000, 11111111111, etc.)
        if (/^(\d)\1+$/.test(digits)) return 'CPF/CNPJ inválido (sequência repetida).'
        return ''
      }
      case 'dataNascimento':
        return !value ? 'Data de nascimento é obrigatória.' : ''
      case 'senha':
        return value.length < 6 ? 'A senha deve ter pelo menos 6 caracteres.' : ''
      case 'confirmarSenha':
        return value !== formData.senha ? 'As senhas não coincidem.' : ''
      case 'logradouro':
        return value.trim().length < 3 ? 'Endereço é obrigatório.' : ''
      case 'numero':
        return value.trim().length === 0 ? 'Número é obrigatório.' : ''
      case 'bairro':
        return value.trim().length < 2 ? 'Bairro é obrigatório.' : ''
      case 'cidade':
        return value.trim().length < 2 ? 'Cidade é obrigatória.' : ''
      case 'estado':
        return value.length !== 2 ? 'Estado é obrigatório.' : ''
      case 'cep':
        return value.replace(/\D/g, '').length !== 8 ? 'CEP inválido.' : ''
      default:
        return ''
    }
  }

  const handleFieldChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    const fieldError = validateField(name, value)
    setFormErrors(prev => ({ ...prev, [name]: fieldError }))
  }


  const formatCpfCnpj = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 14)
    if (digits.length <= 11) {
      // CPF: 000.000.000-00
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    }
    // CNPJ: 00.000.000/0000-00
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate all fields
    const fieldsToValidate = ['nome', 'telefone', 'email', 'instagram', 'cpfCnpj', 'dataNascimento', 'senha', 'confirmarSenha', 'logradouro', 'numero', 'bairro', 'cidade', 'estado', 'cep']
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
      // Preparar dados para metadados
      const instagramValue = formData.instagram.trim().replace(/^@/, '')
      const emailNormalizado = formData.email.trim().toLowerCase()
      const telefoneMetadata = formData.telefone.replace(/[^\d+]/g, '')

      // Checagem amigável de telefone antes de chamar o Auth. Necessária
      // porque, ao contrário de e-mail duplicado (rejeitado pelo próprio
      // GoTrue antes de chegar ao trigger), telefone duplicado só é
      // detectado dentro do trigger handle_new_user — e o endpoint
      // /auth/v1/signup não repassa esse detalhe ao cliente, respondendo
      // de forma genérica. A validação autoritativa continua no trigger.
      const { data: telefoneDisponivel, error: telefoneCheckError } = await supabase
        .rpc('check_telefone_disponivel', { p_telefone: telefoneMetadata })

      if (!telefoneCheckError && telefoneDisponivel === false) {
        setError('Este telefone já está cadastrado. Tente fazer login ou recuperar sua senha.')
        setLoading(false)
        return
      }

      // Cadastro principal: e-mail real como identidade de autenticação.
      // O telefone é mantido apenas como dado cadastral/contato (metadata),
      // usado pelo trigger handle_new_user para preencher clients.telefone.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailNormalizado,
        password: formData.senha,
        options: {
          data: {
            nome: formData.nome,
            telefone: telefoneMetadata,
            instagram: instagramValue,
            cpf: formData.cpfCnpj.replace(/\D/g, ''),
            data_nascimento: formData.dataNascimento,
            endereco: formData.logradouro,
            numero: formData.numero,
            complemento: formData.complemento,
            bairro: formData.bairro,
            cidade: formData.cidade,
            estado: formData.estado,
            cep: formData.cep,
            role: 'cliente' // ✅ CRÍTICO: Armazenar role no metadata para persistência
          }
        }
      })

      if (authError) throw authError

      // Supabase retorna sucesso (sem erro) para e-mail já cadastrado quando
      // "Confirm email" está ativo, para não expor quais e-mails existem —
      // nesse caso o usuário retornado não tem identidades novas associadas.
      if (authData?.user && Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
        setError('Este e-mail já está cadastrado. Tente fazer login ou recuperar sua senha.')
        setLoading(false)
        return
      }

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
        confirmarSenha: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        cep: ''
      })
      setError('')
    } catch (err) {
      console.error('❌ Erro ao cadastrar:', err)
      console.error('❌ Nome do erro:', err.name)
      console.error('❌ Stack:', err.stack)
      const mensagem = (err.message || '').toLowerCase()
      if (mensagem.includes('already registered') || mensagem.includes('already exists')) {
        setError('Este e-mail já está cadastrado. Tente fazer login ou recuperar sua senha.')
      } else if (mensagem.includes('database error saving new user')) {
        // Erro genérico do GoTrue quando o trigger handle_new_user rejeita o
        // cadastro (ex.: telefone já em uso por outra conta em condição de
        // corrida com a pré-checagem acima) — GoTrue não repassa o motivo.
        setError('Não foi possível concluir o cadastro. Verifique se o telefone informado já não está em uso ou tente novamente em instantes.')
      } else {
        setError(err.message || 'Erro ao criar cadastro. Verifique os dados e tente novamente.')
      }
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
            <label className="form-label">Telefone *</label>
            <PhoneInput
              className={`form-input ${formErrors.telefone ? 'input-error' : ''}`}
              value={formData.telefone}
              onChange={(val) => handleFieldChange('telefone', val)}
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
            <label className="form-label">CPF ou CNPJ *</label>
            <input
              type="text"
              className={`form-input ${formErrors.cpfCnpj ? 'input-error' : ''}`}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              value={formData.cpfCnpj}
              onChange={(e) => handleFieldChange('cpfCnpj', formatCpfCnpj(e.target.value))}
              maxLength={18}
              inputMode="numeric"
              required
            />
            {formErrors.cpfCnpj && <span className="field-error">{formErrors.cpfCnpj}</span>}
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
            <label className="form-label">Endereço (Rua/Avenida) *</label>
            <input
              type="text"
              className={`form-input ${formErrors.logradouro ? 'input-error' : ''}`}
              placeholder="Rua, Avenida, etc."
              value={formData.logradouro}
              onChange={(e) => handleFieldChange('logradouro', e.target.value)}
              required
            />
            {formErrors.logradouro && <span className="field-error">{formErrors.logradouro}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Número *</label>
              <input
                type="text"
                className={`form-input ${formErrors.numero ? 'input-error' : ''}`}
                value={formData.numero}
                onChange={(e) => handleFieldChange('numero', e.target.value)}
                required
              />
              {formErrors.numero && <span className="field-error">{formErrors.numero}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Complemento</label>
              <input
                type="text"
                className="form-input"
                placeholder="Apto, Bloco, etc."
                value={formData.complemento}
                onChange={(e) => handleFieldChange('complemento', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Bairro *</label>
            <input
              type="text"
              className={`form-input ${formErrors.bairro ? 'input-error' : ''}`}
              value={formData.bairro}
              onChange={(e) => handleFieldChange('bairro', e.target.value)}
              required
            />
            {formErrors.bairro && <span className="field-error">{formErrors.bairro}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cidade *</label>
              <input
                type="text"
                className={`form-input ${formErrors.cidade ? 'input-error' : ''}`}
                value={formData.cidade}
                onChange={(e) => handleFieldChange('cidade', e.target.value)}
                required
              />
              {formErrors.cidade && <span className="field-error">{formErrors.cidade}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Estado *</label>
              <select
                className={`form-input ${formErrors.estado ? 'input-error' : ''}`}
                value={formData.estado}
                onChange={(e) => handleFieldChange('estado', e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                <option value="AC">AC</option><option value="AL">AL</option>
                <option value="AP">AP</option><option value="AM">AM</option>
                <option value="BA">BA</option><option value="CE">CE</option>
                <option value="DF">DF</option><option value="ES">ES</option>
                <option value="GO">GO</option><option value="MA">MA</option>
                <option value="MT">MT</option><option value="MS">MS</option>
                <option value="MG">MG</option><option value="PA">PA</option>
                <option value="PB">PB</option><option value="PR">PR</option>
                <option value="PE">PE</option><option value="PI">PI</option>
                <option value="RJ">RJ</option><option value="RN">RN</option>
                <option value="RS">RS</option><option value="RO">RO</option>
                <option value="RR">RR</option><option value="SC">SC</option>
                <option value="SP">SP</option><option value="SE">SE</option>
                <option value="TO">TO</option>
              </select>
              {formErrors.estado && <span className="field-error">{formErrors.estado}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">CEP *</label>
            <input
              type="text"
              className={`form-input ${formErrors.cep ? 'input-error' : ''}`}
              placeholder="00000-000"
              value={formData.cep}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, '')
                if (val.length > 5) val = val.substring(0, 5) + '-' + val.substring(5, 8)
                handleFieldChange('cep', val)
              }}
              maxLength={9}
              required
            />
            {formErrors.cep && <span className="field-error">{formErrors.cep}</span>}
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
