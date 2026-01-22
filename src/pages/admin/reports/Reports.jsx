import { useState, useEffect } from 'react'
import { 
  BarChart3, 
  TrendingUp,
  Users,
  Package,
  Calendar,
  Gift,
  Download,
  DollarSign
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './Reports.css'

export default function Reports() {
  const [activeReport, setActiveReport] = useState('financeiro') // Default para a mais importante
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
    setData([])
    try {
      switch (activeReport) {
        case 'financeiro':
          await loadFinanceiroReport()
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
          break
      }
    } catch (error) {
      console.error('Erro ao carregar relatório:', error)
    } finally {
      setLoading(false)
    }
  }

  // Novo Report usando View otimizada
  const loadFinanceiroReport = async () => {
    const { data, error } = await supabase
      .from('report_financial_daily')
      .select('*')
      .gte('data_venda', dateRange.start)
      .lte('data_venda', dateRange.end)

    if (error) {
      console.error('Erro financeiro:', error)
      return
    }

    setData(data.map(d => ({
      data: new Date(d.data_venda).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
      pedidos: d.total_pedidos,
      itens: d.itens_vendidos,
      receita: d.receita_total
    })))
  }

  const loadProdutosReport = async () => {
    const { data, error } = await supabase
      .from('report_ranking_products')
      .select('*')
      .limit(100)

    if (error) {
       console.error('Erro produtos:', error)
       return
    }

    setData(data.map(d => ({
      produto: d.produto_nome,
      sku: d.sku || '-',
      vendidos: d.total_vendido,
      receita: d.receita_gerada
    })))
  }

  const loadClientesReport = async () => {
    const { data, error } = await supabase
      .from('report_ranking_clients')
      .select('*')
      .limit(100)

    if (error) {
      console.error('Error clientes:', error)
      return
    }

    setData(data.map(d => ({
      cliente: d.cliente_nome,
      telefone: d.telefone,
      pedidos: d.total_pedidos,
      total_gasto: d.total_gasto,
      ultima_compra: new Date(d.ultima_compra).toLocaleDateString('pt-BR')
    })))
  }

  const loadAniversariantesReport = async () => {
    const currentMonth = new Date().getMonth() + 1
    const { data, error } = await supabase
      .from('clients')
      .select('nome, telefone, aniversario')
      .eq('role', 'cliente')
      .not('aniversario', 'is', null)

    if (error) throw error

    // Filtrar no JS pois aniversario é DATE
    const filtered = data.filter(client => {
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
      .from('gift_certificates') // Se existir tabela, senão vai dar erro (ok lidar depois)
      .select(`
        codigo, valor, usado, validade,
        client:clients(nome)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      // Se não existir tabela, retorna vazio sem travar
      console.warn('Tabela gift_certificates possivelmente inexistente')
      return 
    }

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
      csv += headers.map(h => {
        let val = row[h]
        if (typeof val === 'string') val = val.replace(/"/g, '""')
        return `"${val || ''}"`
      }).join(',') + '\n'
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `relatorio_${activeReport}_${dateRange.start}.csv`
    link.click()
  }

  const reportTypes = [
    { id: 'financeiro', label: 'Financeiro Diário', icon: DollarSign },
    { id: 'produtos', label: 'Ranking Produtos', icon: Package },
    { id: 'clientes', label: 'Ranking Clientes', icon: Users },
    { id: 'aniversariantes', label: 'Aniversariantes', icon: Calendar },
    { id: 'vales', label: 'Vales', icon: Gift }
  ]

  const getTotalValue = () => {
    if (activeReport === 'financeiro') return data.reduce((sum, d) => sum + d.receita, 0)
    if (activeReport === 'produtos') return data.reduce((sum, d) => sum + d.receita, 0)
    if (activeReport === 'clientes') return data.reduce((sum, d) => sum + d.total_gasto, 0)
    return 0
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1><BarChart3 size={24} /> Relatórios Gerenciais</h1>
      </div>

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

      <div className="report-filters">
        <div className="form-group">
          <label>Início</label>
          <input
            type="date"
            className="form-input"
            value={dateRange.start}
            onChange={e => setDateRange({...dateRange, start: e.target.value})}
          />
        </div>
        <div className="form-group">
          <label>Fim</label>
          <input
            type="date"
            className="form-input"
            value={dateRange.end}
            onChange={e => setDateRange({...dateRange, end: e.target.value})}
          />
        </div>
        <button className="btn btn-primary" onClick={loadReport}>
          Atualizar
        </button>
        <button className="btn btn-outline" onClick={exportCSV} disabled={data.length === 0}>
          <Download size={16} /> CSV
        </button>
      </div>

      <div className="card">
        {getTotalValue() > 0 && (
          <div className="report-summary">
            <span className="summary-total">Total no Período:</span>
            <span className="summary-value">R$ {getTotalValue().toFixed(2)}</span>
          </div>
        )}
        
        <div className="table-container">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner" />
            </div>
          ) : data.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum dado encontrado.</p>
            </div>
          ) : (
            <table className="table reports-table">
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
    data: 'Data',
    pedidos: 'Pedidos',
    itens: 'Itens Vendidos',
    receita: 'Receita Total',
    produto: 'Produto',
    sku: 'SKU',
    vendidos: 'Qtd Vendida',
    cliente: 'Cliente',
    telefone: 'Telefone',
    total_gasto: 'Total Gasto',
    ultima_compra: 'Última Compra'
  }
  return headers[key] || key.charAt(0).toUpperCase() + key.slice(1)
}
