import { useState, useEffect } from 'react'
import { Plus, Search, ChevronDown, Copy, MoreVertical, Edit, Lock, FileText, Package, Scissors, X, Settings, AlertTriangle, CheckCircle, MessageSquare, Clock, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { notifyCatalogClosed, sendRomaneiosAutomaticamente } from '../../../services/whatsapp'
import './LotList.css'

export default function LotList() {
  const navigate = useNavigate()
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [openDropdown, setOpenDropdown] = useState(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(null) // { type: 'fechar' | 'duplicar' | 'excluir', lot: object }
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
      const dropdown = event.target.closest('.dropdown-menu-fixed')
      if (!container && !dropdown) {
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

  // Fechar dropdown ao fazer scroll
  useEffect(() => {
    if (!openDropdown) return

    const handleScroll = () => setOpenDropdown(null)
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [openDropdown])

  const fetchLots = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select(`*, lot_products:lot_products(count)`)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLots(data || [])
    } catch (error) {
      console.error('Erro ao carregar grupos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calcular posição do dropdown fixo
  const calculateDropdownPosition = (buttonRect) => {
    const dropdownWidth = 220
    const padding = 4

    const top = buttonRect.bottom + padding
    let left = buttonRect.right - dropdownWidth

    if (left < padding) left = padding

    const viewportWidth = window.innerWidth
    if (left + dropdownWidth > viewportWidth) {
      left = viewportWidth - dropdownWidth - padding
    }

    return { top, left }
  }

  const openDropdownFor = (e, id) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setDropdownPos(calculateDropdownPosition(rect))
    setOpenDropdown(id)
  }

  const getStatusBadge = (status) => {
    const raw = String(status || '')
    const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '')

    const statusMap = {
      'aberto': { label: 'Aberto', class: 'badge-green' },
      'open': { label: 'Aberto', class: 'badge-green' },
      'fechado': { label: 'Fechado', class: 'badge-red' },
      'closed': { label: 'Fechado', class: 'badge-red' },
      'preparacao': { label: 'Em preparação', class: 'badge-orange' },
      'empreparacao': { label: 'Em preparação', class: 'badge-orange' },
      'prontoeaberto': { label: 'Pronto e Aberto', class: 'badge-green' },
      'emfabricacao': { label: 'Em fabricação', class: 'badge-purple' },
      'fornecedorseparando': { label: 'Fornecedor separando', class: 'badge-orange' },
      'verificandoestoque': { label: 'Verificando Estoque', class: 'badge-blue' },
      'organizandovalores': { label: 'Organizando Valores', class: 'badge-purple' },
      'aguardandopagamentos': { label: 'Aguardando Pagamentos', class: 'badge-orange' },
      'emtransito': { label: 'Em Trânsito', class: 'badge-blue' },
      'emtransitointernacional': { label: 'Em Trânsito Internacional', class: 'badge-purple' },
      'emseparacao': { label: 'Em Separação', class: 'badge-orange' },
      'envioliberado': { label: 'Envio Liberado', class: 'badge-green' },
      'envioparcialliberado': { label: 'Envio Parcial Liberado', class: 'badge-yellow' },
      'fechadoebloqueado': { label: 'Fechado e Bloqueado', class: 'badge-red' },
      'pago': { label: 'Pago', class: 'badge-blue' },
      'enviado': { label: 'Enviado', class: 'badge-purple' },
      'concluido': { label: 'Concluído', class: 'badge-gray' },
      'finalizado': { label: 'Finalizado', class: 'badge-green' },
      'cancelado': { label: 'Cancelado', class: 'badge-red' },
    }

    if (statusMap[key]) return statusMap[key]
    if (!key || key === 'null' || key === 'undefined') return { label: 'Aberto', class: 'badge-green' }
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
      case 'excluir':
        setShowConfirmModal({ type: 'excluir', lot })
        break
      default:
        break
    }
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
      const { data: lotData, error: lotError } = await supabase
        .from('lots')
        .select('*')
        .eq('id', showConfirmModal.lot.id)
        .single()

      if (lotError) throw lotError

      const { error } = await supabase
        .from('lots')
        .update({ status: 'fechado' })
        .eq('id', showConfirmModal.lot.id)

      if (error) throw error

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

      if (lotData?.enviar_romaneio_automaticamente) {
        showToast('info', 'Enviando romaneios automaticamente...')
        try {
          const romaneiosResult = await sendRomaneiosAutomaticamente(supabase, showConfirmModal.lot.id, lotData)
          if (romaneiosResult.success) {
            showToast('success', `Romaneios enviados! ${romaneiosResult.sent} de ${romaneiosResult.total} enviado(s).`)
          } else {
            showToast('warning', `Envio parcial: ${romaneiosResult.errors} erro(s).`)
          }
        } catch (e) {
          console.error(e)
          showToast('warning', 'Erro ao enviar romaneios automaticamente.')
        }
      }

      fetchLots()
      if (!lotData?.enviar_romaneio_automaticamente) {
        showToast('success', 'Grupo fechado com sucesso!')
      }
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

  const deleteLot = async () => {
    setShowConfirmModal(null)
    setProcessing(true)

    try {
      const { error } = await supabase
        .from('lots')
        .delete()
        .eq('id', showConfirmModal.lot.id)

      if (error) throw error

      fetchLots()
      showToast('success', 'Grupo excluído com sucesso!')
    } catch (error) {
      console.error('Erro ao excluir:', error)
      showToast('error', 'Erro ao excluir o grupo. Tente novamente.')
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

  if (loading) {
    return <div className="page-container"><div className="loading-spinner" style={{ margin: '40px auto' }} /></div>
  }

  // Encontrar o lote aberto no dropdown
  const activeLot = openDropdown && openDropdown !== 'toolbar'
    ? lots.find(l => l.id === openDropdown)
    : null

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
          </select>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="action-buttons">
        <button className="btn btn-primary" onClick={() => navigate('/admin/lotes/novo')}>
          <Plus size={16} /> Catálogo
        </button>

        <div className="dropdown-container">
          <button
            type="button"
            className="btn btn-dark"
            onClick={(e) => {
              if (openDropdown === 'toolbar') {
                setOpenDropdown(null)
              } else {
                openDropdownFor(e, 'toolbar')
              }
            }}
          >
            <Settings size={16} /> Ações Gerais <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Desktop: Tabela de grupos */}
      <div className="table-container hide-mobile">
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
            {filteredLots.map((lot) => {
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
                              openDropdownFor(e, lot.id)
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

      {/* Mobile: Cards */}
      <div className="show-mobile mobile-lots-container">
        {filteredLots.map((lot) => {
          const badgeInfo = getStatusBadge(lot.status)
          return (
            <div key={lot.id} className="mobile-card">
              <div className="mobile-card-header">
                <div className="mobile-card-title-row">
                  <span className="mobile-card-title">{lot.nome}</span>
                  <span className={`status-badge ${badgeInfo.class}`}>
                    {badgeInfo.label}
                  </span>
                </div>
                {lot.data_fim && (
                  <span className="mobile-card-deadline">
                    <Clock size={12} /> Encerra: {formatDate(lot.data_fim)}
                  </span>
                )}
              </div>
              <div className="mobile-card-actions">
                <Link to={`/admin/lotes/${lot.id}`} className="btn-action btn-produtos">
                  Produtos
                </Link>
                <Link to={`/admin/romaneios?lot=${lot.id}`} className="btn-action btn-romaneios">
                  Romaneios
                </Link>
                <button
                  className="btn-action btn-acoes"
                  onClick={(e) => openDropdownFor(e, lot.id)}
                >
                  <MoreVertical size={14} /> Ações
                </button>
              </div>
            </div>
          )
        })}

        {filteredLots.length === 0 && (
          <div className="mobile-empty-state">
            <AlertTriangle size={32} />
            <p>Nenhum grupo de compras encontrado</p>
          </div>
        )}
      </div>

      {/* Paginação */}
      <div className="pagination">
        Página 1 / 1 - {filteredLots.length} resultados
      </div>

      {/* Dropdown Menu Fixo - renderizado UMA VEZ fora da tabela */}
      {openDropdown && (
        <div
          className="dropdown-menu-fixed"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          <button
            className="dropdown-close-btn-top-right"
            onMouseDown={(e) => { e.preventDefault(); setOpenDropdown(null) }}
            aria-label="Fechar menu"
          >
            <X size={10} />
          </button>
          {openDropdown === 'toolbar' ? (
            <div className="dropdown-content-scrollable">
              <div className="dropdown-section">
                <span className="dropdown-header">GESTÃO</span>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); navigate('/admin/lotes/novo') }}>
                  <Plus size={14} /> Novo Catálogo
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); navigate('/admin/categorias') }}>
                  <Settings size={14} /> Configurações Gerais
                </button>
              </div>
              <div className="dropdown-section">
                <span className="dropdown-header">OPERAÇÃO</span>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); navigate('/admin/romaneios') }}>
                  <Package size={14} /> Romaneios
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); navigate('/admin/separacao') }}>
                  <Scissors size={14} /> Separação
                </button>
              </div>
              <div className="dropdown-section">
                <span className="dropdown-header">RELATÓRIOS</span>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); navigate('/admin/relatorios?type=produtos') }}>
                  <FileText size={14} /> Relatório Produtos
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); navigate('/admin/relatorios?type=financeiro') }}>
                  <Clock size={14} /> Relatório Financeiro
                </button>
              </div>
            </div>
          ) : activeLot ? (
            <>
              <div className="dropdown-catalog-header">
                {activeLot.nome || 'Catálogo'}
              </div>
              <div className="dropdown-content-scrollable">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAction('editar', activeLot) }}>
                  <Edit size={14} /> Editar
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAction('privacidade', activeLot) }}>
                  <Settings size={14} /> Privacidade
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAction('duplicar', activeLot) }}>
                  <Copy size={14} /> Duplicar
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAction('relatorio', activeLot) }}>
                  <FileText size={14} /> Relatório Produtos
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAction('romaneios', activeLot) }}>
                  <Package size={14} /> Romaneios
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAction('separacao', activeLot) }}>
                  <Scissors size={14} /> Separação
                </button>
                <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }}></div>
                <button type="button" style={{ color: '#ef4444' }} onMouseDown={(e) => { e.preventDefault(); handleAction('excluir', activeLot) }}>
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Modal de Confirmação */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => !processing && setShowConfirmModal(null)}>
          <div className="modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-confirm-header">
              {showConfirmModal.type === 'fechar' ? (
                <Lock size={24} className="icon-warning" />
              ) : showConfirmModal.type === 'excluir' ? (
                <Trash2 size={24} style={{ color: '#ef4444' }} />
              ) : (
                <Copy size={24} className="icon-info" />
              )}
              <h3>
                {showConfirmModal.type === 'fechar' ? 'Fechar Grupo'
                  : showConfirmModal.type === 'excluir' ? 'Excluir Grupo'
                  : 'Duplicar Grupo'}
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
              ) : showConfirmModal.type === 'excluir' ? (
                <>
                  <p>Tem certeza que deseja excluir o grupo <strong>"{showConfirmModal.lot?.nome}"</strong>?</p>
                  <p className="text-muted" style={{ color: '#ef4444', fontWeight: 500 }}>Esta ação é permanente e não pode ser desfeita.</p>
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
                className={`btn ${showConfirmModal.type === 'fechar' || showConfirmModal.type === 'excluir' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => {
                  if (showConfirmModal.type === 'fechar') closeLot()
                  else if (showConfirmModal.type === 'excluir') deleteLot()
                  else duplicateLot()
                }}
                disabled={processing}
              >
                {processing ? 'Processando...'
                  : showConfirmModal.type === 'fechar' ? 'Fechar Grupo'
                  : showConfirmModal.type === 'excluir' ? 'Excluir Grupo'
                  : 'Duplicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configurações */}
      {showConfigModal && (
        <div className="modal-overlay-config" onClick={() => !processing && setShowConfigModal(null)}>
          <div className="modal-config-light" onClick={(e) => e.stopPropagation()}>
            <div className="modal-config-header-light">
              <h3><Settings size={20} /> Configurações do Link</h3>
              <button className="btn-close-light" onClick={() => setShowConfigModal(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-config-body-light">
              <div className="config-section">
                <h4 className="section-title"><FileText size={16} /> INFORMAÇÕES BÁSICAS</h4>
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
                    rows={4}
                    placeholder="Descrição para os clientes..."
                  />
                </div>
              </div>

              <div className="config-section">
                <h4 className="section-title"><Clock size={16} /> REGRAS E PRAZOS</h4>
                <div className="form-group-light">
                  <label>Data/Hora de Encerramento</label>
                  <input
                    type="datetime-local"
                    value={configData.data_fim ? (() => {
                      const d = new Date(configData.data_fim)
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                    })() : ''}
                    onChange={(e) => setConfigData({ ...configData, data_fim: e.target.value ? e.target.value + ':00' : null })}
                    onClick={(e) => e.target.showPicker()}
                    onKeyDown={(e) => e.preventDefault()}
                  />
                </div>
                <div className="form-row-light">
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
                </div>
              </div>

              <div className="config-section">
                <h4 className="section-title"><FileText size={16} /> DADOS DE PAGAMENTO</h4>
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
              <button className="btn-cancel-light" onClick={() => setShowConfigModal(null)} disabled={processing}>
                Cancelar
              </button>
              <button className="btn-save-light" onClick={saveConfig} disabled={processing}>
                {processing ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </div>
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
