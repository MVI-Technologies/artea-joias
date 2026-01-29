import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  Users,
  ShoppingBag,
  LinkIcon,
  TrendingUp,
  Calendar,
  DollarSign
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './Dashboard.css'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalClients: 0,
    pendingClients: 0,
    totalProducts: 0,
    openLots: 0,
    totalOrders: 0,
    monthRevenue: 0
  })
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Total de clientes
      const { count: totalClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'cliente')

      // Clientes pendentes
      const { count: pendingClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('approved', false)

      // Total de produtos
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true)

      // Lotes (Todos) - Contagem explícita sem head:true para evitar cache issues
      const { data: allLots, error: lotsError } = await supabase
        .from('lots')
        .select('id')

      const realTotalLots = allLots ? allLots.length : 0

      // Total de pedidos
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })

      // Pedidos recentes
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(nome, telefone),
          product:products(nome)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      setStats({
        totalClients: totalClients || 0,
        pendingClients: pendingClients || 0,
        totalProducts: totalProducts || 0,
        openLots: realTotalLots || 0, // Usando a variável correta
        totalOrders: totalOrders || 0,
        monthRevenue: 0
      })
      setRecentOrders(orders || [])
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Clientes',
      value: stats.totalClients,
      icon: Users,
      color: 'primary',
      link: '/admin/clientes',
      badge: stats.pendingClients > 0 ? `${stats.pendingClients} pendentes` : null
    },
    {
      title: 'Produtos',
      value: stats.totalProducts,
      icon: Package,
      color: 'success',
      // Sem link para produtos
    },
    {
      title: 'Total Lotes',
      value: stats.openLots,
      icon: LinkIcon,
      color: 'warning',
      link: '/admin/lotes'
    },
    {
      title: 'Total Pedidos',
      value: stats.totalOrders,
      icon: ShoppingBag,
      color: 'info',
      link: '/admin/pedidos'
    }
  ]

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        {statCards.map((card, index) => {
          const CardContent = () => (
            <>
              <div className="stat-card-icon">
                <card.icon size={24} />
              </div>
              <div className="stat-card-content">
                <span className="stat-value">{card.value}</span>
                <span className="stat-title">{card.title}</span>
                {card.badge && <span className="stat-badge">{card.badge}</span>}
              </div>
            </>
          )

          return card.link ? (
            <Link to={card.link} key={index} className={`stat-card stat-card-${card.color}`}>
              <CardContent />
            </Link>
          ) : (
            <div key={index} className={`stat-card stat-card-${card.color}`} style={{ cursor: 'default' }}>
              <CardContent />
            </div>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h3>Pedidos Recentes</h3>
            <Link to="/admin/pedidos" className="btn btn-sm btn-outline">
              Ver todos
            </Link>
          </div>
          <div className="card-body">
            {recentOrders.length === 0 ? (
              <p className="text-muted text-center">Nenhum pedido encontrado</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Produto</th>
                      <th>Valor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.client?.nome || '-'}</td>
                        <td>{order.product?.nome || '-'}</td>
                        <td>R$ {order.valor_total?.toFixed(2) || '0.00'}</td>
                        <td>
                          <span className={`badge badge-${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Ações Rápidas</h3>
          </div>
          <div className="card-body">
            <div className="quick-actions">
              <Link to="/admin/lotes" className="btn btn-success">
                <LinkIcon size={18} />
                Novo Lote
              </Link>
              <Link to="/admin/clientes/novo" className="btn btn-primary">
                <Users size={18} />
                Novo Cliente
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getStatusColor(status) {
  const colors = {
    pendente: 'warning',
    pago: 'success',
    em_preparacao: 'info',
    enviado: 'primary',
    entregue: 'success',
    cancelado: 'danger'
  }
  return colors[status] || 'secondary'
}
