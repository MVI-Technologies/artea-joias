import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Info, Bell, Loader2, Lock, X, Search } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { notifyNewCatalog, notifyCatalogClosed } from '../../../services/whatsapp'
import ImageUpload from '../../../components/common/ImageUpload'
import './LotForm.css'

export default function LotForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = !!id
  
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [sendingNotification, setSendingNotification] = useState(false)
  const [activeTab, setActiveTab] = useState('taxas')
  const [notifyClients, setNotifyClients] = useState(false)
  const [notifyOnClose, setNotifyOnClose] = useState(false) // Notificar ao fechar
  const [notificationResult, setNotificationResult] = useState(null)
  const [originalStatus, setOriginalStatus] = useState('') // Status original para detectar mudança
  const [originalCatalog, setOriginalCatalog] = useState(null) // Dados originais do catálogo
  
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    cover_image_url: null,
    status: 'aberto',
    tipo_link: 'tradicional',
    // Taxas
    custo_separacao: 0,
    custo_operacional: 0,
    custo_motoboy: 0,
    custo_digitacao: 0,
    escritorio_pct: 0,
    percentual_entrada: 0,
    taxa_separacao_dinamica: '',
    // Configurações
    exigir_dados_galvanica: false,
    adicionar_marca_agua: false,
    dados_pagamento: '',
    payment_option_id: null,
    permitir_modificacao_produtos: 'permitir_reduzir_excluir',
    show_buyers_list: false
  })
  
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentOptions, setPaymentOptions] = useState([])
  const [loadingPaymentOptions, setLoadingPaymentOptions] = useState(false)

  useEffect(() => {
    if (isEditing) {
      fetchLot()
    }
    loadPaymentOptions()
  }, [id])

  const fetchLot = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      // Guardar status e dados originais para detectar mudanças
      setOriginalStatus(data.status || 'aberto')
      setOriginalCatalog(data)

      setFormData({
        nome: data.nome || '',
        descricao: data.descricao || '',
        cover_image_url: data.cover_image_url || null,
        status: data.status || 'aberto',
        tipo_link: data.tipo_link || 'tradicional',
        custo_separacao: data.custo_separacao || 0,
        custo_operacional: data.custo_operacional || 0,
        custo_motoboy: data.custo_motoboy || 0,
        custo_digitacao: data.custo_digitacao || 0,
        escritorio_pct: data.escritorio_pct || 0,
        percentual_entrada: data.percentual_entrada || 0,
        taxa_separacao_dinamica: data.taxa_separacao_dinamica || '',
        exigir_dados_galvanica: data.exigir_dados_galvanica || false,
        adicionar_marca_agua: data.adicionar_marca_agua || false,
        dados_pagamento: data.dados_pagamento || '',
        payment_option_id: data.payment_option_id || null,
        permitir_modificacao_produtos: data.permitir_modificacao_produtos || 'permitir_reduzir_excluir',
        show_buyers_list: data.show_buyers_list || false
      })
    } catch (error) {
      console.error('Erro ao carregar grupo:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.nome.trim()) {
      alert('Nome é obrigatório')
      return
    }

    setSaving(true)
    setNotificationResult(null)
    
    try {
      const dataToSave = {
        nome: formData.nome,
        descricao: formData.descricao,
        cover_image_url: formData.cover_image_url,
        status: formData.status,
        tipo_link: formData.tipo_link,
        custo_separacao: formData.custo_separacao,
        custo_operacional: formData.custo_operacional,
        custo_motoboy: formData.custo_motoboy,
        custo_digitacao: formData.custo_digitacao,
        escritorio_pct: formData.escritorio_pct,
        percentual_entrada: formData.percentual_entrada,
        taxa_separacao_dinamica: formData.taxa_separacao_dinamica,
        // Configurações
        exigir_dados_galvanica: formData.exigir_dados_galvanica,
        adicionar_marca_agua: formData.adicionar_marca_agua,
        dados_pagamento: formData.dados_pagamento,
        payment_option_id: formData.payment_option_id,
        permitir_modificacao_produtos: formData.permitir_modificacao_produtos,
        show_buyers_list: formData.show_buyers_list
      }

      let savedCatalog = null

      if (isEditing) {
        const { data, error } = await supabase
          .from('lots')
          .update(dataToSave)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        savedCatalog = data
      } else {
        // Gerar link único para o catálogo
        const linkCode = generateLinkCode()
        dataToSave.link_compra = linkCode
        
        const { data, error } = await supabase
          .from('lots')
          .insert(dataToSave)
          .select()
          .single()
        if (error) throw error
        savedCatalog = data
      }

      // Verificar se deve enviar notificação
      const shouldNotifyNewCatalog = notifyClients && !isEditing && savedCatalog
      const shouldNotifyClose = notifyOnClose && isEditing && originalStatus !== 'fechado' && formData.status === 'fechado' && savedCatalog

      if (shouldNotifyNewCatalog || shouldNotifyClose) {
        setSaving(false)
        setSendingNotification(true)
        
        try {
          // Buscar todos os clientes com telefone cadastrado
          const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select('id, nome, telefone')
            .eq('role', 'cliente')
            .not('telefone', 'is', null)
          
          if (clientsError) throw clientsError
          
          if (clients && clients.length > 0) {
            let result
            
            if (shouldNotifyNewCatalog) {
              // Notificação de novo catálogo
              const catalogUrl = `https://arteajoias.semijoias.net/catalogo/${savedCatalog.link_compra}`
              result = await notifyNewCatalog(savedCatalog, clients, catalogUrl)
            } else {
              // Notificação de fechamento
              result = await notifyCatalogClosed(savedCatalog, clients)
            }
            
            if (result.success) {
              setNotificationResult({
                type: 'success',
                message: shouldNotifyNewCatalog 
                  ? `Catálogo criado e ${result.data?.success || clients.length} cliente(s) notificado(s) com sucesso!`
                  : `Catálogo fechado e ${result.data?.success || clients.length} cliente(s) notificado(s) com sucesso!`
              })
            } else {
              setNotificationResult({
                type: 'warning',
                message: `Catálogo salvo, mas houve erro ao notificar: ${result.error}`
              })
            }
          } else {
            setNotificationResult({
              type: 'info',
              message: shouldNotifyNewCatalog 
                ? 'Catálogo criado! Nenhum cliente com telefone cadastrado para notificar.'
                : 'Catálogo fechado! Nenhum cliente com telefone cadastrado para notificar.'
            })
          }
        } catch (notifyError) {
          console.error('Erro ao notificar:', notifyError)
          setNotificationResult({
            type: 'warning',
            message: `Catálogo salvo, mas erro ao enviar notificações: ${notifyError.message}`
          })
        } finally {
          setSendingNotification(false)
        }
        
        // Aguardar um pouco para mostrar o resultado antes de navegar
        setTimeout(() => navigate('/admin/lotes'), 2500)
      } else {
        navigate('/admin/lotes')
      }
    } catch (error) {
      console.error('Erro ao salvar:', error)
      alert(`Erro ao salvar grupo de compras: ${error.message || error}`)
      setSaving(false)
      setSendingNotification(false)
    }
  }

  // Gerar código único para o link do catálogo
  const generateLinkCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let code = ''
    for (let i = 0; i < 24; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // Carregar opções de pagamento
  const loadPaymentOptions = async () => {
    setLoadingPaymentOptions(true)
    try {
      const { data, error } = await supabase
        .from('payment_options')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPaymentOptions(data || [])
    } catch (error) {
      console.error('Erro ao carregar opções de pagamento:', error)
    } finally {
      setLoadingPaymentOptions(false)
    }
  }

  // Selecionar opção de pagamento
  const handleSelectPaymentOption = (option) => {
    setFormData(prev => ({
      ...prev,
      dados_pagamento: option.descricao,
      payment_option_id: option.id
    }))
    setShowPaymentModal(false)
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner" style={{ margin: '40px auto' }} />
      </div>
    )
  }

  return (
    <div className="page-container lot-form-page">
      {/* Header */}
      <div className="form-header">
        <button className="btn-back" onClick={() => navigate('/admin/lotes')}>
          <ArrowLeft size={18} />
        </button>
        <h1>{isEditing ? formData.nome || 'Editar Catálogo' : 'Novo Catálogo'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="lot-form">
        {/* Campos principais */}
        <div className="form-section">
          <div className="form-row">
            <div className="form-group flex-2">
              <label>Nome <span className="required">Obrigatório</span></label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => handleChange('nome', e.target.value)}
                placeholder="Nome do grupo"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Descrição <span className="optional">Opcional</span></label>
            <textarea
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder="Descrição do grupo (opcional)"
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tipo de Link</label>
              <select
                value={formData.tipo_link}
                onChange={(e) => handleChange('tipo_link', e.target.value)}
              >
                <option value="tradicional">Tradicional. Compra Coletiva</option>
                <option value="pronta_entrega">Pronta Entrega. Com controle de qtde máxima</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status Atual</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                <option value="aberto">Aberto</option>
                <option value="em_preparacao">Em preparação</option>
                <option value="pronto_e_aberto">Pronto e Aberto</option>
                <option value="fechado">Fechado</option>
                <option value="em_fabricacao">Em fabricação</option>
                <option value="fornecedor_separando">Fornecedor separando o pedido</option>
                <option value="verificando_estoque">Verificando Estoque</option>
                <option value="organizando_valores">Organizando Valores</option>
                <option value="aguardando_pagamentos">Aguardando Pagamentos</option>
                <option value="em_transito">Em Trânsito</option>
                <option value="em_transito_internacional">Em Trânsito Internacional</option>
                <option value="em_separacao">Em Separação</option>
                <option value="envio_liberado">Envio Liberado</option>
                <option value="envio_parcial_liberado">Envio Parcial Liberado</option>
                <option value="fechado_e_bloqueado">Fechado e Bloqueado</option>
                <option value="pago">Pago</option>
                <option value="enviado">Enviado</option>
                <option value="concluido">Concluído</option>
                <option value="finalizado">Finalizado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="form-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'taxas' ? 'active' : ''}`}
            onClick={() => setActiveTab('taxas')}
          >
            Taxas
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'configuracoes' ? 'active' : ''}`}
            onClick={() => setActiveTab('configuracoes')}
          >
            Configurações
          </button>
        </div>

        {/* Tab Content: Taxas */}
        {activeTab === 'taxas' && (
          <div className="form-section taxas-section">
            <div className="taxas-grid">
              <div className="form-group">
                <label>Custo Separação <span className="optional">Opcional</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.custo_separacao}
                  onChange={(e) => handleChange('custo_separacao', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Custo Operacional <span className="optional">opcional, ($ por produto)</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.custo_operacional}
                  onChange={(e) => handleChange('custo_operacional', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Escritório <span className="optional">Opcional, (% s/ produtos)</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.escritorio_pct}
                  onChange={(e) => handleChange('escritorio_pct', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Custo Motoboy <span className="optional">Opcional</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.custo_motoboy}
                  onChange={(e) => handleChange('custo_motoboy', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Custo Digitação <span className="optional">Opcional</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.custo_digitacao}
                  onChange={(e) => handleChange('custo_digitacao', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Percentual Entrada <span className="optional">Opcional</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.percentual_entrada}
                  onChange={(e) => handleChange('percentual_entrada', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="form-group taxa-dinamica">
              <label>
                Taxa Separação Dinâmica 
                <Info size={14} className="info-icon" />
                <span className="optional">Opcional</span>
              </label>
              <textarea
                value={formData.taxa_separacao_dinamica}
                onChange={(e) => handleChange('taxa_separacao_dinamica', e.target.value)}
                placeholder="Descreva a regra de taxa dinâmica..."
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Tab Content: Configurações */}
        {activeTab === 'configuracoes' && (
          <div className="form-section configuracoes-section">
            <div className="configuracoes-grid">
              {/* Coluna Esquerda */}
              <div className="config-col">
                {/* Dados da galvânica */}
                <div className="form-group">
                  <label>Dados da galvânica</label>
                  <select
                    value={formData.exigir_dados_galvanica ? 'exigir' : 'nao_exigir'}
                    onChange={(e) => handleChange('exigir_dados_galvanica', e.target.value === 'exigir')}
                  >
                    <option value="exigir">Exigir preenchimento dos dados da galvânica</option>
                    <option value="nao_exigir">Não exigir preenchimento dos dados da galvânica</option>
                  </select>
                </div>

                {/* Adicionar Marca d'água */}
                <div className="form-group">
                  <label>
                    Adicionar Marca d'água
                    <span className="optional">Opcional</span>
                  </label>
                  <select
                    value={formData.adicionar_marca_agua ? 'adicionar' : 'nao_adicionar'}
                    onChange={(e) => handleChange('adicionar_marca_agua', e.target.value === 'adicionar')}
                  >
                    <option value="nao_adicionar">Não adicionar marca d'agua em todos os produtos</option>
                    <option value="adicionar">Adicionar marca d'agua em todos os produtos</option>
                  </select>
                </div>

                {/* Dados para o pagamento */}
                <div className="form-group">
                  <label>
                    Dados para o pagamento
                    <span className="optional">Opcional</span>
                  </label>
                  <div className="payment-input-group">
                    <textarea
                      value={formData.dados_pagamento}
                      onChange={(e) => handleChange('dados_pagamento', e.target.value)}
                      placeholder="Selecione uma opção de pagamento ou digite manualmente"
                      rows={4}
                    />
                    <button
                      type="button"
                      className="btn-procurar"
                      onClick={() => setShowPaymentModal(true)}
                    >
                      <Search size={16} />
                      Procurar
                    </button>
                  </div>
                </div>
              </div>

              {/* Coluna Direita */}
              <div className="config-col">
                {/* Reduzir e Remover Produtos */}
                <div className="form-group">
                  <label>
                    Reduzir e Remover Produtos
                    <span className="optional">Opcional</span>
                  </label>
                  <select
                    value={formData.permitir_modificacao_produtos}
                    onChange={(e) => handleChange('permitir_modificacao_produtos', e.target.value)}
                  >
                    <option value="permitir_reduzir_excluir">Permitir o cliente reduzir e excluir produtos antes do fechamento</option>
                    <option value="nao_permitir">Não permitir o cliente reduzir e excluir produtos antes do fechamento</option>
                    <option value="permitir_reduzir_nao_excluir">Permitir o cliente reduzir mas não excluir</option>
                  </select>
                </div>

                {/* Prova Social - Exibir lista de compradores */}
                <div className="form-group">
                  <label className="checkbox-label-list">
                    <input
                      type="checkbox"
                      checked={formData.show_buyers_list || false}
                      onChange={(e) => handleChange('show_buyers_list', e.target.checked)}
                    />
                    <span>Exibir quem já comprou este produto</span>
                  </label>
                  <p className="help-text">
                    Ativar esta opção pode estimular compras por efeito social.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Seleção de Pagamento */}
        {showPaymentModal && (
          <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
            <div className="modal-payment" onClick={(e) => e.stopPropagation()}>
              <div className="modal-payment-header">
                <h3>Dados de Pagamento</h3>
                <button className="btn-close-modal" onClick={() => setShowPaymentModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-payment-body">
                {loadingPaymentOptions ? (
                  <div className="loading-payment-options">
                    <Loader2 size={20} className="spinning" />
                    <span>Carregando opções...</span>
                  </div>
                ) : paymentOptions.length === 0 ? (
                  <p className="no-payment-options">
                    Nenhuma opção de pagamento cadastrada. Cadastre opções em Configurações.
                  </p>
                ) : (
                  <div className="payment-options-list">
                    {paymentOptions.map((option) => (
                      <div key={option.id} className="payment-option-item">
                        <div className="payment-option-content">
                          <p className="payment-option-desc">{option.descricao}</p>
                        </div>
                        <button
                          type="button"
                          className="btn-escolher"
                          onClick={() => handleSelectPaymentOption(option)}
                        >
                          Escolher
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notificação de clientes - novo catálogo */}
        {!isEditing && (
          <div className="form-section notification-section">
            <div className="notification-checkbox">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={notifyClients}
                  onChange={(e) => setNotifyClients(e.target.checked)}
                  disabled={saving || sendingNotification}
                />
                <span className="checkmark"></span>
                <span className="checkbox-label">
                  <Bell size={16} />
                  Enviar notificação WhatsApp para todos os clientes
                </span>
              </label>
              <p className="notification-hint">
                Ao marcar esta opção, todos os clientes cadastrados com telefone receberão uma mensagem automática sobre o novo catálogo.
              </p>
            </div>
          </div>
        )}

        {/* Notificação de fechamento - ao mudar status para fechado */}
        {isEditing && originalStatus !== 'fechado' && formData.status === 'fechado' && (
          <div className="form-section notification-section notification-close">
            <div className="notification-checkbox">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={notifyOnClose}
                  onChange={(e) => setNotifyOnClose(e.target.checked)}
                  disabled={saving || sendingNotification}
                />
                <span className="checkmark"></span>
                <span className="checkbox-label">
                  <Lock size={16} />
                  Enviar notificação de FECHAMENTO para todos os clientes
                </span>
              </label>
              <p className="notification-hint">
                Ao marcar esta opção, todos os clientes receberão uma mensagem informando que este catálogo foi fechado.
              </p>
            </div>
          </div>
        )}

        {/* Feedback de notificação */}
        {notificationResult && (
          <div className={`notification-result notification-${notificationResult.type}`}>
            {notificationResult.message}
          </div>
        )}

        {/* Botão Salvar */}
        <div className="form-actions">
          <button type="submit" className="btn btn-save" disabled={saving || sendingNotification}>
            {saving ? (
              <>
                <Loader2 size={16} className="spinning" />
                Salvando...
              </>
            ) : sendingNotification ? (
              <>
                <Loader2 size={16} className="spinning" />
                Enviando notificações...
              </>
            ) : (
              <>
                <Save size={16} />
                {notifyClients && !isEditing 
                  ? 'Salvar e Notificar Clientes' 
                  : notifyOnClose && formData.status === 'fechado'
                    ? 'Fechar e Notificar Clientes'
                    : 'Salvar'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
