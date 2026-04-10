import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { sendWhatsAppMessage } from '../../services/whatsapp'
import { useToast } from '../../components/common/Toast'
import PhoneInput from '../../components/ui/PhoneInput'
import './ForgotPassword.css'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const toast = useToast()
  const [telefone, setTelefone] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)


  const generateResetCode = () => {
    // Gerar código de 6 dígitos
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const telefoneLimpo = telefone.replace(/[^\d+]/g, '')

      // Verificar se o cliente existe
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, nome, telefone')
        .or(`telefone.eq.${telefoneLimpo},telefone.eq.${telefoneLimpo.slice(2)},telefone.eq.+55${telefoneLimpo}`)
        .limit(1)
        .single()

      if (clientError || !clientData) {
        toast.error('Telefone não encontrado no sistema')
        setLoading(false)
        return
      }

      // Gerar código de recuperação
      const resetCode = generateResetCode()
      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + 15) // Expira em 15 minutos

      // Salvar código no banco (usar o telefone do banco para garantir consistência)
      const { error: codeError } = await supabase
        .from('password_reset_codes')
        .insert({
          client_id: clientData.id,
          telefone: clientData.telefone, // ← Usar o telefone do banco, não o digitado
          code: resetCode,
          expires_at: expiresAt.toISOString(),
          used: false
        })

      if (codeError) {
        console.error('Erro ao salvar código:', codeError)
        toast.error('Erro ao gerar código de recuperação')
        setLoading(false)
        return
      }

      // Enviar código via WhatsApp
      const message = `🔐 *Recuperação de Senha - Grupo AA de Semioias*

Olá ${clientData.nome}!

Você solicitou a recuperação de senha.

Seu código de verificação é:
*${resetCode}*

Este código expira em 15 minutos.

Se você não solicitou esta recuperação, ignore esta mensagem.

_Grupo AA de Semijoias - Sistema de Compras Coletivas_`

      const whatsappResult = await sendWhatsAppMessage(clientData.telefone, message)

      if (!whatsappResult.success) {
        toast.error('Erro ao enviar código via WhatsApp. Tente novamente.')
        setLoading(false)
        return
      }

      setSent(true)
      toast.success('Código enviado com sucesso!')

      // Redirecionar para tela de reset após 2 segundos
      setTimeout(() => {
        navigate(`/redefinir-senha?telefone=${encodeURIComponent(telefone)}&code=${resetCode}`)
      }, 2000)

    } catch (error) {
      console.error('Erro ao processar recuperação:', error)
      toast.error('Erro ao processar solicitação. Tente novamente.')
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
              Digite seu telefone cadastrado e enviaremos instruções para redefinir sua senha
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
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
            <h2>Código Enviado!</h2>
            <p>
              Enviamos um código de 6 dígitos para o WhatsApp cadastrado no número {telefone}.
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Você será redirecionado para a tela de redefinição de senha...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
