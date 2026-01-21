import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { 
  ClipboardList, 
  Package,
  Search,
  CheckCircle,
  Circle,
  Clock,
  Users,
  ChevronDown,
  Filter,
  Check,
  X,
  Printer,
  MessageCircle,
  ArrowLeft
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './SeparacaoList.css'

export default function SeparacaoList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lotIdFromUrl = searchParams.get('lot')
  
  const [lots, setLots] = useState([])
  const [selectedLot, setSelectedLot] = useState(null)
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingReservas, setLoadingReservas] = useState(false)
  const [checkedItems, setCheckedItems] = useState({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchLots()
  }, [])

  useEffect(() => {
    // Se veio um lot da URL, selecionar automaticamente
    if (lotIdFromUrl && lots.length > 0) {
      const lot = lots.find(l => l.id === lotIdFromUrl)
      if (lot) {
        handleSelectLot(lot)
      }
    }
  }, [lotIdFromUrl, lots])

  const fetchLots = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('*')
        .in('status', ['fechado', 'preparacao', 'pago', 'enviado'])
        .order('updated_at', { ascending: false })

      if (error) throw error
      setLots(data || [])
      
      // Se não veio da URL, selecionar o primeiro automaticamente
      if (!lotIdFromUrl && data && data.length > 0) {
        fetchReservas(data[0].id)
        setSelectedLot(data[0])
      }
    } catch (error) {
      console.error('Erro ao carregar links:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReservas = async (lotId) => {
    setLoadingReservas(true)
    try {
      // Buscar pedidos/reservas agrupados por cliente
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(id, nome, telefone, email),
          product:products(id, nome, preco, imagem1)
        `)
        .eq('lot_id', lotId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Agrupar por cliente
      const grouped = (orders || []).reduce((acc, order) => {
        const clientId = order.client_id
        if (!acc[clientId]) {
          acc[clientId] = {
            client: order.client,
            items: [],
            total: 0,
            quantidade: 0
          }
        }
        acc[clientId].items.push(order)
        acc[clientId].total += order.valor_total || 0
        acc[clientId].quantidade += order.quantidade || 0
        return acc
      }, {})

      setReservas(Object.values(grouped))
    } catch (error) {
      console.error('Erro ao carregar reservas:', error)
    } finally {
      setLoadingReservas(false)
    }
  }

  const handleSelectLot = (lot) => {
    setSelectedLot(lot)
    setCheckedItems({})
    fetchReservas(lot.id)
  }

  const toggleItem = (itemId) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }))
  }

  const toggleAllClient = (clientReserva) => {
    const allChecked = clientReserva.items.every(item => checkedItems[item.id])
    const newChecked = { ...checkedItems }
    
    clientReserva.items.forEach(item => {
      newChecked[item.id] = !allChecked
    })
    
    setCheckedItems(newChecked)
  }

  const getClientProgress = (clientReserva) => {
    const checked = clientReserva.items.filter(item => checkedItems[item.id]).length
    return {
      checked,
      total: clientReserva.items.length,
      percentage: (checked / clientReserva.items.length) * 100
    }
  }

  const getLotStatusBadge = (status) => {
    const statusMap = {
      'fechado': { label: 'Fechado', class: 'badge-secondary' },
      'preparacao': { label: 'Em Preparação', class: 'badge-warning' },
      'pago': { label: 'Pago', class: 'badge-success' },
      'enviado': { label: 'Enviado', class: 'badge-primary' },
    }
    return statusMap[status] || { label: status, class: 'badge-secondary' }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const openWhatsApp = (client) => {
    if (!client?.telefone) return
    
    const phone = client.telefone.replace(/\D/g, '')
    const message = encodeURIComponent(
      `Olá ${client.nome}! 🌟\n\n` +
      `Seu pedido do *${selectedLot?.nome}* está sendo preparado!\n\n` +
      `Em breve entraremos em contato com mais informações. 💎`
    )
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
  }

  const filteredReservas = reservas.filter(r => {
    if (!search) return true
    return r.client?.nome?.toLowerCase().includes(search.toLowerCase())
  })

  // Calcular estatísticas
  const stats = {
    totalClientes: reservas.length,
    totalItens: reservas.reduce((sum, r) => sum + r.quantidade, 0),
    itensSeparados: Object.values(checkedItems).filter(Boolean).length,
    valorTotal: reservas.reduce((sum, r) => sum + r.total, 0)
  }

  return (
    <div className="separacao-page">
      <div className="page-header">
        <button className="btn-voltar" onClick={() => navigate('/admin/lotes')}>
          <ArrowLeft size={18} />
          Voltar
        </button>
        <div className="header-title">
          <h1><ClipboardList size={24} /> Separação</h1>
          <p className="page-subtitle">Confira e separe os produtos de cada cliente</p>
        </div>
      </div>

      <div className="separacao-layout">
        {/* Sidebar: Lista de Links */}
        <div className="separacao-sidebar">
          <div className="sidebar-header">
            <h3>Links para Separar</h3>
          </div>
          <div className="sidebar-content">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner" />
              </div>
            ) : lots.length === 0 ? (
              <div className="empty-state-sm">
                <p>Nenhum link para separar</p>
              </div>
            ) : (
              <ul className="lot-list">
                {lots.map(lot => {
                  const statusBadge = getLotStatusBadge(lot.status)
                  return (
                    <li 
                      key={lot.id}
                      className={`lot-item ${selectedLot?.id === lot.id ? 'active' : ''}`}
                      onClick={() => handleSelectLot(lot)}
                    >
                      <div className="lot-item-info">
                        <strong>{lot.nome}</strong>
                        <span className={`badge ${statusBadge.class}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                      <small>{formatDate(lot.updated_at)}</small>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="separacao-content">
          {!selectedLot ? (
            <div className="empty-state">
              <ClipboardList size={48} />
              <h3>Selecione um link</h3>
              <p>Clique em um link na lista para iniciar a separação</p>
            </div>
          ) : (
            <>
              {/* Header do Link */}
              <div className="content-header">
                <div>
                  <h2>{selectedLot.nome}</h2>
                  <span className="text-secondary">
                    {stats.totalClientes} cliente(s) | {stats.totalItens} item(ns)
                  </span>
                </div>
                <div className="header-stats">
                  <div className="stat-mini">
                    <span className="stat-label">Separados</span>
                    <span className="stat-value">{stats.itensSeparados}/{stats.totalItens}</span>
                  </div>
                  <div className="stat-mini stat-success">
                    <span className="stat-label">Valor</span>
                    <span className="stat-value">R$ {stats.valorTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Barra de Busca */}
              <div className="content-filters">
                <div className="search-box">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
                  <Printer size={16} /> Imprimir
                </button>
              </div>

              {/* Lista de Clientes para Separação */}
              {loadingReservas ? (
                <div className="loading-state">
                  <div className="loading-spinner" />
                </div>
              ) : filteredReservas.length === 0 ? (
                <div className="empty-state">
                  <Package size={48} />
                  <h3>Nenhum pedido encontrado</h3>
                  <p>Não há pedidos para separar neste link</p>
                </div>
              ) : (
                <div className="separacao-cards">
                  {filteredReservas.map(clientReserva => {
                    const progress = getClientProgress(clientReserva)
                    const isComplete = progress.percentage === 100
                    
                    return (
                      <div 
                        key={clientReserva.client?.id} 
                        className={`separacao-card ${isComplete ? 'complete' : ''}`}
                      >
                        <div className="separacao-card-header">
                          <div className="client-info">
                            <h4>
                              {isComplete && <CheckCircle size={18} className="check-icon" />}
                              {clientReserva.client?.nome}
                            </h4>
                            <span>{clientReserva.client?.telefone}</span>
                          </div>
                          <div className="header-actions">
                            <button 
                              className="btn btn-icon"
                              onClick={() => openWhatsApp(clientReserva.client)}
                              title="WhatsApp"
                            >
                              <MessageCircle size={16} />
                            </button>
                            <button 
                              className="btn btn-icon"
                              onClick={() => toggleAllClient(clientReserva)}
                              title={progress.checked === progress.total ? "Desmarcar todos" : "Marcar todos"}
                            >
                              {progress.checked === progress.total ? <X size={16} /> : <Check size={16} />}
                            </button>
                          </div>
                        </div>

                        <div className="separacao-progress">
                          <div className="progress-bar">
                            <div 
                              className="progress-fill"
                              style={{ width: `${progress.percentage}%` }}
                            />
                          </div>
                          <span className="progress-text">
                            {progress.checked}/{progress.total} itens
                          </span>
                        </div>
                        
                        <div className="separacao-items">
                          {clientReserva.items.map(item => (
                            <label 
                              key={item.id} 
                              className={`separacao-item ${checkedItems[item.id] ? 'checked' : ''}`}
                            >
                              <input 
                                type="checkbox" 
                                checked={!!checkedItems[item.id]}
                                onChange={() => toggleItem(item.id)}
                              />
                              <span className="checkbox-custom">
                                {checkedItems[item.id] ? <Check size={14} /> : null}
                              </span>
                              <div className="item-image">
                                {item.product?.imagem1 ? (
                                  <img src={item.product.imagem1} alt="" />
                                ) : (
                                  <div className="no-image"><Package size={16} /></div>
                                )}
                              </div>
                              <div className="item-info">
                                <span className="item-name">{item.product?.nome}</span>
                                <span className="item-qty">Qtd: {item.quantidade}</span>
                              </div>
                              <span className="item-price">R$ {(item.valor_total || 0).toFixed(2)}</span>
                            </label>
                          ))}
                        </div>

                        <div className="separacao-card-footer">
                          <span className="total-label">Total:</span>
                          <span className="total-value">R$ {clientReserva.total.toFixed(2)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

