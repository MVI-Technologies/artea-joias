import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Phone, Mail, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/common/Toast'
import PhoneInput from '../../components/ui/PhoneInput'
import PasswordInput from '../../components/ui/PasswordInput'
import './ForgotPassword.css'

// Recuperação de conta exclusiva para clientes antigos que ainda não têm
// e-mail cadastrado (por isso não é possível usar o fluxo padrão de
// recuperação por e-mail do Supabase Auth). Acessível apenas pelo link
// discreto em /esqueci-senha — não é o fluxo principal.
//
// Fluxo: telefone -> encontra o cadastro em `clients` -> pede um novo
// e-mail (que passa a ser a identidade de login) + nova senha.
//
// Decisão de produto (explícita): nenhuma dependência de WhatsApp neste
// fluxo (nem em nenhum outro). A única barreira é saber o telefone
// cadastrado do cliente — não há confirmação de posse do telefone nem
// do e-mail (link de confirmação).
export default function ForgotPasswordLegacy() {
  const navigate = useNavigate()
  const toast = useToast()

  const [step, setStep] = useState('telefone') // 'telefone' | 'dados'
  const [telefone, setTelefone] = useState('')
  const [loadingTelefone, setLoadingTelefone] = useState(false)

  const [email, setEmail] = useState('')
  const [confirmarEmail, setConfirmarEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loadingSubmit, setLoadingSubmit] = useState(false)

  const handleTelefoneSubmit = async (e) => {
    e.preventDefault()
    setLoadingTelefone(true)

    try {
      const telefoneLimpo = telefone.replace(/[^\d+]/g, '').replace(/\+/g, '')
      const { data: disponivel, error } = await supabase
        .rpc('check_telefone_disponivel', { p_telefone: telefoneLimpo })

      if (error) {
        toast.error('Erro ao verificar telefone. Tente novamente.')
        setLoadingTelefone(false)
        return
      }

      if (disponivel) {
        toast.error('Telefone não encontrado no sistema')
        setLoadingTelefone(false)
        return
      }

      setStep('dados')
    } catch (error) {
      console.error('Erro ao verificar telefone:', error)
      toast.error('Erro ao verificar telefone. Tente novamente.')
    } finally {
      setLoadingTelefone(false)
    }
  }

  const handleDadosSubmit = async (e) => {
    e.preventDefault()

    const emailNormalizado = email.trim().toLowerCase()

    if (emailNormalizado !== confirmarEmail.trim().toLowerCase()) {
      toast.error('Os e-mails não coincidem')
      return
    }

    if (novaSenha !== confirmarSenha) {
      toast.error('As senhas não coincidem')
      return
    }

    if (novaSenha.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoadingSubmit(true)

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          telefone: telefone.replace(/[^\d+]/g, '').replace(/\+/g, ''),
          newEmail: emailNormalizado,
          newPassword: novaSenha
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        toast.error(result.error || 'Erro ao atualizar cadastro')
        setLoadingSubmit(false)
        return
      }

      toast.success('E-mail e senha atualizados! Faça login com os novos dados.')

      setTimeout(() => {
        navigate('/login')
      }, 2000)

    } catch (error) {
      console.error('Erro ao processar recuperação:', error)
      toast.error('Erro ao processar solicitação. Tente novamente.')
    } finally {
      setLoadingSubmit(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Link to="/esqueci-senha" className="back-link">
          <ArrowLeft size={18} />
          Voltar
        </Link>

        <div className="auth-logo">
          <img src="/logo.png" alt="Artea Joias" />
        </div>

        {step === 'telefone' ? (
          <>
            <h1>Recuperar Conta (telefone)</h1>
            <p className="auth-subtitle">
              Use esta opção apenas se você é cliente antigo e ainda não cadastrou um e-mail.
              Digite seu telefone cadastrado para continuar.
            </p>

            <form className="auth-form" onSubmit={handleTelefoneSubmit}>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <PhoneInput
                  className="form-input"
                  value={telefone}
                  onChange={(val) => setTelefone(val)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={loadingTelefone}
              >
                {loadingTelefone ? (
                  <span className="loading-spinner" />
                ) : (
                  <>
                    <Phone size={18} />
                    Continuar
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>Cadastrar E-mail e Nova Senha</h1>
            <p className="auth-subtitle">
              Encontramos seu cadastro. Informe um e-mail (será seu novo login) e defina uma nova senha.
            </p>

            <form className="auth-form" onSubmit={handleDadosSubmit}>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirmar E-mail</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="seu@email.com"
                  value={confirmarEmail}
                  onChange={(e) => setConfirmarEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nova Senha</label>
                <PasswordInput
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirmar Nova Senha</label>
                <PasswordInput
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Confirme sua nova senha"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={loadingSubmit}
              >
                {loadingSubmit ? (
                  <span className="loading-spinner" />
                ) : (
                  <>
                    <Mail size={18} />
                    Salvar e Entrar
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
