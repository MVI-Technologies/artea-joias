import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Printer,
  Download,
  MessageCircle,
  FileText,
  CheckCircle,
  Clock,
  DollarSign,
  Edit,
  Save,
  X,
  Plus
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './RomaneioDetail.css'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../../components/common/Toast'
import { generateRomaneioPDF } from '../../../utils/pdfGenerator'

const STATUS_OPTIONS = [
  { value: 'aguardando_pagamento', label: 'Aguardando Pagamento', color: 'warning' },
  { value: 'pago', label: 'Pago', color: 'success' },
  { value: 'em_separacao', label: 'Em Separação', color: 'info' },
  { value: 'enviado', label: 'Enviado', color: 'primary' },
  { value: 'concluido', label: 'Concluído', color: 'success' },
  { value: 'cancelado', label: 'Cancelado', color: 'danger' },
  { value: 'admin_purchase', label: 'Compra Administrativa', color: 'purple' }
]

export default function RomaneioDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const printRef = useRef()
  const toast = useToast()
  const [romaneio, setRomaneio] = useState(null)
  const [lot, setLot] = useState(null)
  const [client, setClient] = useState(null)
  const [items, setItems] = useState([])
  const [company, setCompany] = useState(null)
  const { user } = useAuth()
  const [pixConfig, setPixConfig] = useState(null) // Centralized payment config
  const [loading, setLoading] = useState(true)

  // Status Modal Controls
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [targetStatus, setTargetStatus] = useState('')
  const [statusReason, setStatusReason] = useState('')
  const [updating, setUpdating] = useState(false)

  // Edit Mode Controls
  const [editMode, setEditMode] = useState(false)
  const [editedItems, setEditedItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)

  // Product Addition Controls
  const [availableProducts, setAvailableProducts] = useState([])
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      // 1. Buscar configuração de pagamento CENTRALIZADA (integrations)
      const { data: pixIntegration } = await supabase
        .from('integrations')
        .select('config')
        .eq('type', 'pix')
        .single()

      if (pixIntegration?.config) {
        setPixConfig(pixIntegration.config)
      }

      // 2. Buscar romaneio
      const { data: romaneioData, error: romError } = await supabase
        .from('romaneios')
        .select('*')
        .eq('id', id)
        .single()

      if (romError) throw romError
      setRomaneio(romaneioData)

      // 3. Buscar lote
      console.log('🔍 Buscando lote com ID:', romaneioData.lot_id)
      const { data: lotData } = await supabase
        .from('lots')
        .select('id, nome, updated_at, requer_pacote_fechado, prazo_pagamento_horas')
        .eq('id', romaneioData.lot_id)
        .single()

      console.log('📦 Lote carregado:', lotData)
      setLot(lotData)

      if (!lotData && romaneioData.lot_id) {
        console.log('⚠️ Lote não encontrado na primeira tentativa. Tentando via RPC (bypass RLS)...')
        const { data: rpcName } = await supabase
          .rpc('get_lot_name_by_id', { p_lot_id: romaneioData.lot_id })

        console.log('📦 Nome do lote via RPC:', rpcName)

        if (rpcName) {
          setLot({ id: romaneioData.lot_id, nome: rpcName })
        } else {
          // Tenta buscar normal novamente só para garantir logs
          const { data: retryLot } = await supabase
            .from('lots')
            .select('*')
            .eq('id', romaneioData.lot_id)
            .single()
          if (retryLot) setLot(retryLot)
        }
      } else if (!romaneioData.lot_id) {
        console.error('❌ ERRO CRÍTICO: Romaneio não tem lot_id!')
      }

      // 4. Buscar cliente
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', romaneioData.client_id)
        .single()
      setClient(clientData)

      // 5. Buscar itens do romaneio
      const { data: itemsData } = await supabase
        .from('romaneio_items')
        .select(`
          *,
          product:products(id, nome, descricao, preco, imagem1, categoria_id, category:categories(nome))
        `)
        .eq('romaneio_id', id)
        .order('created_at')
      setItems(itemsData || [])

      // 6. Buscar configurações da empresa
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('*')
        .single()
      setCompany(companyData)

    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const enableEditMode = async () => {
    setEditedItems(items.map(item => ({ ...item })))
    setEditMode(true)

    // Fetch available products from the lot
    if (romaneio?.lot_id) {
      setLoadingProducts(true)
      try {
        const { data: lotProducts, error } = await supabase
          .from('lot_products')
          .select(`
            product_id,
            product:products(
              id,
              nome,
              descricao,
              preco,
              imagem1,
              categoria_id,
              category:categories(nome)
            )
          `)
          .eq('lot_id', romaneio.lot_id)

        if (error) throw error

        // Filter out products that are already in the romaneio
        const existingProductIds = items.map(item => item.product_id)
        const available = lotProducts
          .filter(lp => !existingProductIds.includes(lp.product_id))
          .map(lp => lp.product)
          .filter(p => p !== null)

        setAvailableProducts(available)
      } catch (error) {
        console.error('Erro ao buscar produtos disponíveis:', error)
        toast.error('Erro ao carregar produtos disponíveis')
      } finally {
        setLoadingProducts(false)
      }
    }
  }

  const cancelEditMode = () => {
    setEditMode(false)
    setEditedItems([])
    setAvailableProducts([])
    setShowAddProductModal(false)
  }

  const updateItemQuantity = (itemId, newQuantity) => {
    setEditedItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const quantidade = Math.max(0, parseInt(newQuantity) || 0)
        const precoUnitario = item.valor_unitario || item.preco_unitario || item.product?.preco || 0
        const valor_total = quantidade * precoUnitario
        return { ...item, quantidade, valor_total }
      }
      return item
    }))
  }

  const addProductToRomaneio = (product, quantity = 1) => {
    // Create a temporary item (will be saved to DB when user clicks Save)
    const newItem = {
      id: `temp-${Date.now()}`, // Temporary ID
      romaneio_id: id,
      product_id: product.id,
      product: product,
      quantidade: quantity,
      valor_unitario: product.preco,
      preco_unitario: product.preco,
      valor_total: product.preco * quantity,
      valor_recalculado: null,
      isNew: true // Flag to identify new items
    }

    setEditedItems(prev => [...prev, newItem])

    // Remove from available products
    setAvailableProducts(prev => prev.filter(p => p.id !== product.id))

    toast.success(`${product.nome} adicionado ao romaneio`)
    setShowAddProductModal(false)
  }

  const saveChanges = async () => {
    try {
      setSaving(true)

      // Separate new items from existing items
      const newItems = editedItems.filter(item => item.isNew)
      const existingItems = editedItems.filter(item => !item.isNew)

      // Insert new items into database
      for (const item of newItems) {
        const { error } = await supabase
          .from('romaneio_items')
          .insert({
            romaneio_id: id,
            product_id: item.product_id,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            preco_unitario: item.preco_unitario,
            valor_total: item.valor_total,
            valor_recalculado: item.valor_recalculado
          })

        if (error) throw error
      }

      // Update existing items in database
      for (const item of existingItems) {
        // Update quantidade and valor_recalculado (manual override)
        const { error } = await supabase
          .from('romaneio_items')
          .update({
            quantidade: item.quantidade,
            valor_recalculado: item.valor_total
          })
          .eq('id', item.id)

        if (error) throw error
      }

      // Fetch updated items to get final totals
      const { data: updatedItems, error: fetchError } = await supabase
        .from('romaneio_items')
        .select('quantidade, valor_total, valor_recalculado')
        .eq('romaneio_id', id)

      if (fetchError) throw fetchError

      // Recalculate romaneio totals using valor_recalculado if set, otherwise valor_total
      const totalProdutos = updatedItems.reduce((sum, item) => {
        const valorEfetivo = item.valor_recalculado ?? item.valor_total
        return sum + (valorEfetivo || 0)
      }, 0)
      const quantidadeTotal = updatedItems.reduce((sum, item) => sum + (item.quantidade || 0), 0)

      // Automatic Fee Calculation
      let taxaSeparacao = 0
      if (totalProdutos >= 1 && totalProdutos <= 80) {
        taxaSeparacao = 15.00
      } else if (totalProdutos > 80) {
        taxaSeparacao = 25.00
      }

      // Preserve existing manual freight if any, or usage manual logic if implemented later
      // For now, we update taxa_separacao automatically based on rules

      const valorTotal = totalProdutos + taxaSeparacao + (romaneio.valor_frete || 0)

      const { error: romaneioError } = await supabase
        .from('romaneios')
        .update({
          valor_produtos: totalProdutos,
          quantidade_itens: quantidadeTotal,
          taxa_separacao: taxaSeparacao,
          valor_total: valorTotal
        })
        .eq('id', id)

      if (romaneioError) throw romaneioError

      toast.success('Romaneio atualizado com sucesso!')
      setEditMode(false)
      await fetchData() // Reload data

    } catch (error) {
      console.error('Erro ao salvar alterações:', error)
      toast.error('Erro ao salvar alterações: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const sendWhatsAppWithPDF = async () => {
    if (!client?.telefone) {
      toast.error('Cliente não possui telefone cadastrado')
      return
    }

    try {
      setSendingWhatsApp(true)

      console.log('📄 Gerando PDF do romaneio...')

      // Generate PDF
      const pdfBase64 = await generateRomaneioPDF({
        romaneio,
        lot,
        client,
        items,
        company,
        pixConfig
      })

      console.log('✅ PDF gerado:', pdfBase64 ? `${pdfBase64.length} caracteres` : 'VAZIO')

      if (!pdfBase64) throw new Error('Falha ao gerar PDF')

      // Prepare message about availability
      const unavailableItems = items.filter(item => item.quantidade === 0)
      const availableItems = items.filter(item => item.quantidade > 0)

      console.log('🔍 Dados do lote:', lot)
      const lotName = lot?.nome || 'Link'
      console.log('📝 Nome do lote usado:', lotName)

      let message = `Olá ${client.nome}! 🌟\n\n`
      message += `Seu romaneio do *${lotName}* foi atualizado!\n\n`

      if (unavailableItems.length > 0) {
        message += `⚠️ *Atenção - Disponibilidade de Produtos:*\n\n`
        message += `Infelizmente, alguns itens não estão disponíveis na quantidade solicitada:\n\n`

        unavailableItems.forEach(item => {
          message += `❌ ${item.product?.nome || 'Produto'} - Indisponível\n`
        })

        message += `\n✅ *Itens Disponíveis:*\n\n`
        availableItems.forEach(item => {
          message += `• ${item.product?.nome || 'Produto'} - Qtd: ${item.quantidade}\n`
        })

        message += `\n💰 *Valor Total Atualizado:* R$ ${romaneio.valor_total?.toFixed(2)}\n\n`
      } else {
        message += `📋 Pedido: ${romaneio.numero_romaneio || romaneio.numero_pedido}\n`
        message += `💰 Valor Total: R$ ${romaneio.valor_total?.toFixed(2)}\n\n`
      }

      message += `Por favor, realize o pagamento conforme os dados do romaneio em anexo.\n\n`
      message += `Qualquer dúvida, estamos à disposição! 💎`

      // Send via WhatsApp Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const payload = {
        to: client.telefone,
        fileBase64: pdfBase64,
        fileName: `Romaneio-${romaneio.numero_romaneio || romaneio.id.slice(-6)}.pdf`,
        caption: message,
        mimeType: 'application/pdf'
      }

      console.log('📤 Enviando para WhatsApp:', {
        to: payload.to,
        fileName: payload.fileName,
        pdfSize: payload.fileBase64?.length,
        captionLength: payload.caption?.length
      })

      const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp?action=file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify(payload)
      })

      let result
      try {
        result = await response.json()
      } catch (parseError) {
        console.error('Erro ao parsear resposta:', parseError)
        throw new Error(`Erro ${response.status}: Resposta inválida do servidor`)
      }

      console.log('Resposta da Edge Function:', result)

      if (!response.ok || !result.success) {
        const errorMsg = result.error || result.message || `Erro ${response.status}`
        console.error('Erro detalhado:', errorMsg)
        throw new Error(errorMsg)
      }

      toast.success('Romaneio enviado via WhatsApp com sucesso!')

    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error)
      toast.error('Erro ao enviar WhatsApp: ' + error.message)
    } finally {
      setSendingWhatsApp(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      toast.info('Gerando PDF...')

      console.log('📦 Lote no momento do PDF:', lot)
      console.log('📝 Nome do lote:', lot?.nome)

      const pdfBase64 = await generateRomaneioPDF({
        romaneio,
        lot,
        client,
        items,
        company,
        pixConfig
      })

      if (!pdfBase64) throw new Error('Falha ao gerar PDF')

      // Create download link
      const link = document.createElement('a')
      link.href = `data:application/pdf;base64,${pdfBase64}`
      link.download = `Romaneio-${romaneio.numero_romaneio || romaneio.id.slice(-6)}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('PDF baixado com sucesso!')
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      toast.error('Erro ao gerar PDF: ' + error.message)
    }
  }

  const handleStatusUpdate = async () => {
    if (!targetStatus) return
    setUpdating(true)

    try {
      // Encontrar admin ID (client_id do usuario logado)
      const { data: adminClient } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!adminClient) throw new Error('Perfil de administrador não encontrado')

      const { error } = await supabase.rpc('update_romaneio_status', {
        p_romaneio_id: id,
        p_novo_status: targetStatus,
        p_admin_id: adminClient.id,
        p_observacao: statusReason || null
      })

      if (error) throw error

      // Mensagem personalizada baseada no status
      const statusMessages = {
        'cancelado': '❌ Pedido cancelado com sucesso!',
        'pago': '✅ Pagamento confirmado!',
        'em_separacao': '📦 Pedido em separação!',
        'enviado': '🚚 Pedido marcado como enviado!',
        'concluido': '🎉 Pedido concluído!',
        'aguardando_pagamento': '⏳ Status alterado para aguardando pagamento'
      }

      toast.success(statusMessages[targetStatus] || 'Status atualizado com sucesso!')
      setShowStatusModal(false)
      setStatusReason('')
      fetchData() // Reload
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status: ' + error.message)
    } finally {
      setUpdating(false)
    }
  }

  const openWhatsApp = () => {
    if (!client?.telefone) return

    const phone = client.telefone.replace(/\D/g, '')
    const message = encodeURIComponent(
      `Olá ${client.nome}! 🌟\n\n` +
      `Seu romaneio do *${lot?.nome}* está pronto!\n\n` +
      `📋 Pedido: ${romaneio?.numero_romaneio || romaneio?.numero_pedido}\n` +
      `💰 Valor Total: R$ ${romaneio?.valor_total?.toFixed(2)}\n\n` +
      `Por favor, realize o pagamento conforme os dados do romaneio.\n\n` +
      `Qualquer dúvida, estamos à disposição! 💎`
    )
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatCPF = (cpf) => {
    if (!cpf) return '-'
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  if (loading) {
    return <div className="page-container"><div className="loading-spinner" style={{ margin: '40px auto' }} /></div>
  }

  if (!romaneio) {
    return <div className="page-container">Romaneio não encontrado</div>
  }

  const requerPacote = lot?.requer_pacote_fechado ? '' : '(Não precisa fechar pacotes)'

  return (
    <div className="romaneio-detail-page">
      {/* Toolbar (não imprime) */}
      <div className="romaneio-toolbar no-print">
        <button className="btn btn-outline" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="toolbar-actions">
          {!editMode ? (
            <>
              <button className="btn btn-outline" onClick={enableEditMode}>
                <Edit size={16} /> Editar Quantidades
              </button>
              <button
                className="btn btn-success"
                onClick={sendWhatsAppWithPDF}
                disabled={sendingWhatsApp}
              >
                <MessageCircle size={16} /> {sendingWhatsApp ? 'Enviando...' : 'Enviar WhatsApp + PDF'}
              </button>
              <button className="btn btn-primary" onClick={handleDownloadPDF}>
                <Download size={16} /> Salvar PDF
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={cancelEditMode}>
                <X size={16} /> Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowAddProductModal(true)}
                disabled={loadingProducts || availableProducts.length === 0}
              >
                <Plus size={16} /> Adicionar Produto
              </button>
              <button
                className="btn btn-success"
                onClick={saveChanges}
                disabled={saving}
              >
                <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </>
          )}
        </div>
      </div>


      {/* Edit Mode Banner */}
      {editMode && (
        <div className="no-print" style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '12px 20px',
          margin: '0 20px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Edit size={20} color="#856404" />
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#856404' }}>Modo de Edição Ativo</strong>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#856404' }}>
              Ajuste as quantidades dos produtos ou adicione novos produtos do catálogo. Clique em "Salvar Alterações" para confirmar.
            </p>
          </div>
        </div>
      )}

      {/* Status do Pagamento (não imprime) */}
      <div className="payment-status-bar no-print">
        <div className={`payment-status status-${romaneio.status_pagamento === 'aguardando_pagamento' ? 'aguardando' : romaneio.status_pagamento}`}>
          {romaneio.status_pagamento === 'pago' ? (
            <><CheckCircle size={18} /> Pagamento Confirmado</>
          ) : ['aguardando', 'aguardando_pagamento'].includes(romaneio.status_pagamento) ? (
            <><Clock size={18} /> Aguardando Pagamento</>
          ) : (
            <><DollarSign size={18} /> Pendente</>
          )}
        </div>

        {romaneio.status_pagamento !== 'pago' && (
          <div className="payment-actions">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                // Usar configuração centralizada de PIX
                const pixKey = pixConfig?.chave
                if (pixKey) {
                  navigator.clipboard.writeText(pixKey)
                  alert('Chave PIX copiada!')
                } else {
                  alert('Chave PIX não configurada. Configure em Configurações > Integrações.')
                }
              }}
            >
              <DollarSign size={14} /> Copiar PIX
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowStatusModal(true)}
            >
              <CheckCircle size={14} /> Alterar Status
            </button>
          </div>
        )}
      </div>

      {showStatusModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Alterar Status do Romaneio</h3>
            <div className="form-group">
              <label>Novo Status:</label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="form-control"
              >
                <option value="">Selecione...</option>
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Justificativa / Observação (Opcional):</label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Ex: Pagamento confirmado via comprovante..."
                className="form-control"
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => setShowStatusModal(false)}
                disabled={updating}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleStatusUpdate}
                disabled={!targetStatus || updating}
              >
                {updating ? 'Salvando...' : 'Confirmar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="modal-overlay" onClick={() => setShowAddProductModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h3>Adicionar Produto ao Romaneio</h3>

            {loadingProducts ? (
              <div className="loading-container">
                <div className="loading-spinner" />
                <p>Carregando produtos...</p>
              </div>
            ) : availableProducts.length === 0 ? (
              <div className="empty-state">
                <p>Todos os produtos do catálogo já estão no romaneio.</p>
              </div>
            ) : (
              <div className="product-grid">
                {availableProducts.map(product => (
                  <div key={product.id} className="product-card">
                    {product.imagem1 ? (
                      <img
                        src={product.imagem1}
                        alt={product.nome}
                        className="product-image"
                      />
                    ) : (
                      <div className="product-image-placeholder">
                        Sem imagem
                      </div>
                    )}
                    <div className="product-info">
                      <h4 className="product-name">
                        {product.nome}
                      </h4>
                      {product.category?.nome && (
                        <p className="product-category">
                          {product.category.nome}
                        </p>
                      )}
                      <p className="product-price">
                        R$ {product.preco?.toFixed(2)}
                      </p>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => addProductToRomaneio(product, 1)}
                      style={{ width: '100%' }}
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => setShowAddProductModal(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documento do Romaneio (imprimível) */}
      <div className="romaneio-document" ref={printRef}>
        {/* Cabeçalho da Empresa */}
        <header className="romaneio-header">
          <div className="header-logo">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" />
            ) : (
              <div className="logo-placeholder">
                <span>{company?.nome_empresa?.charAt(0) || 'A'}</span>
              </div>
            )}
          </div>
          <div className="header-info">
            <h1>{company?.nome_empresa || 'ARTEA JOIAS'}</h1>
            <span>{company?.whatsapp || ''}</span>
            {romaneio.is_admin_purchase && (
              <div className="badge-admin">COMPRA ADMINISTRATIVA</div>
            )}
          </div>
        </header>

        {/* Título do Romaneio */}
        <div className="romaneio-title">
          <h2>
            Romaneio do <strong>{lot?.nome || `Link ${romaneio?.lot_id || ''}`}</strong>
          </h2>
          <span className="pedido-numero">Romaneio nº {romaneio.numero_romaneio || romaneio.numero_pedido}</span>
        </div>

        {/* Dados do Cliente */}
        <div className="cliente-info-box">
          <p><strong>Cliente:</strong> {client?.nome}</p>
          <p><strong>CPF/CNPJ:</strong> {formatCPF(client?.cpf)}</p>
          <p><strong>WhatsApp:</strong> {client?.telefone}</p>
          <p><strong>E-mail:</strong> {client?.email || '-'}</p>
          <p><strong>Data Fechamento:</strong> {formatDate(lot?.updated_at)}</p>
        </div>

        {/* Tabela de Produtos */}
        {/* Tabela de Produtos */}
        <div className="table-responsive">
          <table className="produtos-table">
            <thead>
              <tr>
                <th className="col-img"></th>
                <th className="col-cat">Categoria</th>
                <th className="col-desc">Descrição</th>
                <th className="col-val">Valor</th>
                <th className="col-qty">Qtd</th>
                <th className="col-total">Total</th>
              </tr>
            </thead>
            <tbody>
              {(editMode ? editedItems : items).map((item, index) => (
                <tr key={index}>
                  <td className="col-img">
                    {item.product?.imagem1 ? (
                      <img src={item.product.imagem1} alt="" className="produto-thumb" />
                    ) : (
                      <div className="produto-thumb-placeholder" />
                    )}
                  </td>
                  <td className="col-cat">{item.product?.category?.nome || '-'}</td>
                  <td className="col-desc">{item.product?.descricao || item.product?.nome}</td>
                  <td className="col-val">R$ {(item.valor_unitario || item.preco_unitario || item.product?.preco || 0).toFixed(2)}</td>
                  <td className="col-qty">
                    {editMode ? (
                      <input
                        type="number"
                        min="0"
                        value={item.quantidade}
                        onChange={(e) => updateItemQuantity(item.id, e.target.value)}
                        style={{
                          width: '60px',
                          padding: '4px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          textAlign: 'center'
                        }}
                      />
                    ) : (
                      item.quantidade
                    )}
                  </td>
                  <td className="col-total">R$ {((item.valor_recalculado ?? item.valor_total) || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Resumo Financeiro */}
        <div className="resumo-financeiro">
          <h3>• Valor Total da Compra: R$ {romaneio.valor_total?.toFixed(2)}</h3>
          <ul>
            <li>• Valor Produtos: R$ {romaneio.valor_produtos?.toFixed(2)}</li>
            {romaneio.total_bruto > 0 && romaneio.total_bruto !== romaneio.valor_total && (
              <li>• Total Bruto: R$ {romaneio.total_bruto?.toFixed(2)}</li>
            )}
            {romaneio.taxa_link > 0 && (
              <li>• Taxa Link/Plataforma: R$ {romaneio.taxa_link?.toFixed(2)}</li>
            )}
            {romaneio.desconto_credito > 0 && (
              <li style={{ marginLeft: 16 }}>○ Desconto (crédito anterior): R$ {romaneio.desconto_credito?.toFixed(2)}</li>
            )}
            {romaneio.taxa_separacao > 0 && (
              <li>• Custo Separação: R$ {romaneio.taxa_separacao?.toFixed(2)}</li>
            )}
            {romaneio.valor_frete > 0 && (
              <li>• Frete: R$ {romaneio.valor_frete?.toFixed(2)}</li>
            )}
            <li>• Quantidade Total de Produtos: {romaneio.quantidade_itens}</li>
            {romaneio.total_liquido > 0 && (
              <li style={{ marginTop: 8, fontWeight: 'bold' }}>• Recebido Líquido: R$ {romaneio.total_liquido?.toFixed(2)}</li>
            )}
          </ul>
        </div>

        {/* Dados de Pagamento - CENTRALIZED */}
        <div className="dados-pagamento">
          <h4>Dados para o pagamento:</h4>
          <p><strong>PAGAMENTO VIA PIX OU CARTÃO DE CRÉDITO.</strong></p>
          {pixConfig?.chave && (
            <p><strong>Chave Pix CNPJ:</strong> {pixConfig.chave}</p>
          )}
          {pixConfig?.nome_beneficiario && (
            <p><strong>Beneficiário:</strong> {pixConfig.nome_beneficiario}</p>
          )}
          {pixConfig?.cidade && (
            <p><strong>Cidade:</strong> {pixConfig.cidade}</p>
          )}
          {!pixConfig?.chave && (
            <p style={{ color: '#e63946' }}><strong>PIX não configurado.</strong> Configure em Configurações &gt; Integrações.</p>
          )}
          <p className="importante">
            <strong>IMPORTANTE:</strong> Atenção ao pagamento, deve ser realizado assim que receber o romaneio.
          </p>
          <p className="aviso">
            Caso o pagamento não seja realizado em até 24hs será removido do grupo e terá seu cadastro bloqueado
            permanentemente, ficando impossibilitado de realizar novas compras.
          </p>
        </div>


        {/* Rodapé */}
        <footer className="romaneio-footer">
          <p>Documento gerado em: {formatDate(romaneio.gerado_em || romaneio.created_at)}</p>
        </footer>
      </div>
    </div>
  )
}
