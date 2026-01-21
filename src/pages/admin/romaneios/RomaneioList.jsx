import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  FileText, 
  Download, 
  Printer,
  Eye,
  Search,
  FileSpreadsheet,
  MessageCircle,
  CheckCircle,
  Clock,
  DollarSign,
  ChevronDown,
  Filter
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './RomaneioList.css'

export default function RomaneioList() {
  const navigate = useNavigate()
  const [lots, setLots] = useState([])
  const [selectedLot, setSelectedLot] = useState(null)
  const [romaneios, setRomaneios] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingRomaneios, setLoadingRomaneios] = useState(false)
  const [statusFilter, setStatusFilter] = useState('todos')

  useEffect(() => {
    fetchLots()
  }, [])

  const fetchLots = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('*')
        .in('status', ['fechado', 'preparacao', 'pago', 'enviado', 'concluido'])
        .order('updated_at', { ascending: false })

      if (error) throw error
      setLots(data || [])
      
      // Selecionar o primeiro automaticamente
      if (data && data.length > 0) {
        fetchRomaneios(data[0].id)
        setSelectedLot(data[0])
      }
    } catch (error) {
      console.error('Erro ao carregar links:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRomaneios = async (lotId) => {
    setLoadingRomaneios(true)
    try {
      const { data, error } = await supabase
        .from('romaneios')
        .select(`
          *,
          client:clients(id, nome, telefone, email)
        `)
        .eq('lot_id', lotId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRomaneios(data || [])
    } catch (error) {
      console.error('Erro ao carregar romaneios:', error)
    } finally {
      setLoadingRomaneios(false)
    }
  }

  const handleSelectLot = (lot) => {
    setSelectedLot(lot)
    fetchRomaneios(lot.id)
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'pendente': { label: 'Pendente', class: 'status-pendente', icon: Clock },
      'aguardando': { label: 'Aguardando', class: 'status-aguardando', icon: Clock },
      'pago': { label: 'Pago', class: 'status-pago', icon: CheckCircle },
      'cancelado': { label: 'Cancelado', class: 'status-cancelado', icon: DollarSign },
    }
    return statusMap[status] || statusMap.pendente
  }

  const getLotStatusBadge = (status) => {
    const statusMap = {
      'fechado': { label: 'Fechado', class: 'badge-secondary' },
      'preparacao': { label: 'Em Preparação', class: 'badge-warning' },
      'pago': { label: 'Pago', class: 'badge-success' },
      'enviado': { label: 'Enviado', class: 'badge-primary' },
      'concluido': { label: 'Concluído', class: 'badge-success' },
    }
    return statusMap[status] || { label: status, class: 'badge-secondary' }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const openWhatsApp = (romaneio) => {
    if (!romaneio.client?.telefone) return
    
    const phone = romaneio.client.telefone.replace(/\D/g, '')
    const message = encodeURIComponent(
      `Olá ${romaneio.client.nome}! 🌟\n\n` +
      `Seu romaneio do *${selectedLot?.nome}* está pronto!\n\n` +
      `📋 Pedido: ${romaneio.numero_pedido}\n` +
      `💰 Valor Total: R$ ${romaneio.valor_total?.toFixed(2)}\n\n` +
      `Por favor, realize o pagamento conforme os dados do romaneio.\n\n` +
      `Qualquer dúvida, estamos à disposição! 💎`
    )
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
  }

  const filteredRomaneios = romaneios.filter(r => {
    if (statusFilter === 'todos') return true
    return r.status_pagamento === statusFilter
  })

  // Calcular estatísticas
  const stats = {
    total: romaneios.length,
    pagos: romaneios.filter(r => r.status_pagamento === 'pago').length,
    aguardando: romaneios.filter(r => r.status_pagamento === 'aguardando').length,
    valorTotal: romaneios.reduce((sum, r) => sum + (r.valor_total || 0), 0),
    valorPago: romaneios.filter(r => r.status_pagamento === 'pago').reduce((sum, r) => sum + (r.valor_total || 0), 0)
  }

  return (
    <div className="romaneio-page">
      <div className="page-header">
        <h1><FileText size={24} /> Romaneios</h1>
        <p className="page-subtitle">Gerencie os romaneios gerados após o fechamento dos links</p>
      </div>

      <div className="romaneio-layout">
        {/* Sidebar: Lista de Links */}
        <div className="romaneio-sidebar">
          <div className="sidebar-header">
            <h3>Links Fechados</h3>
          </div>
          <div className="sidebar-content">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner" />
              </div>
            ) : lots.length === 0 ? (
              <div className="empty-state-sm">
                <p>Nenhum link fechado</p>
              </div>
            ) : (
              <ul className="lot-list">
                {lots.map(lot => {
                  const statusBadge = getLotStatusBadge(lot.status)
                  return (
                    <li 
                      key={lot.id}
                      className={`lot-item ${selectedLot?.id === lot.id ? 'active' : ''}`}
                      onClick={() => handleSelectLot(lot)}
                    >
                      <div className="lot-item-info">
                        <strong>{lot.nome}</strong>
                        <span className={`badge ${statusBadge.class}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                      <small>{formatDate(lot.updated_at)}</small>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="romaneio-content">
          {!selectedLot ? (
            <div className="empty-state">
              <FileText size={48} />
              <h3>Selecione um link</h3>
              <p>Clique em um link na lista para visualizar os romaneios</p>
            </div>
          ) : (
            <>
              {/* Header do Link */}
              <div className="content-header">
                <div>
                  <h2>{selectedLot.nome}</h2>
                  <span className="text-secondary">
                    {stats.total} romaneio(s) | {stats.pagos} pago(s)
                  </span>
                </div>
                <div className="header-stats">
                  <div className="stat-mini">
                    <span className="stat-label">Total</span>
                    <span className="stat-value">R$ {stats.valorTotal.toFixed(2)}</span>
                  </div>
                  <div className="stat-mini stat-success">
                    <span className="stat-label">Recebido</span>
                    <span className="stat-value">R$ {stats.valorPago.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <div className="content-filters">
                <select 
                  className="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="todos">Todos os status</option>
                  <option value="aguardando">⏳ Aguardando Pagamento</option>
                  <option value="pago">✅ Pago</option>
                  <option value="pendente">⚪ Pendente</option>
                </select>
              </div>

              {/* Lista de Romaneios */}
              {loadingRomaneios ? (
                <div className="loading-state">
                  <div className="loading-spinner" />
                </div>
              ) : filteredRomaneios.length === 0 ? (
                <div className="empty-state">
                  <FileText size={48} />
                  <h3>Nenhum romaneio encontrado</h3>
                  <p>Não há romaneios gerados para este link ou com o filtro selecionado</p>
                </div>
              ) : (
                <div className="romaneios-grid">
                  {filteredRomaneios.map(romaneio => {
                    const statusBadge = getStatusBadge(romaneio.status_pagamento)
                    const StatusIcon = statusBadge.icon
                    
                    return (
                      <div key={romaneio.id} className="romaneio-card">
                        <div className="romaneio-card-header">
                          <div className="client-info">
                            <h4>{romaneio.client?.nome || 'Cliente'}</h4>
                            <span>{romaneio.client?.telefone}</span>
                          </div>
                          <span className={`status-badge ${statusBadge.class}`}>
                            <StatusIcon size={14} />
                            {statusBadge.label}
                          </span>
                        </div>
                        
                        <div className="romaneio-card-body">
                          <div className="info-row">
                            <span className="label">Pedido:</span>
                            <span className="value">{romaneio.numero_pedido || romaneio.numero_romaneio}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Itens:</span>
                            <span className="value">{romaneio.quantidade_itens || 0}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Produtos:</span>
                            <span className="value">R$ {(romaneio.valor_produtos || 0).toFixed(2)}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Taxa:</span>
                            <span className="value">R$ {(romaneio.taxa_separacao || 0).toFixed(2)}</span>
                          </div>
                          <div className="info-row total">
                            <span className="label">Total:</span>
                            <span className="value">R$ {(romaneio.valor_total || 0).toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="romaneio-card-footer">
                          <button 
                            className="btn btn-sm btn-outline"
                            onClick={() => openWhatsApp(romaneio)}
                          >
                            <MessageCircle size={14} />
                          </button>
                          <Link 
                            to={`/admin/romaneios/${romaneio.id}`}
                            className="btn btn-sm btn-primary"
                          >
                            <Eye size={14} /> Ver
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
