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
  }, [activeReport])

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
      setData([])
    } finally {
      setLoading(false)
    }
  }

  // Novo Report usando View otimizada
  const loadFinanceiroReport = async () => {
    const startDate = new Date(dateRange.start)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(dateRange.end)
    endDate.setHours(23, 59, 59, 999)
    
    const { data, error } = await supabase
      .from('report_financial_daily')
      .select('*')
      .gte('data_venda', dateRange.start)
      .lte('data_venda', dateRange.end)

    if (error) {
      console.error('Erro financeiro:', error)
      setData([])
      return
    }

    if (!data || data.length === 0) {
      console.log('Nenhum dado financeiro encontrado no período')
      setData([])
      return
    }

    setData(data.map(d => ({
      data: new Date(d.data_venda).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
      pedidos: d.total_pedidos || 0,
      itens: d.itens_vendidos || 0,
      receita: d.receita_total || 0
    })))
  }

  const loadProdutosReport = async () => {
    // Buscar diretamente da tabela orders com filtro de data
    const startDate = new Date(dateRange.start)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(dateRange.end)
    endDate.setHours(23, 59, 59, 999)
    
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select(`
        quantidade,
        valor_total,
        created_at,
        product:products(nome, codigo_sku)
      `)
      .eq('status', 'pago')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (error) {
      console.error('Erro produtos:', error)
      setData([])
      return
    }

    if (!ordersData || ordersData.length === 0) {
      console.log('Nenhum produto encontrado no ranking no período selecionado')
      setData([])
      return
    }

    // Agregar por produto
    const productMap = {}
    ordersData.forEach(order => {
      if (!order.product) return
      const productId = order.product.nome
      if (!productMap[productId]) {
        productMap[productId] = {
          produto: order.product.nome || '-',
          sku: order.product.codigo_sku || '-',
          vendidos: 0,
          receita: 0
        }
      }
      productMap[productId].vendidos += order.quantidade || 0
      productMap[productId].receita += parseFloat(order.valor_total || 0)
    })

    const sorted = Object.values(productMap)
      .sort((a, b) => b.vendidos - a.vendidos)
      .slice(0, 100)

    setData(sorted)
  }

  const loadClientesReport = async () => {
    // Buscar diretamente da tabela orders com filtro de data
    const startDate = new Date(dateRange.start)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(dateRange.end)
    endDate.setHours(23, 59, 59, 999)
    
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select(`
        id,
        valor_total,
        created_at,
        client:clients(nome, telefone)
      `)
      .eq('status', 'pago')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (error) {
      console.error('Erro clientes:', error)
      setData([])
      return
    }

    if (!ordersData || ordersData.length === 0) {
      console.log('Nenhum cliente encontrado no ranking no período selecionado')
      setData([])
      return
    }

    // Agregar por cliente
    const clientMap = {}
    ordersData.forEach(order => {
      if (!order.client) return
      const clientId = order.client.nome
      if (!clientMap[clientId]) {
        clientMap[clientId] = {
          cliente: order.client.nome || '-',
          telefone: order.client.telefone || '-',
          pedidos: 0,
          total_gasto: 0,
          ultima_compra: null
        }
      }
      clientMap[clientId].pedidos += 1
      clientMap[clientId].total_gasto += parseFloat(order.valor_total || 0)
      const orderDate = new Date(order.created_at)
      if (!clientMap[clientId].ultima_compra || orderDate > clientMap[clientId].ultima_compra) {
        clientMap[clientId].ultima_compra = orderDate
      }
    })

    const sorted = Object.values(clientMap)
      .map(c => ({
        ...c,
        ultima_compra: c.ultima_compra ? c.ultima_compra.toLocaleDateString('pt-BR') : '-'
      }))
      .sort((a, b) => b.total_gasto - a.total_gasto)
      .slice(0, 100)

    setData(sorted)
  }

  const loadAniversariantesReport = async () => {
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    
    // Buscar todos os clientes com aniversário
    const { data, error } = await supabase
      .from('clients')
      .select('nome, telefone, aniversario')
      .eq('role', 'cliente')
      .not('aniversario', 'is', null)

    if (error) {
      console.error('Erro aniversariantes:', error)
      setData([])
      return
    }

    if (!data || data.length === 0) {
      console.log('Nenhum cliente com aniversário cadastrado')
      setData([])
      return
    }

    // Filtrar no JS pois aniversario é DATE - filtrar pelo mês atual
    const filtered = data.filter(client => {
      if (!client.aniversario) return false
      try {
        const month = parseInt(client.aniversario.split('-')[1])
        return month === currentMonth
      } catch (e) {
        console.warn('Erro ao processar aniversário:', client.aniversario)
        return false
      }
    })

    setData(filtered.map(c => ({
      nome: c.nome || '-',
      telefone: c.telefone || '-',
      aniversario: c.aniversario ? new Date(c.aniversario + 'T12:00:00').toLocaleDateString('pt-BR') : '-'
    })))
  }

  const loadValesReport = async () => {
    // Buscar vales da tabela gift_cards (criada na tela de marketing) com filtro de data
    const startDate = new Date(dateRange.start)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(dateRange.end)
    endDate.setHours(23, 59, 59, 999)
    
    const { data, error } = await supabase
      .from('gift_cards')
      .select('codigo, valor_original, saldo_atual, cliente_nome, cliente_id, ativo, data_validade, created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar vales:', error)
      setData([])
      return
    }

    if (!data || data.length === 0) {
      console.log('Nenhum vale encontrado')
      setData([])
      return
    }

    // Se houver cliente_id, buscar nome do cliente
    const clientIds = data.filter(v => v.cliente_id).map(v => v.cliente_id)
    let clientNames = {}
    
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, nome')
        .in('id', clientIds)
      
      if (clients) {
        clients.forEach(c => {
          clientNames[c.id] = c.nome
        })
      }
    }

    setData(data.map(v => ({
      codigo: v.codigo || '-',
      cliente: v.cliente_nome || clientNames[v.cliente_id] || '-',
      valor_original: v.valor_original || 0,
      saldo_atual: v.saldo_atual || 0,
      status: v.ativo ? 'Ativo' : 'Inativo',
      validade: v.data_validade ? new Date(v.data_validade).toLocaleDateString('pt-BR') : '-',
      criado_em: v.created_at ? new Date(v.created_at).toLocaleDateString('pt-BR') : '-'
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
              {activeReport === 'produtos' && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  O ranking mostra produtos com pedidos pagos. Verifique se há pedidos com status "pago".
                </p>
              )}
              {activeReport === 'clientes' && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  O ranking mostra clientes com pedidos pagos. Verifique se há pedidos com status "pago".
                </p>
              )}
              {activeReport === 'aniversariantes' && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Mostrando aniversariantes do mês atual. Verifique se os clientes têm data de aniversário cadastrada.
                </p>
              )}
              {activeReport === 'vales' && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Nenhum vale encontrado. Crie vales na tela de Marketing → Vale-Presente.
                </p>
              )}
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
    ultima_compra: 'Última Compra',
    nome: 'Nome',
    aniversario: 'Aniversário',
    codigo: 'Código',
    valor_original: 'Valor Original',
    saldo_atual: 'Saldo Atual',
    status: 'Status',
    validade: 'Validade',
    criado_em: 'Criado Em'
  }
  return headers[key] || key.charAt(0).toUpperCase() + key.slice(1)
}
