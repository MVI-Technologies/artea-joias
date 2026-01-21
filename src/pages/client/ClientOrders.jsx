import { useState, useEffect } from 'react'
import { ShoppingBag, Package, Truck, CheckCircle, Clock, QrCode, X, Copy } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import './ClientOrders.css'

export default function ClientOrders() {
  const { client } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')
  
  // Payment Modal State
  const [showPixModal, setShowPixModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)

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
          lot:lots(nome, status, chave_pix, nome_beneficiario)
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

  const getStatusInfo = (status) => {
    const map = {
      pendente: { icon: Clock, label: 'Aguardando Pagamento', color: 'warning' },
      pago: { icon: CheckCircle, label: 'Pago', color: 'success' },
      em_preparacao: { icon: Package, label: 'Em Preparação', color: 'info' },
      enviado: { icon: Truck, label: 'Enviado', color: 'primary' },
      entregue: { icon: CheckCircle, label: 'Entregue', color: 'success' },
      cancelado: { icon: X, label: 'Cancelado', color: 'danger' }
    }
    return map[status] || { icon: ShoppingBag, label: status, color: 'secondary' }
  }

  const filteredOrders = orders.filter(order => {
    if (filter === 'todos') return true
    return order.status === filter
  })

  // PIX Logic (Mock for now, using Lot data)
  const handleOpenPix = (order) => {
    setSelectedOrder(order)
    setShowPixModal(true)
  }

  const copyPix = () => {
    if (selectedOrder?.lot?.chave_pix) {
      navigator.clipboard.writeText(selectedOrder.lot.chave_pix)
      alert('Chave PIX copiada!')
    }
  }

  return (
    <div className="client-orders-page page-container">
      <div className="page-header">
        <h1>Meus Pedidos</h1>
        <p className="text-secondary">Acompanhe suas reservas e compras</p>
      </div>

      {/* Filters */}
      <div className="order-filters">
        {['todos', 'pendente', 'pago', 'enviado'].map(f => (
          <button 
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-state">
          <ShoppingBag size={48} />
          <h3>Nenhum pedido encontrado</h3>
          <p>Você ainda não realizou nenhuma reserva nos grupos de compras.</p>
        </div>
      ) : (
        <div className="orders-grid">
          {filteredOrders.map(order => {
            const statusInfo = getStatusInfo(order.status)
            const StatusIcon = statusInfo.icon

            return (
              <div key={order.id} className="order-card-premium">
                {/* Header do Card */}
                <div className="order-card-header">
                  <div className={`status-badge status-${statusInfo.color}`}>
                    <StatusIcon size={14} />
                    {statusInfo.label}
                  </div>
                  <span className="order-date">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                {/* Conteúdo Principal */}
                <div className="order-card-body">
                  <div className="product-thumb">
                    {order.product?.imagem1 ? (
                      <img src={order.product.imagem1} alt={order.product.nome} />
                    ) : (
                      <Package size={24} />
                    )}
                  </div>
                  
                  <div className="product-info">
                    <h3>{order.product?.nome}</h3>
                    <div className="order-meta">
                      <span>Lote: {order.lot?.nome}</span>
                      <span>Qtd: {order.quantidade}</span>
                    </div>
                  </div>

                  <div className="order-price">
                    <small>Total</small>
                    <strong>R$ {order.valor_total?.toFixed(2)}</strong>
                  </div>
                </div>

                {/* Footer / Ações */}
                <div className="order-card-footer">
                  {order.status === 'pendente' && (
                    <button 
                      className="btn btn-primary btn-full"
                      onClick={() => handleOpenPix(order)}
                    >
                      <QrCode size={16} /> Pagar com PIX
                    </button>
                  )}
                  {order.codigo_rastreio && (
                    <div className="tracking-info">
                      <Truck size={14} />
                      <span>Rastreio: {order.codigo_rastreio}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Pagamento PIX */}
      {showPixModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowPixModal(false)}>
          <div className="modal-content payment-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Pagamento PIX</h2>
              <button className="modal-close" onClick={() => setShowPixModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body text-center">
              <div className="pix-amount">
                <small>Valor a pagar</small>
                <h3>R$ {selectedOrder.valor_total?.toFixed(2)}</h3>
              </div>

              <div className="qr-container">
                <QrCode size={120} />
                <p>Escaneie o QR Code</p>
              </div>

              <div className="pix-key-container">
                <label>Ou copie a chave PIX:</label>
                <div className="pix-key-box">
                  <code>{selectedOrder.lot?.chave_pix || 'Chave não configurada'}</code>
                  <button onClick={copyPix}><Copy size={16} /></button>
                </div>
              </div>

              <div className="beneficiary-info">
                <strong>Beneficiário:</strong> {selectedOrder.lot?.nome_beneficiario || 'Artea Joias'}
              </div>

              <div className="payment-instructions">
                <p>ℹ️ Após o pagamento, envie o comprovante pelo WhatsApp com o número do pedido <strong>#{selectedOrder.id.slice(0, 8)}</strong>.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
