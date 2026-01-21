import { useState, useEffect } from 'react'
import { Plus, Search, X, Edit, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './Marketing.css'

export default function Marketing() {
  const [activeTab, setActiveTab] = useState('campanhas')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Data states
  const [campaigns, setCampaigns] = useState([])
  const [coupons, setCoupons] = useState([])
  const [giftCards, setGiftCards] = useState([])
  const [kits, setKits] = useState([])

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form states
  const [formData, setFormData] = useState({})

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      switch (activeTab) {
        case 'campanhas':
          const { data: campaignsData } = await supabase
            .from('marketing_campaigns')
            .select('*')
            .order('created_at', { ascending: false })
          setCampaigns(campaignsData || [])
          break
        case 'cupons':
          const { data: couponsData } = await supabase
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false })
          setCoupons(couponsData || [])
          break
        case 'vale':
          const { data: giftData } = await supabase
            .from('gift_cards')
            .select('*')
            .order('created_at', { ascending: false })
          setGiftCards(giftData || [])
          break
        case 'kits':
          const { data: kitsData } = await supabase
            .from('kits')
            .select('*')
            .order('created_at', { ascending: false })
          setKits(kitsData || [])
          break
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingItem(null)
    setFormData(getEmptyForm())
    setShowModal(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setFormData(item)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setFormData({})
  }

  const getEmptyForm = () => {
    switch (activeTab) {
      case 'campanhas':
        return {
          nome: '',
          descricao: '',
          desconto_percentual: 10,
          data_inicio: '',
          data_fim: ''
        }
      case 'cupons':
        return {
          codigo: '',
          descricao: '',
          tipo: 'percentual',
          valor: 10,
          data_validade: '',
          limite_uso_total: null,
          limite_uso_cliente: 1
        }
      case 'vale':
        return {
          codigo: '',
          valor_original: 0,
          saldo_atual: 0,
          cliente_nome: ''
        }
      case 'kits':
        return {
          nome: '',
          descricao: '',
          preco: 0,
          desconto_embutido: 0
        }
      default:
        return {}
    }
  }

  const getTableName = () => {
    switch (activeTab) {
      case 'campanhas': return 'marketing_campaigns'
      case 'cupons': return 'coupons'
      case 'vale': return 'gift_cards'
      case 'kits': return 'kits'
      default: return ''
    }
  }

  const saveItem = async () => {
    setSaving(true)
    try {
      const tableName = getTableName()
      
      // Preparar dados
      let dataToSave = { ...formData }
      
      // Ajustes específicos por tipo
      if (activeTab === 'cupons') {
        dataToSave.codigo = dataToSave.codigo?.toUpperCase()
      }
      if (activeTab === 'vale') {
        dataToSave.codigo = dataToSave.codigo || `VALE-${Date.now()}`
        dataToSave.saldo_atual = dataToSave.valor_original
      }

      if (editingItem) {
        const { error } = await supabase
          .from(tableName)
          .update(dataToSave)
          .eq('id', editingItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from(tableName)
          .insert(dataToSave)
        if (error) throw error
      }

      closeModal()
      fetchData()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      alert('Erro ao salvar: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (id) => {
    if (!confirm('Tem certeza que deseja excluir?')) return
    
    try {
      const { error } = await supabase
        .from(getTableName())
        .delete()
        .eq('id', id)
      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Erro ao excluir:', error)
      alert('Erro ao excluir')
    }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('pt-BR')
  }

  const formatDesconto = (item) => {
    if (item.desconto_percentual) return `${item.desconto_percentual}%`
    if (item.valor && item.tipo === 'percentual') return `${item.valor}%`
    if (item.valor && item.tipo === 'valor_fixo') return `R$ ${item.valor.toFixed(2)}`
    if (item.desconto_embutido) return `R$ ${item.desconto_embutido.toFixed(2)}`
    if (item.valor_original) return `R$ ${item.valor_original.toFixed(2)}`
    if (item.preco) return `R$ ${item.preco.toFixed(2)}`
    return '-'
  }

  const getCurrentData = () => {
    switch (activeTab) {
      case 'campanhas': return campaigns
      case 'cupons': return coupons
      case 'vale': return giftCards
      case 'kits': return kits
      default: return []
    }
  }

  const filteredData = getCurrentData().filter(item => {
    const nome = item.nome || item.codigo || ''
    return nome.toLowerCase().includes(search.toLowerCase())
  })

  const getTabTitle = () => {
    switch (activeTab) {
      case 'campanhas': return 'Campanha'
      case 'cupons': return 'Cupom'
      case 'vale': return 'Vale-Presente'
      case 'kits': return 'Kit'
      default: return ''
    }
  }

  return (
    <div className="page-container marketing-page">
      {/* Search bar */}
      <div className="marketing-search">
        <input
          type="text"
          placeholder="Buscar por nome"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Search size={16} className="search-icon" />
      </div>

      {/* Tab buttons */}
      <div className="marketing-tabs">
        <button 
          className="tab-btn tab-primary"
          onClick={openCreateModal}
        >
          <Plus size={14} /> {getTabTitle()}
        </button>
        <button 
          className={`tab-btn tab-dark ${activeTab === 'cupons' ? 'active' : ''}`}
          onClick={() => setActiveTab('cupons')}
        >
          Cupons
        </button>
        <button 
          className={`tab-btn tab-dark ${activeTab === 'vale' ? 'active' : ''}`}
          onClick={() => setActiveTab('vale')}
        >
          Vale-Presente
        </button>
        <button 
          className={`tab-btn tab-dark ${activeTab === 'kits' ? 'active' : ''}`}
          onClick={() => setActiveTab('kits')}
        >
          Kits
        </button>
      </div>

      {/* Table */}
      <div className="marketing-table-container">
        <table className="marketing-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Data</th>
              <th>Desconto</th>
              <th style={{ width: '100px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="loading-cell">
                  Carregando...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan="4" className="empty-cell">
                  Nenhum resultado encontrado
                </td>
              </tr>
            ) : (
              filteredData.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? 'row-even' : 'row-odd'}>
                  <td>{item.nome || item.codigo}</td>
                  <td>{formatDate(item.data_inicio || item.data_validade || item.created_at)}</td>
                  <td>{formatDesconto(item)}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-icon" onClick={() => openEditModal(item)}>
                        <Edit size={14} />
                      </button>
                      <button className="btn-icon btn-icon-danger" onClick={() => deleteItem(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="marketing-pagination">
        Página 1 / 1 - {filteredData.length} resultados
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? `Editar ${getTabTitle()}` : `Criar ${getTabTitle()}`}</h2>
              <button className="modal-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Campanhas Form */}
              {activeTab === 'campanhas' && (
                <>
                  <div className="form-group">
                    <label>Nome da Campanha *</label>
                    <input
                      type="text"
                      value={formData.nome || ''}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Promoção de Verão"
                    />
                  </div>
                  <div className="form-group">
                    <label>Descrição</label>
                    <textarea
                      value={formData.descricao || ''}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Desconto (%)</label>
                      <input
                        type="number"
                        value={formData.desconto_percentual || 0}
                        onChange={(e) => setFormData({ ...formData, desconto_percentual: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Data Início</label>
                      <input
                        type="datetime-local"
                        value={formData.data_inicio || ''}
                        onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Data Fim</label>
                    <input
                      type="datetime-local"
                      value={formData.data_fim || ''}
                      onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* Cupons Form */}
              {activeTab === 'cupons' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Código *</label>
                      <input
                        type="text"
                        value={formData.codigo || ''}
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                        placeholder="Ex: PROMO10"
                      />
                    </div>
                    <div className="form-group">
                      <label>Tipo de Desconto</label>
                      <select
                        value={formData.tipo || 'percentual'}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                      >
                        <option value="percentual">Percentual (%)</option>
                        <option value="valor_fixo">Valor Fixo (R$)</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Valor</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.valor || 0}
                        onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Validade</label>
                      <input
                        type="datetime-local"
                        value={formData.data_validade || ''}
                        onChange={(e) => setFormData({ ...formData, data_validade: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Limite Total de Uso</label>
                      <input
                        type="number"
                        value={formData.limite_uso_total || ''}
                        onChange={(e) => setFormData({ ...formData, limite_uso_total: parseInt(e.target.value) || null })}
                        placeholder="Ilimitado"
                      />
                    </div>
                    <div className="form-group">
                      <label>Limite por Cliente</label>
                      <input
                        type="number"
                        value={formData.limite_uso_cliente || 1}
                        onChange={(e) => setFormData({ ...formData, limite_uso_cliente: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Vale-Presente Form */}
              {activeTab === 'vale' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Código (auto-gerado se vazio)</label>
                      <input
                        type="text"
                        value={formData.codigo || ''}
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                        placeholder="VALE-XXXXX"
                      />
                    </div>
                    <div className="form-group">
                      <label>Valor (R$) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.valor_original || 0}
                        onChange={(e) => setFormData({ ...formData, valor_original: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Nome do Destinatário</label>
                    <input
                      type="text"
                      value={formData.cliente_nome || ''}
                      onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
                      placeholder="Nome de quem vai receber"
                    />
                  </div>
                </>
              )}

              {/* Kits Form */}
              {activeTab === 'kits' && (
                <>
                  <div className="form-group">
                    <label>Nome do Kit *</label>
                    <input
                      type="text"
                      value={formData.nome || ''}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Kit Noiva Completo"
                    />
                  </div>
                  <div className="form-group">
                    <label>Descrição</label>
                    <textarea
                      value={formData.descricao || ''}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Preço (R$) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.preco || 0}
                        onChange={(e) => setFormData({ ...formData, preco: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Desconto Embutido (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.desconto_embutido || 0}
                        onChange={(e) => setFormData({ ...formData, desconto_embutido: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={saveItem}
                disabled={saving}
              >
                {saving ? 'Salvando...' : editingItem ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
