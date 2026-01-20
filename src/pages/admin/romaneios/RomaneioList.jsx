import { useState, useEffect } from 'react'
import { 
  FileText, 
  Download, 
  Printer,
  Eye,
  Search,
  FileSpreadsheet
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './RomaneioList.css'

export default function RomaneioList() {
  const [lots, setLots] = useState([])
  const [selectedLot, setSelectedLot] = useState(null)
  const [romaneioData, setRomaneioData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLots()
  }, [])

  const fetchLots = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('*')
        .in('status', ['fechado', 'preparacao', 'pago', 'enviado', 'concluido'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setLots(data || [])
    } catch (error) {
      console.error('Erro ao carregar lotes:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateRomaneio = async (lotId) => {
    try {
      // Buscar pedidos agrupados por cliente
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(id, nome, telefone, enderecos),
          product:products(id, nome, preco)
        `)
        .eq('lot_id', lotId)
        .order('client_id')

      if (error) throw error

      // Agrupar por cliente
      const grouped = data.reduce((acc, order) => {
        const clientId = order.client_id
        if (!acc[clientId]) {
          acc[clientId] = {
            client: order.client,
            items: [],
            total: 0
          }
        }
        acc[clientId].items.push({
          product: order.product,
          quantidade: order.quantidade,
          valor: order.valor_total
        })
        acc[clientId].total += order.valor_total
        return acc
      }, {})

      setRomaneioData(Object.values(grouped))
      setSelectedLot(lots.find(l => l.id === lotId))
    } catch (error) {
      console.error('Erro ao gerar romaneio:', error)
    }
  }

  const exportToCSV = () => {
    if (romaneioData.length === 0) return

    let csv = 'Cliente,Telefone,Produto,Quantidade,Valor\n'
    
    romaneioData.forEach(item => {
      item.items.forEach(i => {
        csv += `"${item.client?.nome}","${item.client?.telefone}","${i.product?.nome}",${i.quantidade},${i.valor}\n`
      })
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `romaneio_${selectedLot?.nome || 'lote'}.csv`
    link.click()
  }

  const printRomaneio = () => {
    window.print()
  }

  return (
    <div className="romaneio-page">
      <div className="page-header">
        <h1><FileText size={24} /> Romaneios</h1>
      </div>

      <div className="romaneio-layout">
        {/* Lista de Lotes */}
        <div className="romaneio-sidebar">
          <div className="card">
            <div className="card-header">
              <h3>Lotes Fechados</h3>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center">
                  <div className="loading-spinner" />
                </div>
              ) : lots.length === 0 ? (
                <p className="text-muted text-center">Nenhum lote fechado</p>
              ) : (
                <ul className="lot-list">
                  {lots.map(lot => (
                    <li 
                      key={lot.id}
                      className={`lot-item ${selectedLot?.id === lot.id ? 'active' : ''}`}
                      onClick={() => generateRomaneio(lot.id)}
                    >
                      <div className="lot-item-info">
                        <strong>{lot.nome}</strong>
                        <span className={`badge badge-${getStatusClass(lot.status)}`}>
                          {lot.status}
                        </span>
                      </div>
                      <small className="text-muted">
                        {new Date(lot.created_at).toLocaleDateString('pt-BR')}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Romaneio Preview */}
        <div className="romaneio-content">
          {!selectedLot ? (
            <div className="card">
              <div className="card-body text-center">
                <FileText size={48} className="text-muted" style={{ marginBottom: 16 }} />
                <h3>Selecione um lote</h3>
                <p className="text-muted">Clique em um lote para gerar o romaneio</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header romaneio-header">
                <div>
                  <h3>Romaneio: {selectedLot.nome}</h3>
                  <small className="text-muted">
                    {romaneioData.length} cliente(s) | {romaneioData.reduce((sum, r) => sum + r.items.length, 0)} item(s)
                  </small>
                </div>
                <div className="romaneio-actions">
                  <button className="btn btn-outline btn-sm" onClick={exportToCSV}>
                    <FileSpreadsheet size={16} /> Exportar CSV
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={printRomaneio}>
                    <Printer size={16} /> Imprimir
                  </button>
                </div>
              </div>
              
              <div className="card-body romaneio-body" id="romaneio-print">
                {romaneioData.length === 0 ? (
                  <p className="text-muted text-center">Nenhum pedido neste lote</p>
                ) : (
                  romaneioData.map((clientData, idx) => (
                    <div key={idx} className="romaneio-client-card">
                      <div className="romaneio-client-header">
                        <div>
                          <h4>{clientData.client?.nome}</h4>
                          <small>{clientData.client?.telefone}</small>
                        </div>
                        <div className="romaneio-client-total">
                          <strong>Total: R$ {clientData.total.toFixed(2)}</strong>
                        </div>
                      </div>
                      
                      <table className="romaneio-items-table">
                        <thead>
                          <tr>
                            <th>Produto</th>
                            <th>Qtd</th>
                            <th>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientData.items.map((item, itemIdx) => (
                            <tr key={itemIdx}>
                              <td>{item.product?.nome}</td>
                              <td>{item.quantidade}</td>
                              <td>R$ {item.valor.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getStatusClass(status) {
  const classes = {
    fechado: 'secondary',
    preparacao: 'warning',
    pago: 'success',
    enviado: 'primary',
    concluido: 'success'
  }
  return classes[status] || 'secondary'
}
