
import { useState, useEffect } from 'react'
import { User, Save, Lock, AlertCircle, Instagram, Calendar, MapPin } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/common/Toast'
import CenteredLoader from '../../components/common/CenteredLoader'
import './MyData.css'

export default function MyData() {
  const { user } = useAuth()
  const toast = useToast()
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    cpf: '',
    instagram: '',
    aniversario: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
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
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('auth_id', user.id)
        .maybeSingle() 
        
      if (error) {
          console.error('Supabase error:', error)
          throw error
      }
      
      if (data) {
        // Suporta: null, string direta, array de strings (legado) ou array de objetos (novo)
        const rawEnderecos = data.enderecos
        let firstItem = null
        if (Array.isArray(rawEnderecos)) {
          firstItem = rawEnderecos[0] ?? null
        } else if (typeof rawEnderecos === 'string') {
          firstItem = rawEnderecos
        }

        const isLegacyString = typeof firstItem === 'string'
        const endereco = (!isLegacyString && firstItem && typeof firstItem === 'object') ? firstItem : {}

        setFormData({
            nome: data.nome || '',
            telefone: data.telefone || '',
            email: data.email || user.email || '',
            cpf: data.cpf || '',
            instagram: data.instagram || '',
            aniversario: data.aniversario || '',
            // Se legado, exibe a string no campo logradouro para o cliente corrigir
            logradouro: endereco.logradouro || (isLegacyString ? firstItem : ''),
            numero: endereco.numero || '',
            complemento: endereco.complemento || '',
            bairro: endereco.bairro || '',
            cidade: endereco.cidade || '',
            estado: endereco.estado || '',
            cep: endereco.cep || '',
            observacoes: ''
        })
      } else {
        setFormData(prev => ({
            ...prev,
            email: user.email || '',
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
            cpf: formData.cpf,
            instagram: formData.instagram,
            aniversario: formData.aniversario || null,
            enderecos: [{
                logradouro: formData.logradouro,
                numero: formData.numero,
                complemento: formData.complemento,
                bairro: formData.bairro,
                cidade: formData.cidade,
                estado: formData.estado,
                cep: formData.cep
            }],
            cadastro_status: 'completo', // Ao salvar tudo, marcamos como completo
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

  if (loading) return <CenteredLoader fullHeight />

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

        <div className="my-data-section">
            <h3><User size={18} /> Dados Pessoais</h3>
            <div className="my-data-form-grid">
                <div className="my-data-form-group">
                    <label>Nome Completo *</label>
                    <input 
                        type="text" 
                        value={formData.nome}
                        onChange={e => setFormData({...formData, nome: e.target.value})}
                        placeholder="Seu nome completo"
                        required
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

                <div className="my-data-form-group">
                    <label>Email *</label>
                    <input 
                        type="email" 
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        placeholder="seu@email.com"
                        required
                    />
                </div>

                <div className="my-data-form-group">
                    <label>CPF/CNPJ *</label>
                    <input
                        type="text"
                        value={formData.cpf}
                        onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                        placeholder="Digite seu CPF ou CNPJ"
                        required
                    />
                </div>

                <div className="my-data-form-group">
                    <label><Instagram size={14} /> Instagram</label>
                    <input
                        type="text"
                        value={formData.instagram}
                        onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                        placeholder="@seuusuario"
                    />
                </div>

                <div className="my-data-form-group">
                    <label><Calendar size={14} /> Data de Nascimento</label>
                    <input
                        type="date"
                        value={formData.aniversario}
                        onChange={e => setFormData({ ...formData, aniversario: e.target.value })}
                    />
                </div>
            </div>
        </div>

        <div className="my-data-section mt-lg">
            <h3><MapPin size={18} /> Endereço de Entrega</h3>
            <div className="my-data-form-grid">
                <div className="my-data-form-group span-2">
                    <label>Endereço *</label>
                    <input 
                        type="text" 
                        value={formData.logradouro}
                        onChange={e => setFormData({...formData, logradouro: e.target.value})}
                        placeholder="Rua, Avenida, etc."
                        required
                    />
                </div>

                <div className="my-data-form-group">
                    <label>Número *</label>
                    <input 
                        type="text" 
                        value={formData.numero}
                        onChange={e => setFormData({...formData, numero: e.target.value})}
                        placeholder="123"
                        required
                    />
                </div>

                <div className="my-data-form-group">
                    <label>Complemento</label>
                    <input 
                        type="text" 
                        value={formData.complemento}
                        onChange={e => setFormData({...formData, complemento: e.target.value})}
                        placeholder="Apto, Bloco, etc."
                    />
                </div>

                <div className="my-data-form-group">
                    <label>Bairro *</label>
                    <input 
                        type="text" 
                        value={formData.bairro}
                        onChange={e => setFormData({...formData, bairro: e.target.value})}
                        placeholder="Seu bairro"
                        required
                    />
                </div>

                <div className="my-data-form-group">
                    <label>Cidade *</label>
                    <input 
                        type="text" 
                        value={formData.cidade}
                        onChange={e => setFormData({...formData, cidade: e.target.value})}
                        placeholder="Sua cidade"
                        required
                    />
                </div>

                <div className="my-data-form-group">
                    <label>Estado *</label>
                    <select
                        value={formData.estado}
                        onChange={e => setFormData({ ...formData, estado: e.target.value })}
                        required
                        className="my-data-select"
                    >
                        <option value="">Selecione...</option>
                        <option value="AC">Acre</option>
                        <option value="AL">Alagoas</option>
                        <option value="AP">Amapá</option>
                        <option value="AM">Amazonas</option>
                        <option value="BA">Bahia</option>
                        <option value="CE">Ceará</option>
                        <option value="DF">Distrito Federal</option>
                        <option value="ES">Espírito Santo</option>
                        <option value="GO">Goiás</option>
                        <option value="MA">Maranhão</option>
                        <option value="MT">Mato Grosso</option>
                        <option value="MS">Mato Grosso do Sul</option>
                        <option value="MG">Minas Gerais</option>
                        <option value="PA">Pará</option>
                        <option value="PB">Paraíba</option>
                        <option value="PR">Paraná</option>
                        <option value="PE">Pernambuco</option>
                        <option value="PI">Piauí</option>
                        <option value="RJ">Rio de Janeiro</option>
                        <option value="RN">Rio Grande do Norte</option>
                        <option value="RS">Rio Grande do Sul</option>
                        <option value="RO">Rondônia</option>
                        <option value="RR">Roraima</option>
                        <option value="SC">Santa Catarina</option>
                        <option value="SP">São Paulo</option>
                        <option value="SE">Sergipe</option>
                        <option value="TO">Tocantins</option>
                    </select>
                </div>

                <div className="my-data-form-group">
                    <label>CEP *</label>
                    <input 
                        type="text" 
                        value={formData.cep}
                        onChange={e => setFormData({...formData, cep: e.target.value})}
                        placeholder="00000-000"
                        required
                    />
                </div>
            </div>
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
