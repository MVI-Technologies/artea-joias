import { useState, useEffect } from 'react'
import { Plus, Search, Bell, ChevronDown, Copy, ExternalLink } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import './LotList.css'

export default function LotList() {
  const navigate = useNavigate()
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  useEffect(() => {
    fetchLots()
  }, [])

  const fetchLots = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select(`
          *,
          lot_products:lot_products(count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLots(data || [])
    } catch (error) {
      console.error('Erro ao carregar lotes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'aberto': { label: 'Pronto e Aberto', class: 'status-open' },
      'fechado': { label: 'Fechado', class: 'status-closed' },
      'preparacao': { label: 'Em Preparação', class: 'status-prep' },
      'pago': { label: 'Pago', class: 'status-paid' },
      'enviado': { label: 'Enviado', class: 'status-sent' },
      'concluido': { label: 'Concluído', class: 'status-done' },
    }
    return statusMap[status] || { label: status, class: 'status-default' }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('pt-BR')
  }

  const filteredLots = lots.filter(lot => {
    const matchSearch = lot.nome.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || lot.status === statusFilter
    return matchSearch && matchStatus
  })

  // Agrupar por tipo (Pronta Entrega no topo como destaque)
  const prontaEntrega = filteredLots.find(l => l.nome.includes('Pronta Entrega'))
  const regularLots = filteredLots.filter(l => !l.nome.includes('Pronta Entrega'))

  if (loading) {
    return <div className="page-container"><div className="loading-spinner" style={{ margin: '40px auto' }} /></div>
  }

  return (
    <div className="page-container lots-page">
      {/* Barra de busca e filtros */}
      <div className="lots-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar nome" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select 
          className="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="todos">Todos os status</option>
          <option value="aberto">Pronto e Aberto</option>
          <option value="fechado">Fechado</option>
          <option value="preparacao">Em Preparação</option>
          <option value="pago">Pago</option>
          <option value="enviado">Enviado</option>
          <option value="concluido">Concluído</option>
        </select>
      </div>

      {/* Botões de ação */}
      <div className="lots-actions">
        <button className="btn btn-primary" onClick={() => navigate('/admin/lotes/novo')}>
          <Plus size={18} /> Catálogo
        </button>
        <button className="btn btn-dark">
          <Bell size={18} /> Notificações
        </button>
        <button className="btn btn-dark dropdown-btn">
          Ações <ChevronDown size={16} />
        </button>
      </div>

      {/* Tabela de lotes */}
      <div className="lots-table-container">
        <table className="lots-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Criado em</th>
              <th>Encerramento</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {/* Linha destaque - Pronta Entrega */}
            {prontaEntrega && (
              <tr className="lot-row lot-row-highlight">
                <td className="lot-name">
                  <span className="lot-name-text">{prontaEntrega.nome}</span>
                </td>
                <td></td>
                <td></td>
                <td className="lot-actions-cell">
                  <Link to={`/admin/lotes/${prontaEntrega.id}`} className="btn btn-action btn-products">Produtos</Link>
                  <button className="btn btn-action btn-romaneios">Romaneios</button>
                  <button className="btn btn-action btn-separacao">Separação</button>
                  <button className="btn btn-action btn-acoes dropdown-btn">Ações <ChevronDown size={14} /></button>
                </td>
              </tr>
            )}

            {/* Lotes regulares */}
            {regularLots.map((lot) => {
              const status = getStatusBadge(lot.status)
              return (
                <tr key={lot.id} className="lot-row">
                  <td className="lot-name">
                    <span className="lot-name-text">{lot.nome}</span>
                    <span className={`lot-status-badge ${status.class}`}>
                      {status.label}
                    </span>
                  </td>
                  <td>{formatDate(lot.created_at)}</td>
                  <td>{formatDate(lot.data_fim)}</td>
                  <td className="lot-actions-cell">
                    <Link to={`/admin/lotes/${lot.id}`} className="btn btn-action btn-products">Produtos</Link>
                    <button className="btn btn-action btn-romaneios">Romaneios</button>
                    <button className="btn btn-action btn-separacao">Separação</button>
                    <button className="btn btn-action btn-acoes dropdown-btn">Ações <ChevronDown size={14} /></button>
                  </td>
                </tr>
              )
            })}

            {filteredLots.length === 0 && (
              <tr>
                <td colSpan="4" className="empty-message">
                  Nenhum catálogo encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="lots-pagination">
        Página 1 / 1 - {filteredLots.length} resultados
      </div>
    </div>
  )
}
