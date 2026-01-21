import { useState, useEffect } from 'react'
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  DollarSign, 
  Calendar, 
  FileText,
  MoreVertical,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  PieChart
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './Financeiro.css'

export default function Financeiro() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    search: '',
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    type: 'all', // all, receita, despesa
    category: 'all'
  })
  
  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState(getEmptyForm())
  const [saving, setSaving] = useState(false)

  // Report Dropdown
  const [showReportMenu, setShowReportMenu] = useState(false)

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const categories = [
    'Vendas', 'Serviços', 'Marketing', 'Infraestrutura', 
    'Pessoal', 'Impostos', 'Logística', 'Outros'
  ]

  useEffect(() => {
    fetchTransactions()
  }, [filter.month, filter.year, filter.type])

  function getEmptyForm() {
    return {
      descricao: '',
      valor: '',
      tipo: 'despesa',
      categoria: 'Outros',
      data_vencimento: new Date().toISOString().split('T')[0],
      forma_pagamento: 'PIX',
      status: 'pendente',
      parcelas: 1,
      repetir: false
    }
  }

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      // Calcular datas inicio/fim do mês selecionado
      const startDate = new Date(filter.year, filter.month, 1).toISOString()
      const endDate = new Date(filter.year, filter.month + 1, 0).toISOString()

      let query = supabase
        .from('financial_transactions')
        .select('*')
        .gte('data_vencimento', startDate)
        .lte('data_vencimento', endDate)
        .order('data_vencimento', { ascending: true })

      if (filter.type !== 'all') {
        query = query.eq('tipo', filter.type)
      }

      const { data, error } = await query

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error('Erro ao buscar transações:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.descricao || !formData.valor) {
      alert('Preencha os campos obrigatórios')
      return
    }

    setSaving(true)
    try {
      const payload = {
        descricao: formData.descricao,
        valor: parseFloat(formData.valor),
        tipo: formData.tipo,
        categoria: formData.categoria,
        data_vencimento: formData.data_vencimento,
        forma_pagamento: formData.forma_pagamento,
        status: formData.status,
        numero_parcela: 1,
        total_parcelas: parseInt(formData.parcelas) || 1
      }

      if (editingItem) {
        const { error } = await supabase
          .from('financial_transactions')
          .update(payload)
          .eq('id', editingItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('financial_transactions')
          .insert(payload)
        if (error) throw error

        // Lógica simplificada para parcelas/repetição poderia ser aqui
        // Mas por enquanto focamos no registro único
      }

      setShowModal(false)
      fetchTransactions()
    } catch (error) {
      alert('Erro ao salvar: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir este lançamento?')) return
    try {
      await supabase.from('financial_transactions').delete().eq('id', id)
      fetchTransactions()
    } catch (error) {
      alert('Erro ao excluir')
    }
  }

  // Cálculos de Totais
  const totals = transactions.reduce((acc, t) => {
    const val = parseFloat(t.valor)
    if (t.tipo === 'receita') {
      acc.receitas += val
      if (t.status === 'pago') acc.saldo += val
      else acc.previsao += val
    } else {
      acc.despesas += val
      if (t.status === 'pago') acc.saldo -= val
      else acc.previsao -= val
    }
    return acc
  }, { receitas: 0, despesas: 0, saldo: 0, previsao: 0 })

  return (
    <div className="page-container financeiro-page">
      {/* Top Bar with Filters */}
      <div className="financeiro-header">
        <div className="search-box-large">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar por descrição" 
            value={filter.search}
            onChange={e => setFilter({...filter, search: e.target.value})}
          />
        </div>
        
        <div className="date-filters">
          <button onClick={() => setFilter({...filter, month: filter.month - 1})}>
            <ChevronLeft size={16} />
          </button>
          <select 
            value={filter.month} 
            onChange={e => setFilter({...filter, month: parseInt(e.target.value)})}
          >
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select 
            value={filter.year} 
            onChange={e => setFilter({...filter, year: parseInt(e.target.value)})}
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setFilter({...filter, month: filter.month + 1})}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="financeiro-filters-row">
        <div className="type-filter">
          <select 
            value={filter.type} 
            onChange={e => setFilter({...filter, type: e.target.value})}
          >
            <option value="all">Receitas e Despesas</option>
            <option value="receita">Apenas Receitas</option>
            <option value="despesa">Apenas Despesas</option>
          </select>
        </div>
        
        <div className="cat-filter">
          <select 
            value={filter.category} 
            onChange={e => setFilter({...filter, category: e.target.value})}
          >
            <option value="all">Todas as categorias</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card receita">
          <div className="card-icon"><ArrowUpCircle size={20} /></div>
          <div>
            <span>Receitas</span>
            <h3>R$ {totals.receitas.toFixed(2)}</h3>
          </div>
        </div>
        <div className="summary-card despesa">
          <div className="card-icon"><ArrowDownCircle size={20} /></div>
          <div>
            <span>Despesas</span>
            <h3>R$ {totals.despesas.toFixed(2)}</h3>
          </div>
        </div>
        <div className={`summary-card saldo ${totals.previsao >= 0 ? 'positive' : 'negative'}`}>
          <div className="card-icon"><DollarSign size={20} /></div>
          <div>
            <span>Saldo Previsto</span>
            <h3>R$ {totals.previsao.toFixed(2)}</h3>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="actions-bar">
        <button 
          className="btn btn-primary" 
          onClick={() => {
            setEditingItem(null)
            setFormData(getEmptyForm())
            setShowModal(true)
          }}
        >
          <Plus size={16} /> Registro
        </button>

        <div className="dropdown-container">
          <button 
            className="btn btn-dark" 
            onClick={() => setShowReportMenu(!showReportMenu)}
          >
            <FileText size={16} /> Relatórios
          </button>
          
          {showReportMenu && (
            <div className="dropdown-menu">
              <button>Relatório Geral</button>
              <button>A Receber - Atrasados</button>
              <button>A Pagar - Atrasados</button>
              <button>DRE - Mensal</button>
              <button>DRE - Anual</button>
              <hr />
              <button><Download size={14} /> Exportar</button>
              <button><Upload size={14} /> Importar OFX</button>
            </div>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="table-container">
        <table className="finance-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center p-4">Carregando...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan="7" className="text-center p-4">Nenhum lançamento neste período</td></tr>
            ) : (
              transactions.map(item => (
                <tr key={item.id} className="row-hover">
                  <td className="fw-500">{item.descricao}</td>
                  <td>
                    <span className={`type-badge ${item.tipo}`}>
                      {item.tipo === 'receita' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                      {item.tipo}
                    </span>
                  </td>
                  <td>{item.categoria}</td>
                  <td>{new Date(item.data_vencimento).toLocaleDateString('pt-BR')}</td>
                  <td className={`font-mono fw-600 ${item.tipo === 'receita' ? 'text-green' : 'text-red'}`}>
                    R$ {parseFloat(item.valor).toFixed(2)}
                  </td>
                  <td>
                    <span className={`status-pill ${item.status}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn-icon" onClick={() => { setEditingItem(item); setFormData(item); setShowModal(true) }}>
                      <FileText size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Descrição</label>
                <input 
                  value={formData.descricao} 
                  onChange={e => setFormData({...formData, descricao: e.target.value})}
                  placeholder="Ex: Pagamento Fornecedor X"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Valor (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={formData.valor}
                    onChange={e => setFormData({...formData, valor: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Data Vencimento</label>
                  <input 
                    type="date"
                    value={formData.data_vencimento}
                    onChange={e => setFormData({...formData, data_vencimento: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Tipo</label>
                  <select 
                    value={formData.tipo}
                    onChange={e => setFormData({...formData, tipo: e.target.value})}
                  >
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Categoria</label>
                <select 
                  value={formData.categoria}
                  onChange={e => setFormData({...formData, categoria: e.target.value})}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Forma de Pagamento</label>
                <input 
                  value={formData.forma_pagamento}
                  onChange={e => setFormData({...formData, forma_pagamento: e.target.value})}
                />
              </div>
              
              {!editingItem && (
                 <div className="form-row">
                    <div className="form-group">
                      <label>Parcelas</label>
                      <input 
                        type="number" 
                        min="1"
                        value={formData.parcelas}
                        onChange={e => setFormData({...formData, parcelas: e.target.value})}
                      />
                    </div>
                </div>
              )}

            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
