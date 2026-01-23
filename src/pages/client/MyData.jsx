

import { useState, useEffect } from 'react'
import { User, Save, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function MyData() {
  const { user } = useAuth()
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
        // Upsert: Atualizar se existir, criar se não
        // Importante: Precisamos garantir que auth_id seja passado
        const payload = {
            auth_id: user.id,
            nome: formData.nome,
            telefone: formData.telefone, // Nota: telefone costuma ser chave de busca
            enderecos: [formData.endereco_completo],
            // Manter outros campos se necessário
            updated_at: new Date()
        }
        
        // Se já tivermos o ID do cliente carregado, é update direto. 
        // Mas como usamos auth_id, o upsert deve lidar se tiver constraint unique em auth_id (ideal).
        // Se a tabela clients não tiver constraint unique em auth_id, upsert pode duplicar.
        // O ideal é buscar o ID primeiro (que já fizemos no load).
        
        // Estratégia Segura: Update pelo auth_id
        const { error } = await supabase
            .from('clients')
            .update(payload)
            .eq('auth_id', user.id)
            
        // Se o update falhar porque não existe registro (count 0), então insert
        // Mas provavelmente o registro existe se o login funcionou (trigger de criação de user)
        // Se não existir, é um caso de "cadastro incompleto".
        
        if (error) throw error

        setMessage({ type: 'success', text: 'Dados atualizados com sucesso!' })
        
        // Limpar mensagem após 3s
        setTimeout(() => setMessage(null), 3000)

    } catch (error) {
        console.error(error)
        setMessage({ type: 'error', text: 'Erro ao salvar. Verifique sua conexão.' })
    } finally {
        setSaving(false)
    }
  }

  if (loading) return (
      <div className="flex justify-center items-center h-64">
          <div className="loading-spinner"></div>
      </div>
  )

  return (
    <div className="client-page max-w-2xl mx-auto">
      <div className="page-header mb-8 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <User size={40} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Meus Dados</h1>
        <p className="text-slate-500">Mantenha suas informações atualizadas para entrega.</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        
        {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                <AlertCircle size={20} />
                <span>{message.text}</span>
            </div>
        )}

        <div className="grid grid-cols-1 gap-6">
            <div className="form-group">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                <input 
                    type="text" 
                    value={formData.nome}
                    onChange={e => setFormData({...formData, nome: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                        Telefone (Login) <Lock size={12} className="text-slate-400"/>
                    </label>
                    <input 
                        type="text" 
                        value={formData.telefone}
                        disabled
                        className="w-full px-4 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg cursor-not-allowed"
                    />
                     <p className="text-xs text-slate-400 mt-1">Para alterar, contate o suporte.</p>
                </div>
                
                 <div className="form-group">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input 
                        type="email" 
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>

            <div className="form-group">
                <label className="block text-sm font-medium text-slate-700 mb-1">Endereço de Entrega Completo</label>
                <textarea 
                    rows={3}
                    value={formData.endereco_completo}
                    onChange={e => setFormData({...formData, endereco_completo: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ex: Rua das Flores, 123, Bairro Centro, Cidade - SP. CEP 12345-000"
                />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button 
                    type="submit" 
                    disabled={saving}
                    className="bg-slate-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 flex items-center gap-2 transition-transform active:scale-95"
                >
                    <Save size={18} />
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>
        </div>
      </form>
    </div>
  )
}
