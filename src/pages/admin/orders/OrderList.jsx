import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  ShoppingBag, 
  Search, 
  Filter,
  Eye,
  Truck,
  CreditCard,
  Package,
  CheckCircle,
  XCircle,
  ChevronDown
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './OrderList.css'

/**
 * ⚠️ DEPRECATED: This page references the 'orders' table which has been removed.
 * Orders are now managed through Romaneios.
 * Consider removing this page or redirecting to /admin/romaneios
 * See migration 030_remove_orders_table.sql
 */

const statusOptions = [
  { value: '', label: 'Todos os Status' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'em_preparacao', label: 'Em Preparação' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelado', label: 'Cancelado' }
]

export default function OrderList() {
  const [orders, setOrders] = useState([])
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterLot, setFilterLot] = useState('')
  const [selectedOrders, setSelectedOrders] = useState([])

  useEffect(() => {
    fetchOrders()
    fetchLots()
  }, [])

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(id, nome, telefone),
          product:products(id, nome, preco),
          lot:lots(id, nome)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLots = async () => {
    try {
      const { data } = await supabase
        .from('lots')
        .select('id, nome')
        .order('created_at', { ascending: false })

      setLots(data || [])
    } catch (error) {
      console.error('Erro ao carregar lotes:', error)
    }
  }

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (error) throw error
      fetchOrders()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
    }
  }

  const updateMultipleStatus = async (newStatus) => {
    if (selectedOrders.length === 0) {
      alert('Selecione pelo menos um pedido')
      return
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .in('id', selectedOrders)

      if (error) throw error
      setSelectedOrders([])
      fetchOrders()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
    }
  }

  const toggleSelectOrder = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id))
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      pendente: { class: 'badge-warning', icon: CreditCard },
      pago: { class: 'badge-success', icon: CheckCircle },
      em_preparacao: { class: 'badge-info', icon: Package },
      enviado: { class: 'badge-primary', icon: Truck },
      entregue: { class: 'badge-success', icon: CheckCircle },
      cancelado: { class: 'badge-danger', icon: XCircle }
    }
    const badge = badges[status] || { class: 'badge-secondary', icon: Package }
    const Icon = badge.icon
    return (
      <span className={`badge ${badge.class}`}>
        <Icon size={12} style={{ marginRight: 4 }} />
        {status}
      </span>
    )
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.client?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.product?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !filterStatus || order.status === filterStatus
    const matchesLot = !filterLot || order.lot_id === filterLot
    return matchesSearch && matchesStatus && matchesLot
  })

  const totalValue = filteredOrders.reduce((sum, o) => sum + (o.valor_total || 0), 0)

  return (
    <div className="order-list-page">
      <div className="page-header">
        <h1><ShoppingBag size={24} /> Pedidos</h1>
      </div>

      {/* Stats */}
      <div className="order-stats">
        <div className="order-stat">
          <span className="order-stat-value">{filteredOrders.length}</span>
          <span className="order-stat-label">Pedidos</span>
        </div>
        <div className="order-stat">
          <span className="order-stat-value">R$ {totalValue.toFixed(2)}</span>
          <span className="order-stat-label">Total</span>
        </div>
        <div className="order-stat">
          <span className="order-stat-value">
            {orders.filter(o => o.status === 'pendente').length}
          </span>
          <span className="order-stat-label">Pendentes</span>
        </div>
        <div className="order-stat">
          <span className="order-stat-value">
            {orders.filter(o => o.status === 'pago').length}
          </span>
          <span className="order-stat-label">Pagos</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="dropdown">
            <button className="btn btn-primary">
              Ações em Lote <ChevronDown size={14} />
            </button>
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={() => updateMultipleStatus('pago')}>
                Marcar como Pago
              </button>
              <button className="dropdown-item" onClick={() => updateMultipleStatus('em_preparacao')}>
                Marcar Em Preparação
              </button>
              <button className="dropdown-item" onClick={() => updateMultipleStatus('enviado')}>
                Marcar como Enviado
              </button>
              <button className="dropdown-item" onClick={() => updateMultipleStatus('entregue')}>
                Marcar como Entregue
              </button>
            </div>
          </div>
          
          {selectedOrders.length > 0 && (
            <span className="text-muted">{selectedOrders.length} selecionado(s)</span>
          )}
        </div>

        <div className="toolbar-right">
          <div className="search-bar">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar cliente ou produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            style={{ width: 160 }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            className="form-select"
            style={{ width: 160 }}
            value={filterLot}
            onChange={(e) => setFilterLot(e.target.value)}
          >
            <option value="">Todos os Lotes</option>
            {lots.map(lot => (
              <option key={lot.id} value={lot.id}>{lot.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <input 
                    type="checkbox" 
                    checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>ID</th>
                <th>Cliente</th>
                <th>Produto</th>
                <th>Lote</th>
                <th>Qtd</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Rastreio</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" className="text-center">
                    <div className="loading-spinner" />
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="11" className="text-center text-muted">
                    Nenhum pedido encontrado
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id}>
                    <td>
                      <input 
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => toggleSelectOrder(order.id)}
                      />
                    </td>
                    <td>#{order.id?.slice(-6)}</td>
                    <td>
                      <div>
                        <strong>{order.client?.nome || '-'}</strong>
                        <br />
                        <small className="text-muted">{order.client?.telefone}</small>
                      </div>
                    </td>
                    <td>{order.product?.nome || '-'}</td>
                    <td>{order.lot?.nome || '-'}</td>
                    <td>{order.quantidade}</td>
                    <td>R$ {order.valor_total?.toFixed(2)}</td>
                    <td>{getStatusBadge(order.status)}</td>
                    <td>
                      {order.codigo_rastreio || (
                        <button className="btn btn-outline btn-sm">
                          + Adicionar
                        </button>
                      )}
                    </td>
                    <td>{new Date(order.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <div className="order-actions">
                        <select
                          className="form-select"
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          style={{ width: 130 }}
                        >
                          {statusOptions.slice(1).map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span className="text-muted">
            {filteredOrders.length} pedido(s) encontrado(s)
          </span>
        </div>
      </div>
    </div>
  )
}
