import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Send,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  RefreshCw,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  User
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { sendWhatsAppMessage } from '../../../services/whatsapp'
import './WhatsApp.css'

export default function WhatsApp() {
  const [message, setMessage] = useState('')
  const [clients, setClients] = useState([])
  const [selectedClients, setSelectedClients] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 })
  const [filterDestination, setFilterDestination] = useState('todos')
  const [showClientList, setShowClientList] = useState(false)
  const [notification, setNotification] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)

  useEffect(() => {
    fetchClients()
    fetchHistory()
  }, [])

  const showNotification = (type, message) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const showConfirm = (message, onConfirm) => {
    setConfirmModal({ message, onConfirm })
  }

  const handleConfirm = () => {
    if (confirmModal?.onConfirm) {
      confirmModal.onConfirm()
    }
    setConfirmModal(null)
  }

  // Atualizar seleção quando muda o filtro
  useEffect(() => {
    const filtered = getFilteredClients()
    setSelectedClients(filtered.map(c => c.id))
  }, [filterDestination, clients])

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nome, telefone, approved')
        .eq('role', 'cliente')
        .not('telefone', 'is', null)
        .order('nome')

      if (error) throw error
      setClients(data || [])
      // Selecionar todos inicialmente
      setSelectedClients((data || []).map(c => c.id))
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
    }
  }

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setHistory(data || [])
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const deleteHistoryItem = (id) => {
    showConfirm('Apagar esta mensagem do histórico?', async () => {
      try {
        const { error } = await supabase
          .from('whatsapp_messages')
          .delete()
          .eq('id', id)

        if (error) throw error
        fetchHistory()
        showNotification('success', 'Mensagem removida do histórico')
      } catch (error) {
        console.error('Erro ao deletar:', error)
        showNotification('error', 'Erro ao deletar mensagem')
      }
    })
  }

  const clearAllHistory = () => {
    showConfirm('Apagar TODO o histórico de mensagens?', async () => {
      try {
        const { error } = await supabase
          .from('whatsapp_messages')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000')

        if (error) throw error
        fetchHistory()
        showNotification('success', 'Histórico limpo')
      } catch (error) {
        console.error('Erro ao limpar histórico:', error)
        showNotification('error', 'Erro ao limpar histórico')
      }
    })
  }

  const getFilteredClients = () => {
    switch (filterDestination) {
      case 'aprovados':
        return clients.filter(c => c.approved === true)
      case 'pendentes':
        return clients.filter(c => c.approved === false)
      case 'selecionados':
        return clients.filter(c => selectedClients.includes(c.id))
      default:
        return clients
    }
  }

  const toggleClientSelection = (clientId) => {
    setSelectedClients(prev => {
      if (prev.includes(clientId)) {
        return prev.filter(id => id !== clientId)
      } else {
        return [...prev, clientId]
      }
    })
    // Mudar para modo selecionados quando selecionar manualmente
    if (filterDestination !== 'selecionados') {
      setFilterDestination('selecionados')
    }
  }

  const selectAll = () => {
    setSelectedClients(clients.map(c => c.id))
  }

  const deselectAll = () => {
    setSelectedClients([])
  }

  const handleSendMessage = () => {
    if (!message.trim()) {
      showNotification('error', 'Por favor, digite uma mensagem.')
      return
    }

    const targetClients = filterDestination === 'selecionados'
      ? clients.filter(c => selectedClients.includes(c.id))
      : getFilteredClients()

    if (targetClients.length === 0) {
      showNotification('error', 'Nenhum cliente selecionado para envio.')
      return
    }

    showConfirm(`Enviar mensagem para ${targetClients.length} cliente(s)?\nIMPORTANTE: Mantenha esta janela aberta durante o envio.`, () => {
      executeSend(targetClients)
    })
  }

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  const executeSend = async (targetClients) => {
    setSending(true)
    setSendProgress({ current: 0, total: targetClients.length })

    // Criar registro da mensagem no histórico
    const { data: messageRecord, error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        message: message.trim(),
        destination_filter: filterDestination,
        total_recipients: targetClients.length,
        status: 'enviando'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Erro ao criar registro:', insertError)
    }

    let successCount = 0
    let errorCount = 0
    let errors = []

    // Processar envio um por um no frontend para evitar timeout e controlar delay
    for (let i = 0; i < targetClients.length; i++) {
      const client = targetClients[i]

      try {
        // Personalizar mensagem (simples substituição no frontend também)
        // A Edge Function também faz isso, mas se usarmos o envio single, mandamos a mensagem crua
        // e deixamos a edge function (ou fazemos aqui). 
        // A função sendWhatsAppMessage manda para 'single' que chama 'addInvisibleVariation' e manda.
        // A substituição de %Nome% no 'bulk' era feita na Edge Function. No 'single', não tem substituição automática.
        // Precisamos fazer a substituição AQUI antes de enviar.

        const personalizedMessage = message.trim().replace(/%Nome%/gi, client.nome || 'Cliente')

        const result = await sendWhatsAppMessage(client.telefone, personalizedMessage)

        if (result.success) {
          successCount++
        } else {
          errorCount++
          errors.push({
            client: client.nome,
            error: result.error
          })
        }
      } catch (err) {
        errorCount++
        errors.push({
          client: client.nome,
          error: err.message
        })
      }

      // Atualizar progresso
      setSendProgress({ current: i + 1, total: targetClients.length })

      // Delay aleatório (Anti-ban) - Entre 3 e 7 segundos
      // Não esperar no último
      if (i < targetClients.length - 1) {
        const delay = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000
        await wait(delay)
      }
    }

    // Atualizar registro com resultado final
    if (messageRecord) {
      await supabase
        .from('whatsapp_messages')
        .update({
          status: errorCount === 0 ? 'enviado' : errorCount === targetClients.length ? 'erro' : 'parcial',
          success_count: successCount,
          error_count: errorCount,
          errors: errors.length > 0 ? errors : null
        })
        .eq('id', messageRecord.id)
    }

    setSending(false)
    setMessage('')
    fetchHistory()

    // Mostrar resultado
    if (errorCount === 0) {
      showNotification('success', `Mensagem enviada com sucesso para ${successCount} cliente(s)!`)
    } else if (successCount === 0) {
      showNotification('error', `Erro ao enviar mensagem. Nenhuma mensagem foi entregue.`)
    } else {
      showNotification('warning', `Enviado parcialmente: ${successCount} sucesso, ${errorCount} falha(s)`)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'enviado':
        return <CheckCircle2 size={16} className="status-icon success" />
      case 'erro':
        return <XCircle size={16} className="status-icon error" />
      case 'parcial':
        return <AlertCircle size={16} className="status-icon warning" />
      case 'enviando':
        return <Loader2 size={16} className="status-icon sending" />
      default:
        return <Clock size={16} className="status-icon" />
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'enviado':
        return 'Enviado'
      case 'erro':
        return 'Erro'
      case 'parcial':
        return 'Parcial'
      case 'enviando':
        return 'Enviando...'
      default:
        return status
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatPhone = (phone) => {
    if (!phone) return '-'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  const getSelectedCount = () => {
    if (filterDestination === 'selecionados') {
      return selectedClients.length
    }
    return getFilteredClients().length
  }

  return (
    <div className="whatsapp-page">
      {/* Modal de Confirmação */}
      {confirmModal && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <p>{confirmModal.message}</p>
            <div className="confirm-buttons">
              <button className="btn btn-secondary" onClick={() => setConfirmModal(null)}>
                Cancelar
              </button>
              <button className="btn btn-success" onClick={handleConfirm}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificação Toast */}
      {notification && (
        <div className={`toast-notification toast-${notification.type}`}>
          {notification.type === 'success' && <CheckCircle2 size={20} />}
          {notification.type === 'error' && <XCircle size={20} />}
          {notification.type === 'warning' && <AlertCircle size={20} />}
          <span>{notification.message}</span>
          <button className="toast-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      <div className="page-header">
        <h1><MessageSquare size={24} /> WhatsApp</h1>
        <p className="page-subtitle">Envie mensagens em massa para seus clientes via WhatsApp</p>
      </div>

      {/* Status da API */}
      <div className="card api-status-card">
        <div className="api-status">
          <span className="api-status-indicator active"></span>
          <span>Whatsapp conectado</span>
        </div>
        <p className="api-info">
          Há <strong>{clients.filter(c => c.telefone).length}</strong> clientes com WhatsApp registrado.
        </p>
      </div>

      <div className="whatsapp-content">
        {/* Formulário de Envio */}
        <div className="card send-card">
          <h2>
            <Send size={20} />
            Enviar Mensagem
          </h2>

          <div className="form-group">
            <label>Mensagem</label>
            <textarea
              className="message-input"
              placeholder="Digite sua mensagem aqui..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              disabled={sending}
            />
            <div className="message-help">
              <span>Variáveis disponíveis:</span>
              <code>%Nome%</code> - Nome do cliente
            </div>
          </div>

          <div className="form-group">
            <label>Filtro Rápido</label>
            <select
              className="form-select"
              value={filterDestination}
              onChange={(e) => setFilterDestination(e.target.value)}
              disabled={sending}
            >
              <option value="todos">Todos os clientes ({clients.length})</option>
              <option value="aprovados">Clientes aprovados ({clients.filter(c => c.approved).length})</option>
              <option value="pendentes">Clientes pendentes ({clients.filter(c => !c.approved).length})</option>
              <option value="selecionados">Seleção personalizada ({selectedClients.length})</option>
            </select>
          </div>

          {/* Lista de Clientes */}
          <div className="clients-section">
            <div className="clients-header">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowClientList(!showClientList)}
              >
                {showClientList ? <EyeOff size={14} /> : <Eye size={14} />}
                {showClientList ? 'Ocultar clientes' : 'Ver clientes'}
              </button>

              {showClientList && (
                <div className="clients-actions">
                  <button className="btn btn-link btn-sm" onClick={selectAll}>
                    Selecionar todos
                  </button>
                  <button className="btn btn-link btn-sm" onClick={deselectAll}>
                    Limpar seleção
                  </button>
                </div>
              )}
            </div>

            {showClientList && (
              <div className="clients-list">
                {clients.length === 0 ? (
                  <p className="no-clients">Nenhum cliente com telefone cadastrado</p>
                ) : (
                  clients.map(client => (
                    <div
                      key={client.id}
                      className={`client-item ${selectedClients.includes(client.id) ? 'selected' : ''}`}
                      onClick={() => toggleClientSelection(client.id)}
                    >
                      <div className="client-checkbox">
                        {selectedClients.includes(client.id) ? (
                          <CheckSquare size={18} className="checked" />
                        ) : (
                          <Square size={18} />
                        )}
                      </div>
                      <div className="client-info">
                        <span className="client-name">
                          <User size={14} />
                          {client.nome}
                        </span>
                        <span className="client-phone">{formatPhone(client.telefone)}</span>
                      </div>
                      <span className={`client-status ${client.approved ? 'approved' : 'pending'}`}>
                        {client.approved ? 'Aprovado' : 'Pendente'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="recipients-preview">
            <Users size={16} />
            <span><strong>{getSelectedCount()}</strong> destinatário(s) selecionado(s)</span>
          </div>

          {sending && (
            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                />
              </div>
              <span className="progress-text">
                Enviando {sendProgress.current} de {sendProgress.total}...
              </span>
            </div>
          )}

          <button
            className="btn btn-success btn-send"
            onClick={handleSendMessage}
            disabled={sending || !message.trim() || getSelectedCount() === 0}
          >
            {sending ? (
              <>
                <Loader2 size={18} className="spinning" />
                Enviando...
              </>
            ) : (
              <>
                <Send size={18} />
                Enviar para {getSelectedCount()} cliente(s)
              </>
            )}
          </button>
        </div>

        {/* Histórico */}
        <div className="card history-card">
          <div className="history-header">
            <h2>
              <History size={20} />
              Histórico
            </h2>
            <div className="history-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={fetchHistory}
                disabled={loadingHistory}
              >
                <RefreshCw size={14} className={loadingHistory ? 'spinning' : ''} />
              </button>
              {history.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={clearAllHistory}
                >
                  <Trash2 size={14} />
                  Limpar
                </button>
              )}
            </div>
          </div>

          {loadingHistory ? (
            <div className="loading-container">
              <div className="loading-spinner" />
            </div>
          ) : history.length === 0 ? (
            <div className="empty-history">
              <MessageSquare size={48} className="empty-icon" />
              <p>Nenhuma mensagem enviada ainda</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-item-header">
                    <div className="history-status">
                      {getStatusIcon(item.status)}
                      <span className={`status-badge status-${item.status}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                    <div className="history-item-actions">
                      <span className="history-date">
                        <Clock size={12} />
                        {formatDate(item.created_at)}
                      </span>
                      <button
                        className="btn-delete"
                        onClick={() => deleteHistoryItem(item.id)}
                        title="Apagar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="history-message">{item.message}</p>
                  <div className="history-stats">
                    <span className="stat">
                      <Users size={12} />
                      {item.total_recipients} destinatário(s)
                    </span>
                    {item.success_count !== null && (
                      <span className="stat success">
                        <CheckCircle2 size={12} />
                        {item.success_count} sucesso
                      </span>
                    )}
                    {item.error_count > 0 && (
                      <span className="stat error">
                        <XCircle size={12} />
                        {item.error_count} erro(s)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
