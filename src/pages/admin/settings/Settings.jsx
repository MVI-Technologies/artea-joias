import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, Building, Phone, MapPin, Globe } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './Settings.css'

const tabs = [
  { id: 'personalizacoes', label: 'Personalizações' },
  { id: 'precificacao', label: 'Precificação' },
  { id: 'geral', label: 'Geral' },
  { id: 'contato', label: 'Contato' },
  { id: 'integracoes', label: 'Integrações' },
  { id: 'notificacoes', label: 'Notificações' },
  { id: 'metas', label: 'Metas' },
  { id: 'cashback', label: 'Cashback' },
  { id: 'importacao', label: 'Importação' }
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState('contato')
  const [settings, setSettings] = useState({
    nome_empresa: 'ARTEA JOIAS',
    razao_social: '',
    cnpj_cpf: '',
    whatsapp: '',
    email: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    instagram: '',
    idioma: 'Português'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') throw error
      if (data) {
        setSettings(data)
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .single()

      if (existing) {
        const { error } = await supabase
          .from('company_settings')
          .update(settings)
          .eq('id', existing.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert(settings)

        if (error) throw error
      }

      alert('Configurações salvas com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar configurações:', error)
      alert('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'contato':
        return (
          <div className="settings-form">
            <p className="text-muted mb-lg">
              Os dados abaixo serão usados nas mensagens automáticas e e-mails enviados pelo sistema. 
              Todos os dados abaixo referem-se a empresa.
            </p>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Nome da Empresa</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.nome_empresa}
                  onChange={e => setSettings({...settings, nome_empresa: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">CNPJ/CPF</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.cnpj_cpf}
                  onChange={e => setSettings({...settings, cnpj_cpf: e.target.value})}
                  placeholder="Opcional, usado na Nota Promissória"
                />
              </div>

              <div className="form-group full-width">
                <label className="form-label">Razão Social</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.razao_social}
                  onChange={e => setSettings({...settings, razao_social: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">WhatsApp</label>
                <input
                  type="tel"
                  className="form-input"
                  value={settings.whatsapp}
                  onChange={e => setSettings({...settings, whatsapp: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input
                  type="email"
                  className="form-input"
                  value={settings.email}
                  onChange={e => setSettings({...settings, email: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Endereço</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.endereco}
                  onChange={e => setSettings({...settings, endereco: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Número</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.numero}
                  onChange={e => setSettings({...settings, numero: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Complemento</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.complemento}
                  onChange={e => setSettings({...settings, complemento: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Bairro</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.bairro}
                  onChange={e => setSettings({...settings, bairro: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cidade</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.cidade}
                  onChange={e => setSettings({...settings, cidade: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Estado</label>
                <select
                  className="form-select"
                  value={settings.estado}
                  onChange={e => setSettings({...settings, estado: e.target.value})}
                >
                  <option value="">Selecione...</option>
                  <option value="SP">São Paulo</option>
                  <option value="RJ">Rio de Janeiro</option>
                  <option value="MG">Minas Gerais</option>
                  <option value="PR">Paraná</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">CEP</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.cep}
                  onChange={e => setSettings({...settings, cep: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Instagram</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.instagram}
                  onChange={e => setSettings({...settings, instagram: e.target.value})}
                  placeholder="@usuario"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Idioma Oficial</label>
                <select
                  className="form-select"
                  value={settings.idioma}
                  onChange={e => setSettings({...settings, idioma: e.target.value})}
                >
                  <option value="Português">Português</option>
                  <option value="Espanhol">Espanhol</option>
                  <option value="English">English</option>
                </select>
              </div>
            </div>

            <div className="form-grid mt-lg">
              <div className="form-group">
                <label className="form-label">Logo PNG</label>
                <div className="file-upload">
                  <button className="btn btn-outline">Escolher arquivo</button>
                  <span className="text-muted">Nenhum arquivo escolhido</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Ícone Web App PNG, Imagem quadrada</label>
                <div className="file-upload">
                  <button className="btn btn-outline">Escolher arquivo</button>
                  <span className="text-muted">Nenhum arquivo escolhido</span>
                </div>
              </div>
            </div>

            <div className="mt-lg">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )

      case 'integracoes':
        return (
          <div className="settings-form">
            <h3 className="mb-md">Integrações</h3>
            
            <div className="integration-list">
              <div className="integration-item">
                <span>NuvemShop</span>
                <span className="badge badge-secondary">Não configurado</span>
              </div>
              <div className="integration-item">
                <span>Mago5</span>
                <span className="badge badge-secondary">Não configurado</span>
              </div>
              <div className="integration-item">
                <span>Cartpanda</span>
                <span className="badge badge-secondary">Não configurado</span>
              </div>
              <div className="integration-item">
                <span>Ragy</span>
                <span className="badge badge-secondary">Não configurado</span>
              </div>
              <div className="integration-item">
                <span>Loja Integrada</span>
                <span className="badge badge-secondary">Não configurado</span>
              </div>
              <div className="integration-item">
                <span>Shopify</span>
                <span className="badge badge-secondary">Não configurado</span>
              </div>
              <div className="integration-item">
                <span>Mercado Livre</span>
                <span className="badge badge-secondary">Não configurado</span>
              </div>
            </div>

            <h3 className="mb-md mt-lg">Pagamento</h3>
            <div className="integration-list">
              <div className="integration-item highlight">
                <span>Pix</span>
                <span className="badge badge-success">Configurado</span>
              </div>
              <div className="integration-item">
                <span>Mercado Pago</span>
                <span className="badge badge-secondary">Não configurado</span>
              </div>
            </div>

            <h3 className="mb-md mt-lg">Entrega</h3>
            <div className="integration-list">
              <div className="integration-item highlight">
                <span>Correios</span>
                <span className="badge badge-warning">Não configurado</span>
              </div>
              <div className="integration-item">
                <span>Melhor Envio</span>
                <span className="badge badge-secondary">Não configurado</span>
              </div>
            </div>

            <h3 className="mb-md mt-lg">Emissor Fiscal</h3>
            <div className="integration-list">
              <div className="integration-item">
                <span>Nota e Cupom Fiscal</span>
                <span className="badge badge-secondary">Não configurado</span>
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="settings-form">
            <p className="text-muted text-center">
              Conteúdo da aba "{activeTab}" em desenvolvimento.
            </p>
          </div>
        )
    }
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1><SettingsIcon size={24} /> Configurações</h1>
      </div>

      <div className="card">
        {/* Tabs */}
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card-body">
          {loading ? (
            <div className="text-center p-lg">
              <div className="loading-spinner" style={{ width: 40, height: 40 }} />
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
      </div>
    </div>
  )
}
