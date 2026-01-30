import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Package, ShoppingBag, Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import './ClientDashboard.css'

export default function ClientDashboard() {
  const { client } = useAuth()
  const [stats, setStats] = useState({ pedidos: 0, lotesAbertos: 0 })
  const [recentOrders, setRecentOrders] = useState([])
  const [openLots, setOpenLots] = useState([])

  useEffect(() => {
    if (client?.id) {
      fetchData()
    }
  }, [client])

  const fetchData = async () => {
    // Lotes abertos
    const { data: lots } = await supabase
      .from('lots')
      .select('*')
      .eq('status', 'aberto')
      .order('created_at', { ascending: false })
      .limit(3)

    setOpenLots(lots || [])

    // Pedidos do cliente
    const { data: orders, count } = await supabase
      .from('orders')
      .select(`
        *,
        product:products(nome, imagem1)
      `, { count: 'exact' })
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(5)

    setRecentOrders(orders || [])
    setStats({
      pedidos: count || 0,
      lotesAbertos: lots?.length || 0
    })
  }

  return (
    <div className="client-dashboard">
      <div className="client-welcome">
        <h1>Olá, {client?.nome?.split(' ')[0]}! 👋</h1>
        <p>Bem-vinda de volta ao Grupo AA de Semijoias</p>
      </div>

      {/* Stars / Loyalty */}
      <div className="client-loyalty-card">
        <div className="loyalty-stars">
          {[...Array(5)].map((_, i) => (
            <Star 
              key={i}
              size={24}
              fill={i < (client?.estrelinhas || 0) ? '#ffc107' : 'none'}
              color={i < (client?.estrelinhas || 0) ? '#ffc107' : '#ddd'}
            />
          ))}
        </div>
        <div className="loyalty-info">
          <span className="loyalty-count">{client?.estrelinhas || 0} estrelinhas</span>
          <span className="loyalty-text">Continue comprando para ganhar mais!</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="client-quick-stats">
        <div className="quick-stat">
          <ShoppingBag size={24} className="text-primary" />
          <div>
            <strong>{stats.pedidos}</strong>
            <span>Meus Pedidos</span>
          </div>
        </div>
        <div className="quick-stat">
          <Package size={24} className="text-success" />
          <div>
            <strong>{stats.lotesAbertos}</strong>
            <span>Lotes Abertos</span>
          </div>
        </div>
      </div>

      {/* Open Lots */}
      <section className="client-section">
        <div className="section-header">
          <h2>🔥 Lotes Abertos</h2>
          <Link to="/cliente/catalogo" className="btn btn-outline btn-sm">
            Ver todos
          </Link>
        </div>

        {openLots.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum lote aberto no momento</p>
          </div>
        ) : (
          <div className="open-lots-grid">
            {openLots.map(lot => (
              <Link key={lot.id} to={`/cliente/catalogo/${lot.id}`} className="open-lot-card">
                <h3>{lot.nome}</h3>
                <p>{lot.descricao}</p>
                <span className="lot-cta">Ver produtos →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Orders */}
      <section className="client-section">
        <div className="section-header">
          <h2>📦 Últimos Pedidos</h2>
          <Link to="/cliente/pedidos" className="btn btn-outline btn-sm">
            Ver todos
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="empty-state">
            <p>Você ainda não fez nenhum pedido</p>
            <Link to="/cliente/catalogo" className="btn btn-primary">
              Começar a comprar
            </Link>
          </div>
        ) : (
          <div className="recent-orders-list">
            {recentOrders.map(order => (
              <div key={order.id} className="recent-order-item">
                <div className="order-product-image">
                  {order.product?.imagem1 ? (
                    <img src={order.product.imagem1} alt={order.product.nome} />
                  ) : (
                    <Package size={24} />
                  )}
                </div>
                <div className="order-info">
                  <strong>{order.product?.nome}</strong>
                  <span>Qtd: {order.quantidade} | R$ {order.valor_total?.toFixed(2)}</span>
                </div>
                <span className={`badge badge-${getStatusClass(order.status)}`}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function getStatusClass(status) {
  const classes = {
    pendente: 'warning',
    pago: 'success',
    em_preparacao: 'info',
    enviado: 'primary',
    entregue: 'success',
    cancelado: 'danger'
  }
  return classes[status] || 'secondary'
}
