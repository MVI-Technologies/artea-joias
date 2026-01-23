
import { useState, useEffect } from 'react'
import { User, Save, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/common/Toast'
import './MyData.css'

export default function MyData() {
  const { user } = useAuth()
  const toast = useToast()
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    cpf: '', 
    endereco_completo: '',
    observacoes: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (user?.id) loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      // Tentar buscar por auth_id. Se não achar, não é erro crítico, apenas perfil vazio.
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('auth_id', user.id)
        .maybeSingle() // Use maybeSingle para evitar erro se não existir
        
      if (error) {
          console.error('Supabase error:', error)
          throw error
      }
      
      if (data) {
        setFormData({
            nome: data.nome || '',
            telefone: data.telefone || '',
            email: data.email || user.email || '',
            cpf: '***.***.***-**', 
            endereco_completo: data.enderecos?.[0] || '', 
            observacoes: '' 
        })
      } else {
        // Se formos criar um novo, preencher com o que temos
        setFormData(prev => ({
            ...prev,
            email: user.email || '',
            // Se tiver telefone no metadata do Auth, usar aqui
        }))
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      setMessage({ type: 'error', text: 'Não foi possível carregar seus dados. Tente recarregar.' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    
    try {
        const payload = {
            auth_id: user.id,
            nome: formData.nome,
            telefone: formData.telefone,
            email: formData.email,
            enderecos: formData.endereco_completo ? [formData.endereco_completo] : [],
            updated_at: new Date()
        }
        
        const { error } = await supabase
            .from('clients')
            .update(payload)
            .eq('auth_id', user.id)
            
        if (error) throw error

        toast.success('Dados atualizados com sucesso!')
        setMessage({ type: 'success', text: 'Dados atualizados com sucesso!' })
        
        setTimeout(() => setMessage(null), 3000)

    } catch (error) {
        console.error(error)
        toast.error('Erro ao salvar. Verifique sua conexão.')
        setMessage({ type: 'error', text: 'Erro ao salvar. Verifique sua conexão.' })
    } finally {
        setSaving(false)
    }
  }

  if (loading) return (
      <div className="my-data-page">
        <div className="flex justify-center items-center h-64">
            <div className="loading-spinner"></div>
        </div>
      </div>
  )

  return (
    <div className="my-data-page">
      <div className="my-data-header">
        <div className="my-data-avatar">
            <User size={40} />
        </div>
        <h1>Meus Dados</h1>
        <p>Mantenha suas informações atualizadas para entrega.</p>
      </div>

      <form onSubmit={handleSave} className="my-data-form">
        
        {message && (
            <div className={`my-data-message ${message.type}`}>
                <AlertCircle size={20} />
                <span>{message.text}</span>
            </div>
        )}

        <div className="my-data-form-grid">
            <div className="my-data-form-group">
                <label>Nome Completo</label>
                <input 
                    type="text" 
                    value={formData.nome}
                    onChange={e => setFormData({...formData, nome: e.target.value})}
                    placeholder="Seu nome completo"
                />
            </div>

            <div className="my-data-form-group">
                <label>
                    Telefone (Login) <Lock size={12} className="lock-icon"/>
                </label>
                <input 
                    type="text" 
                    value={formData.telefone}
                    disabled
                />
                <p className="help-text">Para alterar, contate o suporte.</p>
            </div>
        </div>

        <div className="my-data-form-group">
            <label>Email</label>
            <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                placeholder="seu@email.com"
            />
        </div>

        <div className="my-data-form-group">
            <label>Endereço de Entrega Completo</label>
            <textarea 
                rows={3}
                value={formData.endereco_completo}
                onChange={e => setFormData({...formData, endereco_completo: e.target.value})}
                placeholder="Ex: Rua das Flores, 123, Bairro Centro, Cidade - SP. CEP 12345-000"
            />
        </div>

        <div className="my-data-form-footer">
            <button 
                type="submit" 
                disabled={saving}
                className="btn-save"
            >
                <Save size={18} />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
        </div>
      </form>
    </div>
  )
}
