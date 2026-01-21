import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Bell, ChevronDown, Copy, ExternalLink, Link as LinkIcon, MoreVertical, Edit, Lock, FileText, Package, Scissors } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import './LotList.css'

export default function LotList() {
  const navigate = useNavigate()
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [openDropdown, setOpenDropdown] = useState(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    fetchLots()
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
      console.error('Erro ao carregar grupos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'aberto': { label: 'Aberto', class: 'badge-green' },
      'fechado': { label: 'Fechado', class: 'badge-red' },
      'preparacao': { label: 'Em preparação', class: 'badge-orange' },
      'pago': { label: 'Pago', class: 'badge-blue' },
      'enviado': { label: 'Enviado', class: 'badge-purple' },
      'concluido': { label: 'Concluído', class: 'badge-gray' },
      'cancelado': { label: 'Cancelado', class: 'badge-red' },
    }
    return statusMap[status] || { label: status || 'Aberto', class: 'badge-green' }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('pt-BR')
  }

  const toggleDropdown = (lotId, e) => {
    e.stopPropagation()
    setOpenDropdown(openDropdown === lotId ? null : lotId)
  }

  const handleAction = (action, lot) => {
    setOpenDropdown(null)
    switch (action) {
      case 'editar':
        navigate(`/admin/lotes/${lot.id}/editar`)
        break
      case 'privacidade':
        // TODO: Implementar privacidade
        break
      case 'duplicar':
        // TODO: Implementar duplicar
        break
      case 'relatorio':
        // TODO: Implementar relatório
        break
      case 'romaneios':
        navigate(`/admin/romaneios?lot=${lot.id}`)
        break
      case 'separacao':
        // TODO: Implementar separação
        break
      default:
        break
    }
  }

  const filteredLots = lots.filter(lot => {
    const matchSearch = lot.nome?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || lot.status === statusFilter
    return matchSearch && matchStatus
  })

  // Separar "Minha Loja - Pronta Entrega" no topo
  const prontaEntrega = filteredLots.find(l => l.nome?.includes('Pronta Entrega'))
  const regularLots = filteredLots.filter(l => !l.nome?.includes('Pronta Entrega'))

  if (loading) {
    return <div className="page-container"><div className="loading-spinner" style={{ margin: '40px auto' }} /></div>
  }

  return (
    <div className="page-container grupo-compras-page">
      {/* Barra de busca e filtros */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Buscar nome" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} className="search-icon" />
          </div>
        </div>
        <div className="toolbar-right">
          <select 
            className="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="todos">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="fechado">Fechado</option>
            <option value="preparacao">Em preparação</option>
            <option value="pago">Pago</option>
            <option value="enviado">Enviado</option>
            <option value="concluido">Concluído</option>
          </select>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="action-buttons">
        <button className="btn btn-primary" onClick={() => navigate('/admin/lotes/novo')}>
          <Plus size={16} /> Catálogo
        </button>
        <button className="btn btn-dark">
          Notificações
        </button>
        <button className="btn btn-dark dropdown-toggle">
          Ações <ChevronDown size={14} />
        </button>
      </div>

      {/* Tabela de grupos */}
      <div className="table-container">
        <table className="grupos-table">
          <thead>
            <tr>
              <th className="col-nome text-white">Nome</th>
              <th className="col-data text-white">Data início</th>
              <th className="col-data text-white">Encerramento</th>
              <th className="col-acoes text-white">Ações</th>
            </tr>
          </thead>
          <tbody>
            {/* Linha destaque - Pronta Entrega */}
            {prontaEntrega && (
              <tr className="row-highlight">
                <td className="col-nome">
                  <span className="nome-text">{prontaEntrega.nome}</span>
                </td>
                <td className="col-data"></td>
                <td className="col-data"></td>
                <td className="col-acoes">
                  <div className="acoes-buttons">
                    <Link to={`/admin/lotes/${prontaEntrega.id}`} className="btn-action btn-produtos">
                      Produtos
                    </Link>
                    <button className="btn-action btn-romaneios">Romaneios</button>
                    <button className="btn-action btn-separacao">Separação</button>
                    <div className="dropdown-container" ref={dropdownRef}>
                      <button 
                        className="btn-action btn-acoes"
                        onClick={(e) => toggleDropdown(prontaEntrega.id, e)}
                      >
                        Ações <ChevronDown size={12} />
                      </button>
                      {openDropdown === prontaEntrega.id && (
                        <div className="dropdown-menu">
                          <button onClick={() => handleAction('editar', prontaEntrega)}>Editar</button>
                          <button onClick={() => handleAction('privacidade', prontaEntrega)}>Privacidade</button>
                          <button onClick={() => handleAction('duplicar', prontaEntrega)}>Duplicar</button>
                          <button onClick={() => handleAction('relatorio', prontaEntrega)}>Relatório Produtos</button>
                          <button onClick={() => handleAction('romaneios', prontaEntrega)}>Romaneios</button>
                          <button onClick={() => handleAction('separacao', prontaEntrega)}>Separação</button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {/* Lotes regulares */}
            {regularLots.map((lot) => {
              const status = getStatusBadge(lot.status)
              return (
                <tr key={lot.id} className="row-regular">
                  <td className="col-nome">
                    <span className="nome-text">{lot.nome}</span>
                    <span className={`status-badge ${status.class}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="col-data">{formatDate(lot.created_at)}</td>
                  <td className="col-data">{formatDate(lot.data_fim)}</td>
                  <td className="col-acoes">
                    <div className="acoes-buttons">
                      <Link to={`/admin/lotes/${lot.id}`} className="btn-action btn-produtos">
                        Produtos
                      </Link>
                      <button className="btn-action btn-romaneios">Romaneios</button>
                      <button className="btn-action btn-separacao">Separação</button>
                      <div className="dropdown-container" ref={openDropdown === lot.id ? dropdownRef : null}>
                        <button 
                          className="btn-action btn-acoes"
                          onClick={(e) => toggleDropdown(lot.id, e)}
                        >
                          Ações <ChevronDown size={12} />
                        </button>
                        {openDropdown === lot.id && (
                          <div className="dropdown-menu">
                            <button onClick={() => handleAction('editar', lot)}>Editar</button>
                            <button onClick={() => handleAction('privacidade', lot)}>Privacidade</button>
                            <button onClick={() => handleAction('duplicar', lot)}>Duplicar</button>
                            <button onClick={() => handleAction('relatorio', lot)}>Relatório Produtos</button>
                            <button onClick={() => handleAction('romaneios', lot)}>Romaneios</button>
                            <button onClick={() => handleAction('separacao', lot)}>Separação</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}

            {filteredLots.length === 0 && (
              <tr>
                <td colSpan="4" className="empty-message">
                  Nenhum grupo de compras encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="pagination">
        Página 1 / 1 - {filteredLots.length} resultados
      </div>
    </div>
  )
}
