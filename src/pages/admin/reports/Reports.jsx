import { useState, useEffect } from 'react'
import { 
  BarChart3, 
  TrendingUp,
  Users,
  Package,
  Calendar,
  Gift,
  Download
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './Reports.css'

export default function Reports() {
  const [activeReport, setActiveReport] = useState('vendas')
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadReport()
  }, [activeReport, dateRange])

  const loadReport = async () => {
    setLoading(true)
    try {
      switch (activeReport) {
        case 'vendas':
          await loadVendasReport()
          break
        case 'produtos':
          await loadProdutosReport()
          break
        case 'clientes':
          await loadClientesReport()
          break
        case 'aniversariantes':
          await loadAniversariantesReport()
          break
        case 'vales':
          await loadValesReport()
          break
        default:
          setData([])
      }
    } catch (error) {
      console.error('Erro ao carregar relatório:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadVendasReport = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        lot:lots(nome)
      `)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59')
      .eq('status', 'pago')

    if (error) throw error

    // Agrupar por dia
    const grouped = data.reduce((acc, order) => {
      const date = order.created_at.split('T')[0]
      if (!acc[date]) {
        acc[date] = { date, total: 0, count: 0 }
      }
      acc[date].total += order.valor_total || 0
      acc[date].count += 1
      return acc
    }, {})

    setData(Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)))
  }

  const loadProdutosReport = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        quantidade,
        product:products(id, nome, preco)
      `)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59')

    if (error) throw error

    // Agrupar por produto
    const grouped = data.reduce((acc, order) => {
      if (!order.product) return acc
      const id = order.product.id
      if (!acc[id]) {
        acc[id] = { 
          product: order.product.nome, 
          quantidade: 0, 
          valor: 0 
        }
      }
      acc[id].quantidade += order.quantidade || 0
      acc[id].valor += (order.quantidade || 0) * (order.product.preco || 0)
      return acc
    }, {})

    setData(Object.values(grouped).sort((a, b) => b.quantidade - a.quantidade))
  }

  const loadClientesReport = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        valor_total,
        client:clients(id, nome, telefone, estrelinhas)
      `)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end + 'T23:59:59')
      .eq('status', 'pago')

    if (error) throw error

    // Agrupar por cliente
    const grouped = data.reduce((acc, order) => {
      if (!order.client) return acc
      const id = order.client.id
      if (!acc[id]) {
        acc[id] = { 
          cliente: order.client.nome,
          telefone: order.client.telefone,
          estrelinhas: order.client.estrelinhas || 0,
          pedidos: 0, 
          total: 0 
        }
      }
      acc[id].pedidos += 1
      acc[id].total += order.valor_total || 0
      return acc
    }, {})

    setData(Object.values(grouped).sort((a, b) => b.total - a.total))
  }

  const loadAniversariantesReport = async () => {
    const currentMonth = new Date().getMonth() + 1
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('role', 'cliente')
      .not('aniversario', 'is', null)

    if (error) throw error

    // Filtrar aniversariantes do mês atual
    const filtered = data.filter(client => {
      if (!client.aniversario) return false
      const month = parseInt(client.aniversario.split('-')[1])
      return month === currentMonth
    })

    setData(filtered.map(c => ({
      nome: c.nome,
      telefone: c.telefone,
      aniversario: new Date(c.aniversario + 'T12:00:00').toLocaleDateString('pt-BR')
    })))
  }

  const loadValesReport = async () => {
    const { data, error } = await supabase
      .from('gift_certificates')
      .select(`
        *,
        client:clients(nome)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    setData(data.map(v => ({
      codigo: v.codigo,
      cliente: v.client?.nome,
      valor: v.valor,
      usado: v.usado ? 'Sim' : 'Não',
      validade: v.validade ? new Date(v.validade).toLocaleDateString('pt-BR') : '-'
    })))
  }

  const exportCSV = () => {
    if (data.length === 0) return

    const headers = Object.keys(data[0])
    let csv = headers.join(',') + '\n'
    
    data.forEach(row => {
      csv += headers.map(h => `"${row[h] || ''}"`).join(',') + '\n'
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `relatorio_${activeReport}_${dateRange.start}_${dateRange.end}.csv`
    link.click()
  }

  const reportTypes = [
    { id: 'vendas', label: 'Vendas Mensais', icon: TrendingUp },
    { id: 'produtos', label: 'Produtos Mais Vendidos', icon: Package },
    { id: 'clientes', label: 'Clientes Top', icon: Users },
    { id: 'aniversariantes', label: 'Aniversariantes', icon: Calendar },
    { id: 'vales', label: 'Vale-Presente', icon: Gift }
  ]

  const getTotalValue = () => {
    if (activeReport === 'vendas') {
      return data.reduce((sum, d) => sum + d.total, 0)
    }
    if (activeReport === 'produtos') {
      return data.reduce((sum, d) => sum + d.valor, 0)
    }
    if (activeReport === 'clientes') {
      return data.reduce((sum, d) => sum + d.total, 0)
    }
    return 0
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1><BarChart3 size={24} /> Relatórios</h1>
      </div>

      {/* Report Type Selector */}
      <div className="report-types">
        {reportTypes.map(type => (
          <button
            key={type.id}
            className={`report-type-btn ${activeReport === type.id ? 'active' : ''}`}
            onClick={() => setActiveReport(type.id)}
          >
            <type.icon size={18} />
            {type.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="report-filters">
        <div className="form-group">
          <label className="form-label">Data Início</label>
          <input
            type="date"
            className="form-input"
            value={dateRange.start}
            onChange={e => setDateRange({...dateRange, start: e.target.value})}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Data Fim</label>
          <input
            type="date"
            className="form-input"
            value={dateRange.end}
            onChange={e => setDateRange({...dateRange, end: e.target.value})}
          />
        </div>
        <button className="btn btn-primary" onClick={loadReport}>
          Gerar Relatório
        </button>
        <button className="btn btn-outline" onClick={exportCSV} disabled={data.length === 0}>
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {/* Results */}
      <div className="card">
        {getTotalValue() > 0 && (
          <div className="report-summary">
            <span>Total: <strong>R$ {getTotalValue().toFixed(2)}</strong></span>
            <span>{data.length} registro(s)</span>
          </div>
        )}
        
        <div className="table-container">
          {loading ? (
            <div className="text-center p-lg">
              <div className="loading-spinner" style={{ width: 40, height: 40 }} />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center p-lg text-muted">
              Nenhum dado encontrado para o período selecionado
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  {Object.keys(data[0]).map(key => (
                    <th key={key}>{formatHeader(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx}>
                    {Object.values(row).map((value, vIdx) => (
                      <td key={vIdx}>
                        {typeof value === 'number' && !Number.isInteger(value)
                          ? `R$ ${value.toFixed(2)}`
                          : value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function formatHeader(key) {
  const headers = {
    date: 'Data',
    total: 'Total',
    count: 'Pedidos',
    product: 'Produto',
    quantidade: 'Quantidade',
    valor: 'Valor',
    cliente: 'Cliente',
    telefone: 'Telefone',
    pedidos: 'Pedidos',
    estrelinhas: 'Estrelinhas',
    nome: 'Nome',
    aniversario: 'Aniversário',
    codigo: 'Código',
    usado: 'Usado',
    validade: 'Validade'
  }
  return headers[key] || key.charAt(0).toUpperCase() + key.slice(1)
}
