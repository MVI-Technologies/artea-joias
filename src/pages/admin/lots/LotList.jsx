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
      setLots(data || [])
    } catch (error) {
      console.error('Erro ao carregar grupos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'aberto': { label: 'Aberto', class: 'badge-green' },
      'fechado': { label: 'Fechado', class: 'badge-red' },
      'preparacao': { label: 'Em preparação', class: 'badge-orange' },
      'pago': { label: 'Pago', class: 'badge-blue' },
      'enviado': { label: 'Enviado', class: 'badge-purple' },
      'concluido': { label: 'Concluído', class: 'badge-gray' },
      'cancelado': { label: 'Cancelado', class: 'badge-red' },
    }
    return statusMap[status] || { label: status || 'Aberto', class: 'badge-green' }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('pt-BR')
  }

  const handleAction = (action, lot) => {
    setOpenDropdown(null)
    switch (action) {
      case 'configuracoes':
        openConfigModal(lot)
        break
      case 'duplicar':
        setShowConfirmModal({ type: 'duplicar', lot })
        break
      case 'fechar':
        if (lot.status === 'fechado') {
          showToast('warning', 'Este grupo já está fechado!')
          return
        }
        setNotifyOnClose(true)
        setShowConfirmModal({ type: 'fechar', lot })
        break
      default:
        break
    }
  }

  const openConfigModal = async (lot) => {
    setConfigData({
      id: lot.id,
      nome: lot.nome || '',
      descricao: lot.descricao || '',
      data_fim: lot.data_fim || '',
      taxa_separacao: lot.taxa_separacao || 0,
      chave_pix: lot.chave_pix || '',
      nome_beneficiario: lot.nome_beneficiario || ''
    })
    setShowConfigModal(lot)
  }

  const saveConfig = async () => {
    setProcessing(true)
    try {
      const { error } = await supabase
        .from('lots')
        .update({
          nome: configData.nome,
          descricao: configData.descricao,
          data_fim: configData.data_fim || null,
          taxa_separacao: configData.taxa_separacao,
          chave_pix: configData.chave_pix,
          nome_beneficiario: configData.nome_beneficiario
        })
        .eq('id', configData.id)
      
      if (error) throw error
      
      showToast('success', 'Configurações salvas com sucesso!')
      setShowConfigModal(null)
      fetchLots()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      showToast('error', 'Erro ao salvar: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }

  const closeLot = async () => {
    const lot = showConfirmModal?.lot
    if (!lot) return
    
    setProcessing(true)
    try {
      const { error } = await supabase
        .from('lots')
        .update({ status: 'fechado' })
        .eq('id', lot.id)
      
      if (error) throw error
      
      showToast('success', 'Grupo fechado com sucesso!')
      
      // Enviar notificação WhatsApp se marcado
      if (notifyOnClose) {
        try {
          const { data: clients } = await supabase
            .from('clients')
            .select('id, nome, telefone')
            .eq('role', 'cliente')
            .not('telefone', 'is', null)
          
          if (clients && clients.length > 0) {
            const result = await notifyCatalogClosed(lot, clients)
            if (result.success) {
              showToast('success', `Notificação enviada para ${clients.length} cliente(s)!`)
            }
          }
        } catch (notifyError) {
          console.error('Erro ao notificar:', notifyError)
        }
      }
      
      fetchLots()
    } catch (error) {
      console.error('Erro ao fechar grupo:', error)
      showToast('error', 'Erro ao fechar: ' + error.message)
    } finally {
      setProcessing(false)
      setShowConfirmModal(null)
    }
  }

  const duplicateLot = async () => {
    const lot = showConfirmModal?.lot
    if (!lot) return
    
    setProcessing(true)
    try {
      const newLot = {
        nome: `${lot.nome} (cópia)`,
        descricao: lot.descricao,
        status: 'aberto',
        link_compra: `grupo-${Date.now()}`
      }
      
      const { data, error } = await supabase
        .from('lots')
        .insert(newLot)
        .select()
        .single()
      
      if (error) throw error
      
      // Copiar produtos do lote original
      const { data: lotProducts } = await supabase
        .from('lot_products')
        .select('product_id')
        .eq('lot_id', lot.id)
      
      if (lotProducts && lotProducts.length > 0) {
        const newLotProducts = lotProducts.map(lp => ({
          lot_id: data.id,
          product_id: lp.product_id,
          quantidade_pedidos: 0,
          quantidade_clientes: 0
        }))
        
        await supabase.from('lot_products').insert(newLotProducts)
      }
      
      showToast('success', 'Catálogo duplicado com sucesso!')
      fetchLots()
    } catch (error) {
      console.error('Erro ao duplicar:', error)
      showToast('error', 'Erro ao duplicar catálogo')
    } finally {
      setProcessing(false)
      setShowConfirmModal(null)
    }
  }

  const filteredLots = lots.filter(lot => {
    const matchSearch = lot.nome?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || lot.status === statusFilter
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
            <option value="concluido">Concluído</option>
          </select>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="action-buttons">
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
              const status = getStatusBadge(lot.status)
              return (
                <tr key={lot.id} className="row-regular">
                  <td className="col-nome">
                    <span className="nome-text">{lot.nome}</span>
                    <span className={`status-badge ${status.class}`}>
                      {status.label}
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
                <td colSpan="4" className="empty-message">
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
          <button type="button" onClick={() => handleAction('configuracoes', lots.find(l => l.id === openDropdown))}>
            <Settings size={14} /> Configurações
          </button>
          <button type="button" onClick={() => handleAction('duplicar', lots.find(l => l.id === openDropdown))}>
            <Copy size={14} /> Duplicar
          </button>
          <button type="button" onClick={() => handleAction('fechar', lots.find(l => l.id === openDropdown))}>
            <Lock size={14} /> Fechar Grupo
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
