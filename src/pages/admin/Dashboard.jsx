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
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)) // YYYY-MM
  const [stats, setStats] = useState({
    totalClients: 0,
    pendingClients: 0,
    totalProducts: 0,
    openLots: 0,
    totalOrders: 0,
    totalRevenue: 0
  })
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [selectedMonth])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      let queryItems = supabase.from('romaneio_items').select(`
        id,
        valor_total,
        created_at,
        product:products(nome),
        romaneio:romaneios(
          status_pagamento,
          client:clients(nome)
        )
      `)

      let queryTotalOrders = supabase.from('romaneio_items').select('*', { count: 'exact', head: true })

      let queryRevenue = supabase.from('romaneios').select('valor_total')
        .in('status_pagamento', ['pago', 'enviado', 'concluido', 'em_separacao', 'admin_purchase'])

      if (selectedMonth !== 'all') {
        const startDate = `${selectedMonth}-01T00:00:00Z`
        const endDate = new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)).toISOString()

        queryItems = queryItems.gte('created_at', startDate).lt('created_at', endDate)
        queryTotalOrders = queryTotalOrders.gte('created_at', startDate).lt('created_at', endDate)
        queryRevenue = queryRevenue.gte('created_at', startDate).lt('created_at', endDate)
      }

      // Execute Queries
      const [
        { count: totalClients },
        { count: pendingClients },
        { count: totalProducts },
        { data: allLots },
        { count: totalOrdersCount },
        { data: revenueData },
        { data: items }
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('role', 'cliente'),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('approved', false),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('lots').select('id'),
        queryTotalOrders,
        queryRevenue,
        queryItems.order('created_at', { ascending: false }).limit(50)
      ])

      const realTotalLots = allLots ? allLots.length : 0
      const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.valor_total || 0), 0) || 0

      const formattedOrders = (items || []).map(item => ({
        id: item.id,
        client: item.romaneio?.client,
        product: item.product,
        valor_total: item.valor_total,
        status: item.romaneio?.status_pagamento || 'pendente',
        romaneio_id: item.romaneio?.id,
        created_at: item.created_at
      }))

      setStats({
        totalClients: totalClients || 0,
        pendingClients: pendingClients || 0,
        totalProducts: totalProducts || 0,
        openLots: realTotalLots || 0,
        totalOrders: totalOrdersCount || 0,
        totalRevenue: totalRevenue
      })
      setRecentOrders(formattedOrders)
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
    }
  ]

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
          <select
            className="form-select"
            value={selectedMonth === 'all' ? 'all' : 'monthly'}
            onChange={(e) => {
              if (e.target.value === 'all') setSelectedMonth('all')
              else setSelectedMonth(new Date().toISOString().substring(0, 7))
            }}
          >
            <option value="monthly">Filtrar por Mês</option>
            <option value="all">Ver Tudo (Total)</option>
          </select>

          {selectedMonth !== 'all' && (
            <input
              type="month"
              className="form-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          )}
        </div>
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
            <h3>{selectedMonth === 'all' ? 'Todos os Pedidos' : 'Pedidos do Mês'}</h3>
          </div>
          <div className="card-body">
            {recentOrders.length === 0 ? (
              <p className="text-muted text-center">Nenhum pedido encontrado no período</p>
            ) : (
              <div className="table-container scrollable-table" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Cliente</th>
                      <th>Produto</th>
                      <th>Valor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{new Date(order.created_at).toLocaleDateString('pt-BR')}</td>
                        <td>
                          {order.romaneio_id ? (
                            <Link to={`/admin/romaneios/${order.romaneio_id}`} className="text-primary hover-underline">
                              {order.client?.nome || '-'}
                            </Link>
                          ) : (
                            order.client?.nome || '-'
                          )}
                        </td>
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
    aguardando_pagamento: 'warning',
    aguardando: 'warning',
    pago: 'success',
    em_separacao: 'info',
    em_preparacao: 'info',
    enviado: 'primary',
    entregue: 'success',
    concluido: 'success',
    cancelado: 'danger',
    admin_purchase: 'success'
  }
  return colors[status] || 'secondary'
}
