import { useState, useEffect } from 'react'
import { ShoppingBag, Package, Truck, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import './ClientOrders.css'

export default function ClientOrders() {
  const { client } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (client?.id) {
      fetchOrders()
    }
  }, [client])

  const fetchOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          product:products(nome, imagem1, preco),
          lot:lots(nome)
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })

      setOrders(data || [])
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    const icons = {
      pendente: ShoppingBag,
      pago: CheckCircle,
      em_preparacao: Package,
      enviado: Truck,
      entregue: CheckCircle
    }
    return icons[status] || ShoppingBag
  }

  const getStatusLabel = (status) => {
    const labels = {
      pendente: 'Aguardando Pagamento',
      pago: 'Pago',
      em_preparacao: 'Em Preparação',
      enviado: 'Enviado',
      entregue: 'Entregue',
      cancelado: 'Cancelado'
    }
    return labels[status] || status
  }

  const filteredOrders = orders.filter(order => {
    if (!filter) return true
    return order.status === filter
  })

  return (
    <div className="client-orders-page">
      <h1>📦 Meus Pedidos</h1>

      {/* Filters */}
      <div className="order-filters">
        <button 
          className={`filter-btn ${filter === '' ? 'active' : ''}`}
          onClick={() => setFilter('')}
        >
          Todos ({orders.length})
        </button>
        <button 
          className={`filter-btn ${filter === 'pendente' ? 'active' : ''}`}
          onClick={() => setFilter('pendente')}
        >
          Pendentes
        </button>
        <button 
          className={`filter-btn ${filter === 'enviado' ? 'active' : ''}`}
          onClick={() => setFilter('enviado')}
        >
          Enviados
        </button>
        <button 
          className={`filter-btn ${filter === 'entregue' ? 'active' : ''}`}
          onClick={() => setFilter('entregue')}
        >
          Entregues
        </button>
      </div>

      {loading ? (
        <div className="text-center p-lg">
          <div className="loading-spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-state">
          <ShoppingBag size={48} className="text-muted" />
          <p>Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map(order => {
            const StatusIcon = getStatusIcon(order.status)
            return (
              <div key={order.id} className="order-card-client">
                <div className="order-card-main">
                  <div className="order-product-img">
                    {order.product?.imagem1 ? (
                      <img src={order.product.imagem1} alt={order.product.nome} />
                    ) : (
                      <Package size={32} />
                    )}
                  </div>
                  
                  <div className="order-details">
                    <h3>{order.product?.nome}</h3>
                    <p className="order-lot">Lote: {order.lot?.nome || '-'}</p>
                    <p className="order-qty">Quantidade: {order.quantidade}</p>
                  </div>

                  <div className="order-value">
                    <span className="order-total">R$ {order.valor_total?.toFixed(2)}</span>
                    <span className="order-date">
                      {new Date(order.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className={`order-status-bar status-${order.status}`}>
                  <StatusIcon size={16} />
                  <span>{getStatusLabel(order.status)}</span>
                  {order.codigo_rastreio && (
                    <span className="tracking-code">
                      Rastreio: {order.codigo_rastreio}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
