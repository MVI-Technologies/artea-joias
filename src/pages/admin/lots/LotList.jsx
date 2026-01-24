import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Bell, ChevronDown, Copy, ExternalLink, Link as LinkIcon, MoreVertical, Edit, Lock, FileText, Package, Scissors, X, Settings, AlertTriangle, CheckCircle, MessageSquare, Clock } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { notifyCatalogClosed } from '../../../services/whatsapp'
import './LotList.css'

export default function LotList() {
  const navigate = useNavigate()
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [openDropdown, setOpenDropdown] = useState(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const dropdownBtnRef = useRef(null)
  
  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(null) // { type: 'fechar' | 'duplicar', lot: object }
  const [showConfigModal, setShowConfigModal] = useState(null) // lot object
  const [configData, setConfigData] = useState({})
  const [notifyOnClose, setNotifyOnClose] = useState(true)
  const [processing, setProcessing] = useState(false)
  
  // Toast state
  const [toast, setToast] = useState(null)

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    fetchLots()
  }, [])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!openDropdown) return
    
    const handleClickOutside = (event) => {
      const container = event.target.closest('.dropdown-container')
      if (!container) {
        setOpenDropdown(null)
      }
    }
    
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 10)
    
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdown])

  const fetchLots = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select(`
          *,
          lot_products:lot_products(count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      console.log('DEBUG LOTS DATA:', data) // Debug solicitado
      setLots(data || [])
    } catch (error) {
      console.error('Erro ao carregar grupos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    // Garantir string
    const raw = String(status || '')
    // Remover tudo que não é letra/número para chave (ex: ' fechado ' -> 'fechado')
    const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    const statusMap = {
      'aberto': { label: 'Aberto', class: 'badge-green' },
      'open': { label: 'Aberto', class: 'badge-green' },
      'fechado': { label: 'Fechado', class: 'badge-red' },
      'closed': { label: 'Fechado', class: 'badge-red' },
      'preparacao': { label: 'Em preparação', class: 'badge-orange' },
      'pago': { label: 'Pago', class: 'badge-blue' },
      'enviado': { label: 'Enviado', class: 'badge-purple' },
      'concluido': { label: 'Concluído', class: 'badge-gray' },
      'cancelado': { label: 'Cancelado', class: 'badge-red' },
    }
    
    // Se a chave processada bater com o mapa, retorna
    if (statusMap[key]) return statusMap[key]
    
    // Fallback Inteligente
    if (!key || key === 'null' || key === 'undefined') return { label: 'Aberto', class: 'badge-green' }
    
    // Se tem valor mas não mapeou, mostra cinza
    return { label: raw, class: 'badge-gray' } 
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('pt-BR')
  }


  const handleAction = (action, lot) => {
    setOpenDropdown(null)
    
    switch (action) {
      case 'editar':
        navigate(`/admin/lotes/${lot.id}/editar`)
        break
      case 'privacidade':
        setShowConfigModal(lot)
        setConfigData(lot)
        break
      case 'duplicar':
        setShowConfirmModal({ type: 'duplicar', lot })
        break
      case 'relatorio':
        navigate(`/admin/relatorios?lotId=${lot.id}&type=produtos`)
        break
      case 'romaneios':
        navigate(`/admin/romaneios?lot=${lot.id}`)
        break
      case 'separacao':
        navigate(`/admin/separacao?lot=${lot.id}`)
        break
      default:
        break
    }
  }

  const openConfigModal = (lot) => {
    setShowConfigModal(lot)
    setConfigData({
      nome: lot.nome || '',
      descricao: lot.descricao || '',
      data_fim: lot.data_fim || '',
      taxa_separacao: lot.taxa_separacao || 0,
      requer_pacote_fechado: lot.requer_pacote_fechado || false,
      chave_pix: lot.chave_pix || '',
      nome_beneficiario: lot.nome_beneficiario || '',
      mensagem_pagamento: lot.mensagem_pagamento || '',
      telefone_financeiro: lot.telefone_financeiro || ''
    })
  }

  const saveConfig = async () => {
    setProcessing(true)
    try {
      const { error } = await supabase
        .from('lots')
        .update(configData)
        .eq('id', showConfigModal.id)

      if (error) throw error

      setShowConfigModal(null)
      fetchLots()
      showToast('success', 'Configurações salvas com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar:', error)
      showToast('error', 'Erro ao salvar configurações')
    } finally {
      setProcessing(false)
    }
  }

  const closeLot = async () => {
    setShowConfirmModal(null)
    setProcessing(true)
    
    try {
      const { error } = await supabase
        .from('lots')
        .update({ status: 'fechado' })
        .eq('id', showConfirmModal.lot.id)

      if (error) throw error

      // Enviar notificação se marcado
      if (notifyOnClose) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, nome, telefone')
          .eq('role', 'cliente')
          .not('telefone', 'is', null)
        
        if (clients && clients.length > 0) {
          await notifyCatalogClosed(showConfirmModal.lot, clients)
        }
      }

      fetchLots()
      showToast('success', 'Grupo fechado com sucesso!')
    } catch (error) {
      console.error('Erro ao fechar:', error)
      showToast('error', 'Erro ao fechar grupo')
    } finally {
      setProcessing(false)
    }
  }

  const duplicateLot = async () => {
    setShowConfirmModal(null)
    setProcessing(true)
    
    try {
      const newLot = {
        nome: `${showConfirmModal.lot.nome} (cópia)`,
        descricao: showConfirmModal.lot.descricao,
        status: 'aberto',
        link_compra: `grupo-${Date.now()}`
      }
      
      const { data, error } = await supabase
        .from('lots')
        .insert(newLot)
        .select()
        .single()
      
      if (error) throw error

      fetchLots()
      showToast('success', 'Grupo duplicado com sucesso!')
      navigate(`/admin/lotes/${data.id}`)
    } catch (error) {
      console.error('Erro ao duplicar:', error)
      showToast('error', 'Erro ao duplicar grupo')
    } finally {
      setProcessing(false)
    }
  }

  const filteredLots = lots.filter(lot => {
    const matchSearch = lot.nome?.toLowerCase().includes(search.toLowerCase())
    const s = (lot.status || '').toLowerCase()
    const matchStatus = statusFilter === 'todos' || s === statusFilter
    return matchSearch && matchStatus
  })

  // Separar "Minha Loja - Pronta Entrega" no topo
  const prontaEntrega = filteredLots.find(l => l.nome?.includes('Pronta Entrega'))
  const regularLots = filteredLots.filter(l => !l.nome?.includes('Pronta Entrega'))

  if (loading) {
    return <div className="page-container"><div className="loading-spinner" style={{ margin: '40px auto' }} /></div>
  }

  return (
    <div className="page-container grupo-compras-page">
      {/* Barra de busca e filtros */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-box">
             {/* ... search input ... */}
             <input 
               type="text" 
               placeholder="Buscar nome" 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
             />
             <Search size={16} className="search-icon" />
          </div>
        </div>
        <div className="toolbar-right">
          <select 
            className="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="todos">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="fechado">Fechado</option>
            <option value="preparacao">Em preparação</option>
            <option value="pago">Pago</option>
            <option value="enviado">Enviado</option>
          </select>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="action-buttons">
         {/* ... buttons ... */}
         <button className="btn btn-primary" onClick={() => navigate('/admin/lotes/novo')}>
           <Plus size={16} /> Catálogo
         </button>
         <button className="btn btn-dark">
           Notificações
         </button>
         <button className="btn btn-dark dropdown-toggle">
           Ações <ChevronDown size={14} />
         </button>
      </div>

      {/* Tabela de grupos */}
      <div className="table-container">
        <table className="grupos-table">
          <thead>
            <tr>
              <th className="col-nome text-white">Nome</th>
              <th className="col-status text-white">Status</th>
              <th className="col-data text-white">Data início</th>
              <th className="col-data text-white">Encerramento</th>
              <th className="col-acoes text-white">Ações</th>
            </tr>
          </thead>
          <tbody>
            {/* Linha destaque - Pronta Entrega */}
            {prontaEntrega && (
              <tr className="row-highlight">
                <td className="col-nome">
                  <span className="nome-text">{prontaEntrega.nome}</span>
                </td>
                <td className="col-status">
                   <span className="status-badge badge-green">Aberto</span>
                </td>
                <td className="col-data"></td>
                <td className="col-data"></td>
                <td className="col-acoes">
                  <div className="acoes-buttons">
                    <Link to={`/admin/lotes/${prontaEntrega.id}`} className="btn-action btn-produtos">
                      Produtos
                    </Link>
                    <Link to={`/admin/romaneios?lot=${prontaEntrega.id}`} className="btn-action btn-romaneios">Romaneios</Link>
                    <Link to={`/admin/separacao?lot=${prontaEntrega.id}`} className="btn-action btn-separacao">Separação</Link>
                    <div className="dropdown-container">
                      <button 
                        type="button"
                        className="btn-action btn-acoes"
                        onClick={(e) => {
                          if (openDropdown === prontaEntrega.id) {
                            setOpenDropdown(null)
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setDropdownPos({ top: rect.bottom + 4, left: rect.right - 180 })
                            setOpenDropdown(prontaEntrega.id)
                          }
                        }}
                      >
                        Ações <ChevronDown size={12} />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {/* Lotes regulares */}
            {regularLots.map((lot) => {
              const badgeInfo = getStatusBadge(lot.status)
              return (
                <tr key={lot.id} className="row-regular">
                  <td className="col-nome">
                    <span className="nome-text">{lot.nome}</span>
                  </td>
                  <td className="col-status">
                    <span className={`status-badge ${badgeInfo.class}`}>
                      {badgeInfo.label}
                    </span>
                  </td>
                  <td className="col-data">{formatDate(lot.created_at)}</td>
                  <td className="col-data">{formatDate(lot.data_fim)}</td>
                  <td className="col-acoes">
                    <div className="acoes-buttons">
                      <Link to={`/admin/lotes/${lot.id}`} className="btn-action btn-produtos">
                        Produtos
                      </Link>
                      <Link to={`/admin/romaneios?lot=${lot.id}`} className="btn-action btn-romaneios">Romaneios</Link>
                      <Link to={`/admin/separacao?lot=${lot.id}`} className="btn-action btn-separacao">Separação</Link>
                      <div className="dropdown-container">
                        <button 
                          type="button"
                          className="btn-action btn-acoes"
                          onClick={(e) => {
                             if (openDropdown === lot.id) {
                               setOpenDropdown(null)
                             } else {
                               const rect = e.currentTarget.getBoundingClientRect()
                               setDropdownPos({ top: rect.bottom + 4, left: rect.right - 180 })
                               setOpenDropdown(lot.id)
                             }
                          }}
                        >
                          Ações <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}

            {filteredLots.length === 0 && (
              <tr>
                <td colSpan="5" className="empty-message">
                  Nenhum grupo de compras encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="pagination">
        Página 1 / 1 - {filteredLots.length} resultados
      </div>

      {/* Modal de Confirmação */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => !processing && setShowConfirmModal(null)}>
          <div className="modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-confirm-header">
              {showConfirmModal.type === 'fechar' ? (
                <Lock size={24} className="icon-warning" />
              ) : (
                <Copy size={24} className="icon-info" />
              )}
              <h3>
                {showConfirmModal.type === 'fechar' ? 'Fechar Grupo' : 'Duplicar Grupo'}
              </h3>
            </div>
            
            <div className="modal-confirm-body">
              {showConfirmModal.type === 'fechar' ? (
                <>
                  <p>Tem certeza que deseja fechar o grupo <strong>"{showConfirmModal.lot?.nome}"</strong>?</p>
                  <p className="text-muted">Isso impedirá novas reservas neste grupo.</p>
                  
                  <label className="checkbox-notify">
                    <input
                      type="checkbox"
                      checked={notifyOnClose}
                      onChange={(e) => setNotifyOnClose(e.target.checked)}
                    />
                    <MessageSquare size={16} />
                    <span>Enviar notificação WhatsApp para os clientes</span>
                  </label>
                </>
              ) : (
                <>
                  <p>Deseja duplicar o grupo <strong>"{showConfirmModal.lot?.nome}"</strong>?</p>
                  <p className="text-muted">Será criada uma cópia com todos os produtos.</p>
                </>
              )}
            </div>
            
            <div className="modal-confirm-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowConfirmModal(null)}
                disabled={processing}
              >
                Cancelar
              </button>
              <button 
                className={`btn ${showConfirmModal.type === 'fechar' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => showConfirmModal.type === 'fechar' ? closeLot() : duplicateLot()}
                disabled={processing}
              >
                {processing ? 'Processando...' : showConfirmModal.type === 'fechar' ? 'Fechar Grupo' : 'Duplicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configurações */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={() => !processing && setShowConfigModal(null)}>
          <div className="modal-config-light" onClick={(e) => e.stopPropagation()}>
            <div className="modal-config-header-light">
              <h3><Settings size={20} /> Configurações do Link</h3>
              <button className="btn-close-light" onClick={() => setShowConfigModal(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-config-body-light">
              {/* Seção: Informações Básicas */}
              <div className="config-section">
                <h4 className="section-title">
                  <FileText size={16} /> INFORMAÇÕES BÁSICAS
                </h4>
                
                <div className="form-group-light">
                  <label>Nome do Link</label>
                  <input
                    type="text"
                    value={configData.nome}
                    onChange={(e) => setConfigData({ ...configData, nome: e.target.value })}
                    placeholder="Ex: LINK 502 - Novidades"
                  />
                </div>
                
                <div className="form-group-light">
                  <label>Descrição</label>
                  <textarea
                    value={configData.descricao}
                    onChange={(e) => setConfigData({ ...configData, descricao: e.target.value })}
                    rows={2}
                    placeholder="Descrição para os clientes..."
                  />
                </div>
              </div>

              {/* Seção: Regras e Prazos */}
              <div className="config-section">
                <h4 className="section-title">
                  <Clock size={16} /> REGRAS E PRAZOS
                </h4>
                
                <div className="form-row-light">
                  <div className="form-group-light">
                    <label>Data/Hora de Encerramento</label>
                    <input
                      type="datetime-local"
                      value={configData.data_fim ? new Date(configData.data_fim).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setConfigData({ ...configData, data_fim: e.target.value })}
                    />
                  </div>
                  <div className="form-group-light">
                    <label>Taxa de Separação (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={configData.taxa_separacao}
                      onChange={(e) => setConfigData({ ...configData, taxa_separacao: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="checkbox-section">
                  <label className="checkbox-wrapper-light">
                    <input
                      type="checkbox"
                      checked={configData.requer_pacote_fechado || false}
                      onChange={(e) => setConfigData({ ...configData, requer_pacote_fechado: e.target.checked })}
                    />
                    <span>Requer pacote fechado</span>
                  </label>
                  <p className="checkbox-hint-light">Só permite fechar quando todos os pacotes estiverem completos</p>
                </div>
              </div>

              {/* Seção: Dados de Pagamento */}
              <div className="config-section">
                <h4 className="section-title">
                  <FileText size={16} /> DADOS DE PAGAMENTO
                </h4>
                
                <div className="form-row-light">
                  <div className="form-group-light">
                    <label>Chave PIX</label>
                    <input
                      type="text"
                      value={configData.chave_pix}
                      onChange={(e) => setConfigData({ ...configData, chave_pix: e.target.value })}
                      placeholder="CNPJ, email ou telefone"
                    />
                  </div>
                  <div className="form-group-light">
                    <label>Nome do Beneficiário</label>
                    <input
                      type="text"
                      value={configData.nome_beneficiario}
                      onChange={(e) => setConfigData({ ...configData, nome_beneficiario: e.target.value })}
                      placeholder="Nome que aparece no PIX"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-config-footer-light">
              <button 
                className="btn-cancel-light" 
                onClick={() => setShowConfigModal(null)}
                disabled={processing}
              >
                Cancelar
              </button>
              <button 
                className="btn-save-light"
                onClick={saveConfig}
                disabled={processing}
              >
                {processing ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown Menu Fixo */}
      {openDropdown && (
        <div 
          className="dropdown-menu-fixed"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAction('editar', lots.find(l => l.id === openDropdown)); }}>
            <Edit size={14} /> Editar
          </button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAction('privacidade', lots.find(l => l.id === openDropdown)); }}>
            <Settings size={14} /> Privacidade
          </button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAction('duplicar', lots.find(l => l.id === openDropdown)); }}>
            <Copy size={14} /> Duplicar
          </button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAction('relatorio', lots.find(l => l.id === openDropdown)); }}>
            <FileText size={14} /> Relatório Produtos
          </button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAction('romaneios', lots.find(l => l.id === openDropdown)); }}>
            <Package size={14} /> Romaneios
          </button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAction('separacao', lots.find(l => l.id === openDropdown)); }}>
            <Scissors size={14} /> Separação
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          {toast.type === 'success' && <CheckCircle size={18} />}
          {toast.type === 'error' && <AlertTriangle size={18} />}
          {toast.type === 'warning' && <AlertTriangle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
