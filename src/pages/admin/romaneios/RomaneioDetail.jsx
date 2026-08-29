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
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Banknote,
  CreditCard,
  Wallet,
  Package
} from 'lucide-react'
import CenteredLoader from '../../../components/common/CenteredLoader'
import { supabase } from '../../../lib/supabase'
import './RomaneioDetail.css'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../../components/common/Toast'
import { generateRomaneioPDF } from '../../../utils/pdfGenerator'
import { calcPrecoClienteNoLote } from '../../../utils/pricing'

const STATUS_OPTIONS = [
  { value: 'aguardando_pagamento', label: 'Aguardando Pagamento', color: 'warning' },
  { value: 'pago_50_pct_s_frete', label: 'Pago Parcialmente sem frete', color: 'warning' },
  { value: 'pago', label: 'Pago sem frete', color: 'warning' },
  { value: 'pago_frete_incluso', label: 'Pago com frete', color: 'success' },
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
  // eslint-disable-next-line no-unused-vars
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false) // Envio via WhatsApp temporariamente oculto da UI

  // Product Addition Controls
  const [availableProducts, setAvailableProducts] = useState([])
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [addVariacaoByProduct, setAddVariacaoByProduct] = useState({})

  // Partial Payments Controls
  const [pagamentos, setPagamentos] = useState([])
  const [loadingPagamentos, setLoadingPagamentos] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [newPayment, setNewPayment] = useState({ valor: '', meio_pagamento: 'pix', observacao: '' })
  const [savingPayment, setSavingPayment] = useState(false)
  const [deletingPaymentId, setDeletingPaymentId] = useState(null)

  // Frete e Código de Rastreio (fechamento do romaneio)
  const [freteInput, setFreteInput] = useState('')
  const [rastreioInput, setRastreioInput] = useState('')
  const [savingEnvio, setSavingEnvio] = useState(false)

  useEffect(() => {
    fetchData()
    fetchPagamentos()
  }, [id])

  useEffect(() => {
    if (romaneio) {
      setFreteInput(romaneio.valor_frete > 0 ? String(romaneio.valor_frete) : '')
      setRastreioInput(romaneio.codigo_rastreio || '')
    }
  }, [romaneio])

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
        .select('id, nome, updated_at, requer_pacote_fechado, adicional_por_produto, escritorio_pct')
        .eq('id', romaneioData.lot_id)
        .single()

      console.log('📦 Lote carregado:', lotData)
      setLot(lotData)

      if (!lotData && romaneioData.lot_id) {
        console.log('⚠️ Lote não encontrado na primeira tentativa. Tentando via RPC (bypass RLS)...')
        const { data: rpcLot, error: rpcError } = await supabase
          .rpc('get_lot_details_v2', { p_lot_id: romaneioData.lot_id })

        console.log('📦 Lote via RPC:', rpcLot)

        if (rpcLot && rpcLot.length > 0) {
          setLot(rpcLot[0])
        } else {
          // Último recurso: tenta pelo nome apenas se o RPC v2 falhar
          const { data: rpcName } = await supabase
            .rpc('get_lot_name_by_id', { p_lot_id: romaneioData.lot_id })
            
          if (rpcName) {
            setLot({ 
              id: romaneioData.lot_id, 
              nome: rpcName,
              adicional_por_produto: 0,
              escritorio_pct: 0
            })
          }
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
          product:products(id, nome, descricao, preco, custo, margem_pct, imagem1, categoria_id, variacoes, category:categories(nome))
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

  // ==================== PAGAMENTOS PARCIAIS ====================
  const fetchPagamentos = async () => {
    setLoadingPagamentos(true)
    try {
      const { data, error } = await supabase
        .from('romaneio_pagamentos')
        .select('*, registrado_por_client:clients!romaneio_pagamentos_registrado_por_fkey(nome)')
        .eq('romaneio_id', id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setPagamentos(data || [])
    } catch (error) {
      console.error('Erro ao carregar pagamentos:', error)
    } finally {
      setLoadingPagamentos(false)
    }
  }

  const handleAddPayment = async () => {
    const valor = parseFloat(newPayment.valor)
    if (!valor || valor <= 0) {
      toast.warning('Informe um valor válido')
      return
    }

    setSavingPayment(true)
    try {
      // Get admin client id
      const { data: adminClient } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      const { error } = await supabase
        .from('romaneio_pagamentos')
        .insert({
          romaneio_id: id,
          valor: valor,
          meio_pagamento: newPayment.meio_pagamento,
          observacao: newPayment.observacao || null,
          registrado_por: adminClient?.id || null
        })

      if (error) throw error

      toast.success(`Pagamento de R$ ${valor.toFixed(2)} registrado!`)
      setNewPayment({ valor: '', meio_pagamento: 'pix', observacao: '' })
      setShowPaymentForm(false)
      await fetchPagamentos()
      await fetchData() // Refresh romaneio to get updated valor_pago
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error)
      toast.error('Erro ao registrar pagamento: ' + error.message)
    } finally {
      setSavingPayment(false)
    }
  }

  const handleDeletePayment = async (paymentId) => {
    try {
      setDeletingPaymentId(paymentId)
      const { error } = await supabase
        .from('romaneio_pagamentos')
        .delete()
        .eq('id', paymentId)

      if (error) throw error

      toast.success('Pagamento removido')
      await fetchPagamentos()
      await fetchData()
    } catch (error) {
      console.error('Erro ao remover pagamento:', error)
      toast.error('Erro ao remover pagamento: ' + error.message)
    } finally {
      setDeletingPaymentId(null)
    }
  }

  const handlePayFullRemaining = async () => {
    const totalPago = pagamentos.reduce((s, p) => s + (p.valor || 0), 0)
    const valorTotal = getValorTotalExib()
    const restante = valorTotal - totalPago
    if (restante <= 0) {
      toast.info('Este romaneio já está totalmente pago')
      return
    }
    setNewPayment(prev => ({ ...prev, valor: restante.toFixed(2) }))
    setShowPaymentForm(true)
  }

  const getValorTotalExib = () => {
    const valorProdutos = Number(romaneio?.valor_produtos ?? 0)
    let taxaSep = Number(romaneio?.taxa_separacao ?? 0)
    if (taxaSep <= 0 && valorProdutos >= 1) taxaSep = valorProdutos <= 80 ? 15 : 25
    const totalComTaxa = valorProdutos + taxaSep + (romaneio?.valor_frete || 0) - (romaneio?.desconto_credito || 0)
    return (Number(romaneio?.valor_total ?? 0) <= valorProdutos && taxaSep > 0) ? totalComTaxa : (romaneio?.valor_total ?? 0)
  }

  const handleSaveEnvio = async () => {
    const freteValue = freteInput === '' ? 0 : parseFloat(freteInput.replace(',', '.'))
    if (Number.isNaN(freteValue) || freteValue < 0) {
      toast.warning('Informe um valor de frete válido')
      return
    }

    setSavingEnvio(true)
    try {
      // Mesma regra automática usada em saveChanges(): recalcula o total
      // final (produtos + separação + frete) para manter valor_total
      // consistente com o novo frete — sem isso, getValorTotalExib()
      // continuaria confiando no valor_total antigo (sem o frete novo).
      const valorProdutos = Number(romaneio.valor_produtos ?? 0)
      let taxaSep = Number(romaneio.taxa_separacao ?? 0)
      if (taxaSep <= 0 && valorProdutos >= 1) taxaSep = valorProdutos <= 80 ? 15 : 25
      const valorTotal = valorProdutos + taxaSep + freteValue - (romaneio.desconto_credito || 0)

      const { error } = await supabase
        .from('romaneios')
        .update({
          valor_frete: freteValue,
          codigo_rastreio: rastreioInput.trim() || null,
          taxa_separacao: taxaSep,
          valor_total: valorTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      toast.success('Frete e rastreio salvos!')
      await fetchData()
    } catch (error) {
      console.error('Erro ao salvar frete/rastreio:', error)
      toast.error('Erro ao salvar: ' + error.message)
    } finally {
      setSavingEnvio(false)
    }
  }

  const getMeioPagamentoLabel = (meio) => {
    const labels = {
      'pix': 'PIX',
      'dinheiro': 'Dinheiro',
      'cartao': 'Cartão',
      'transferencia': 'Transferência',
      'outro': 'Outro'
    }
    return labels[meio] || meio
  }

  const getMeioPagamentoIcon = (meio) => {
    switch (meio) {
      case 'pix': return DollarSign
      case 'dinheiro': return Banknote
      case 'cartao': return CreditCard
      case 'transferencia': return Wallet
      default: return DollarSign
    }
  }

  const enableEditMode = async () => {
    // Recalculate prices for ALL existing items using current lot margins.
    // This ensures the price shown in the UI (with margins) matches what gets saved.
    // Without this, items whose quantity wasn't changed would save the old DB price.
    setEditedItems(items.map(item => {
      const precoCalculado = calcPrecoClienteNoLote(item.product, lot)
      const qty = Number(item.quantidade) || 0
      return {
        ...item,
        preco_unitario: precoCalculado,
        valor_unitario: precoCalculado,
        valor_total: qty * precoCalculado,
        valor_recalculado: qty * precoCalculado
      }
    }))
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
              custo,
              margem_pct,
              imagem1,
              categoria_id,
              variacoes,
              category:categories(nome)
            )
          `)
          .eq('lot_id', romaneio.lot_id)

        if (error) throw error

        // Mostrar todos os produtos do lote (incluindo os que já estão no romaneio)
        // pois o mesmo produto pode ser adicionado com variações diferentes
        const available = lotProducts
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
        const isEmpty = newQuantity === '' || newQuantity == null
        const num = isEmpty ? 0 : Math.max(0, parseInt(newQuantity, 10) || 0)
        const quantidade = isEmpty ? '' : num
        
        // Use centralized pricing: handles null preco (GENERATED column) and lot margins
        const precoArredondado = calcPrecoClienteNoLote(item.product, lot)
        
        const valor_total = num * precoArredondado
        return { ...item, quantidade, valor_total, preco_unitario: precoArredondado, valor_unitario: precoArredondado, valor_recalculado: valor_total }
      }
      return item
    }))
  }

  /** Remove item da lista em edição (excluir produto). Itens novos somem da lista; itens existentes serão deletados ao salvar. */
  const removeItemFromRomaneio = (item) => {
    setEditedItems(prev => prev.filter(i => i.id !== item.id))
    if (!item.isNew) {
      toast.info(`${item.product?.nome || 'Produto'} será removido ao salvar.`)
    }
  }

  const addProductToRomaneio = (product, quantity = 1, variacao = '') => {
    // Use centralized pricing: always applies lot margins correctly
    const precoArredondado = calcPrecoClienteNoLote(product, lot)

    const newItem = {
      id: `temp-${Date.now()}`,
      romaneio_id: id,
      product_id: product.id,
      product: product,
      quantidade: quantity,
      valor_unitario: precoArredondado,
      preco_unitario: precoArredondado,
      valor_total: precoArredondado * quantity,
      variacao: (variacao || '').trim() || null,
      valor_recalculado: precoArredondado * quantity,
      isNew: true // Flag to identify new items
    }

    setEditedItems(prev => [...prev, newItem])

    // Não remove o produto da lista — apenas fecha o modal
    // O mesmo produto pode ser adicionado com outra variação
    toast.success(`${product.nome}${variacao ? ` (${variacao})` : ''} adicionado ao romaneio`)
    setShowAddProductModal(false)
  }

  const saveChanges = async () => {
    try {
      setSaving(true)

      // Separate new items from existing items
      const newItems = editedItems.filter(item => item.isNew)
      const existingEdited = editedItems.filter(item => !item.isNew)
      const idsKept = new Set(existingEdited.map(i => i.id))

      // Insert new items into database
      for (const item of newItems) {
        const qty = Number(item.quantidade) || 0
        if (qty <= 0) continue
        const { error } = await supabase
          .from('romaneio_items')
          .insert({
            romaneio_id: id,
            product_id: item.product_id,
            quantidade: qty,
            preco_unitario: item.preco_unitario ?? item.valor_unitario,
            valor_recalculado: item.valor_recalculado,
            variacao: item.variacao || null
          })

        if (error) throw error
      }

      // Delete: itens removidos da lista ou com quantidade 0/vazia
      const qtyZeroOrEmpty = (i) => i.quantidade === '' || i.quantidade == null || Number(i.quantidade) <= 0
      const itemsToDelete = items.filter(orig => {
        if (!idsKept.has(orig.id)) return true
        const ed = existingEdited.find(e => e.id === orig.id)
        return ed && qtyZeroOrEmpty(ed)
      })
      const itemsToUpdate = existingEdited.filter(item => Number(item.quantidade) > 0)

      for (const item of itemsToDelete) {
        const { error } = await supabase
          .from('romaneio_items')
          .delete()
          .eq('id', item.id)

        if (error) throw error
      }

      // Update existing items with valid quantity
      for (const item of itemsToUpdate) {
        const qty = Number(item.quantidade) || 0
        const { error } = await supabase
          .from('romaneio_items')
          .update({
            quantidade: qty,
            preco_unitario: item.preco_unitario ?? item.valor_unitario, // added this to fix old broken values
            valor_recalculado: item.valor_total,
            variacao: item.variacao ?? null
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

  // Envio de WhatsApp temporariamente oculto da UI (função preservada para reativação futura)
  // eslint-disable-next-line no-unused-vars
  const sendWhatsAppWithPDF = async () => {
    if (!client?.telefone) {
      toast.error('Cliente não possui telefone cadastrado')
      return
    }

    try {
      setSendingWhatsApp(true)

      console.log('📄 Gerando PDF do romaneio...')

      // Generate PDF
      const pdfBlob = await generateRomaneioPDF({
        romaneio,
        lot,
        client,
        items,
        company,
        pixConfig
      })

      // Convert Blob to Base64 for WhatsApp API
      const pdfBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(pdfBlob);
      });

      console.log('✅ PDF gerado:', pdfBase64 ? `${pdfBase64.length} caracteres` : 'VAZIO')

      if (!pdfBase64) throw new Error('Falha ao gerar PDF para WhatsApp')

      // Prepare message about availability
      const unavailableItems = items.filter(item => item.quantidade === 0)
      const availableItems = items.filter(item => item.quantidade > 0)

      console.log('🔍 Dados do lote:', lot)
      const lotName = (lot?.nome || 'Link').trim()
      console.log('📝 Nome do lote usado:', lotName)

      const valorProdutos = Number(romaneio.valor_produtos ?? 0)
      let taxaSep = Number(romaneio.taxa_separacao ?? 0)
      if (taxaSep <= 0 && valorProdutos >= 1) taxaSep = valorProdutos <= 80 ? 15 : 25
      const totalComTaxa = valorProdutos + taxaSep + (romaneio.valor_frete || 0) - (romaneio.desconto_credito || 0)
      const valorTotalExib = (Number(romaneio.valor_total ?? 0) <= valorProdutos && taxaSep > 0) ? totalComTaxa : (romaneio.valor_total ?? 0)

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

        message += `\n💰 *Valor Total Atualizado:* R$ ${valorTotalExib.toFixed(2)}\n\n`
      } else {
        message += `📋 Pedido: ${romaneio.numero_romaneio || romaneio.numero_pedido}\n`
        message += `💰 Valor Total: R$ ${valorTotalExib.toFixed(2)}\n\n`
      }

      message += `Pedimos a gentileza de conferir as peças relacionadas neste romaneio e, em seguida, realizar o pagamento de acordo com os dados anexos.\n\n`
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

      const pdfBlob = await generateRomaneioPDF({
        romaneio,
        lot,
        client,
        items,
        company,
        pixConfig
      })

      if (!pdfBlob) throw new Error('Falha ao gerar PDF')

      // Use Blob Url to download directly
      const blobUrl = URL.createObjectURL(pdfBlob)
      
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `Romaneio-${romaneio.numero_romaneio || romaneio.id.slice(-6)}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Cleanup
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)

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
        'pago_50_pct_s_frete': '💸 Marcado como Pago Parcialmente sem frete!',
        'pago': '🟠 Marcado como Pago sem frete!',
        'pago_frete_incluso': '✅ Marcado como Pago com frete!',
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

  // Envio de WhatsApp temporariamente oculto da UI (função preservada para reativação futura)
  // eslint-disable-next-line no-unused-vars
  const openWhatsApp = () => {
    if (!client?.telefone) return

    const valorProdutos = Number(romaneio.valor_produtos ?? 0)
    let taxaSep = Number(romaneio.taxa_separacao ?? 0)
    if (taxaSep <= 0 && valorProdutos >= 1) taxaSep = valorProdutos <= 80 ? 15 : 25
    const totalComTaxa = valorProdutos + taxaSep + (romaneio.valor_frete || 0) - (romaneio.desconto_credito || 0)
    const valorTotalExib = (Number(romaneio.valor_total ?? 0) <= valorProdutos && taxaSep > 0) ? totalComTaxa : (romaneio.valor_total ?? 0)

    const phone = client.telefone.replace(/\D/g, '')
    const message = encodeURIComponent(
      `Olá ${client.nome}! 🌟\n\n` +
      `Seu romaneio do *${(lot?.nome || 'Link').trim()}* está pronto!\n\n` +
      `📋 Pedido: ${romaneio?.numero_romaneio || romaneio?.numero_pedido}\n` +
      `💰 Valor Total: R$ ${valorTotalExib.toFixed(2)}\n\n` +
      `Pedimos a gentileza de conferir as peças relacionadas neste romaneio e, em seguida, realizar o pagamento de acordo com os dados anexos.\n\n` +
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

  const formatCpfCnpj = (value) => {
    if (!value) return '-'
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    } else if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    }
    return value
  }

  const formatPhone = (phone) => {
    if (!phone) return '-'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  if (loading) {
    return <CenteredLoader fullHeight text="Carregando romaneio..." />
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
              {/* Envio via WhatsApp temporariamente oculto da UI (função preservada no arquivo) */}
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
                disabled={loadingProducts}
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
            <><CheckCircle size={18} /> Pago sem frete</>
          ) : romaneio.status_pagamento === 'pago_frete_incluso' ? (
            <><CheckCircle size={18} /> Pago com frete</>
          ) : ['aguardando', 'aguardando_pagamento'].includes(romaneio.status_pagamento) ? (
            <><Clock size={18} /> Aguardando Pagamento</>
          ) : (
            <><DollarSign size={18} /> Pendente</>
          )}
        </div>

        <div className="payment-actions">
          {!['pago', 'pago_frete_incluso'].includes(romaneio.status_pagamento) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                const pixKey = pixConfig?.chave
                if (pixKey) {
                  navigator.clipboard.writeText(pixKey)
                  toast.success('Chave PIX copiada!')
                } else {
                  toast.warning('Chave PIX não configurada. Configure em Configurações > Integrações.')
                }
              }}
            >
              <DollarSign size={14} /> Copiar PIX
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowStatusModal(true)}
          >
            <CheckCircle size={14} /> Alterar Status
          </button>
        </div>
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
                <CenteredLoader />
              </div>
            ) : availableProducts.length === 0 ? (
              <div className="empty-state">
                <p>Nenhum produto encontrado no catálogo deste romaneio.</p>
              </div>
            ) : (
              <div className="romaneio-product-grid">
                {availableProducts.map(product => {
                  const variacoesList = product.variacoes ? String(product.variacoes).split(',').map(s => s.trim()).filter(Boolean) : []
                  const selectedVar = addVariacaoByProduct[product.id] ?? (variacoesList[0] ?? '')

                  // Verificar quais combinações produto+variação já estão no romaneio
                  const jaNoRomaneio = (variacao) => editedItems.some(
                    i => i.product_id === product.id && (i.variacao ?? '') === (variacao ?? '')
                  )

                  // Se o produto não tem variações, checar se já foi adicionado (sem variação)
                  const semVariacao = variacoesList.length === 0
                  const jaAdicionadoSemVariacao = semVariacao && jaNoRomaneio('')
                  const variacaoSelecionadaJaAdicionada = !semVariacao && jaNoRomaneio(selectedVar)
                  const desabilitarBotao = semVariacao ? jaAdicionadoSemVariacao : variacaoSelecionadaJaAdicionada

                  return (
                  <div key={product.id} className="romaneio-product-card">
                    {product.imagem1 ? (
                      <img loading="lazy"
                        src={product.imagem1}
                        alt={product.nome}
                        className="romaneio-product-image"
                      />
                    ) : (
                      <div className="romaneio-product-image-placeholder">
                        Sem imagem
                      </div>
                    )}
                    <div className="romaneio-product-info">
                      <h4 className="romaneio-product-name">
                        {product.nome}
                      </h4>
                      {product.category?.nome && (
                        <p className="romaneio-product-category">
                          {product.category.nome}
                        </p>
                      )}
                      <p className="romaneio-product-price">
                        R$ {calcPrecoClienteNoLote(product, lot).toFixed(2)}
                      </p>
                      {variacoesList.length > 0 && (
                        <div className="romaneio-product-variacao">
                          <label>Variação:</label>
                          <select
                            value={selectedVar}
                            onChange={(e) => setAddVariacaoByProduct(prev => ({ ...prev, [product.id]: e.target.value }))}
                            style={{ marginTop: 4, padding: '4px 8px', width: '100%', borderRadius: 4 }}
                          >
                            {variacoesList.map(opt => (
                              <option key={opt} value={opt}>
                                {opt}{jaNoRomaneio(opt) ? ' ✓ já adicionado' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {jaAdicionadoSemVariacao && (
                        <p style={{ fontSize: 12, color: '#059669', marginTop: 4, fontWeight: 600 }}>✓ Já no romaneio</p>
                      )}
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => addProductToRomaneio(product, 1, selectedVar)}
                      style={{ width: '100%' }}
                      disabled={desabilitarBotao}
                      title={desabilitarBotao ? 'Esta variação já está no romaneio' : 'Adicionar ao romaneio'}
                    >
                      <Plus size={14} /> {desabilitarBotao ? 'Já Adicionado' : 'Adicionar'}
                    </button>
                  </div>
                  )
                })}
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
              <img src={company.logo_url} alt="Logo" loading="lazy" />
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
          <p><strong>CPF/CNPJ:</strong> {formatCpfCnpj(client?.cpf)}</p>
          <p><strong>WhatsApp:</strong> {formatPhone(client?.telefone)}</p>
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
                <th className="col-var">Variação</th>
                <th className="col-val">Valor</th>
                <th className="col-qty">Qtd</th>
                <th className="col-total">Total</th>
                {editMode && <th className="col-action no-print">Ação</th>}
              </tr>
            </thead>
            <tbody>
              {(editMode ? editedItems : items).map((item, index) => (
                <tr key={item.id || index}>
                  <td className="col-img">
                    {item.product?.imagem1 ? (
                      <img src={item.product.imagem1} alt="" className="produto-thumb" loading="lazy" />
                    ) : (
                      <div className="produto-thumb-placeholder" />
                    )}
                  </td>
                  <td className="col-cat">{item.product?.category?.nome || '-'}</td>
                  <td className="col-desc">{item.product?.descricao || item.product?.nome}</td>
                  <td className="col-var">{item.variacao || '-'}</td>
                  <td className="col-val">
                    {(() => {
                      // Use centralized pricing for consistent display
                      const precoBase = Number(item.product?.preco) || 0
                      const precoCliente = calcPrecoClienteNoLote(item.product, lot)
                      const adicional = Number(lot?.adicional_por_produto) || 0
                      const escritorio = Number(lot?.escritorio_pct) || 0
                      
                      // In edit mode with lot margins, show both base and client price
                      if ((adicional > 0 || escritorio > 0) && editMode && precoBase > 0) {
                        return (
                          <span title={`Seu preço: R$ ${precoBase.toFixed(2)} | Porcentagem aplicada sobre o produto | Cliente vê: R$ ${precoCliente.toFixed(2)}`}>
                            R$ {precoBase.toFixed(2)}
                            <br/>
                            <small style={{ color: '#059669', fontSize: '10px', fontWeight: 600 }}>
                              cliente: R$ {precoCliente.toFixed(2)}
                            </small>
                          </span>
                        )
                      }
                      
                      // Show the final price: prefer saved preco_unitario, fallback to calculated
                      const exibido = (item.preco_unitario != null && item.preco_unitario > 0) ? item.preco_unitario : precoCliente
                      return <>R$ {exibido.toFixed(2)}</>
                    })()}
                  </td>
                  <td className="col-qty">
                    {editMode ? (
                      <div className="romaneio-qty-control">
                        <button
                          type="button"
                          className="romaneio-qty-btn"
                          onClick={() => {
                            const cur = item.quantidade === '' || item.quantidade == null ? 0 : Number(item.quantidade) || 0
                            updateItemQuantity(item.id, String(Math.max(0, cur - 1)))
                          }}
                          title="Diminuir"
                          aria-label="Diminuir quantidade"
                        >
                          <ChevronDown size={18} />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={item.quantidade === '' || item.quantidade == null ? '' : item.quantidade}
                          onChange={(e) => updateItemQuantity(item.id, e.target.value)}
                          className="romaneio-qty-input"
                          aria-label="Quantidade"
                        />
                        <button
                          type="button"
                          className="romaneio-qty-btn"
                          onClick={() => {
                            const cur = item.quantidade === '' || item.quantidade == null ? 0 : Number(item.quantidade) || 0
                            updateItemQuantity(item.id, String(cur + 1))
                          }}
                          title="Aumentar"
                          aria-label="Aumentar quantidade"
                        >
                          <ChevronUp size={18} />
                        </button>
                      </div>
                    ) : (
                      item.quantidade
                    )}
                  </td>
                  <td className="col-total">R$ {((item.valor_recalculado ?? item.valor_total) || 0).toFixed(2)}</td>
                  {editMode && (
                    <td className="col-action no-print">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm btn-delete-item"
                        onClick={() => removeItemFromRomaneio(item)}
                        title="Excluir produto do romaneio"
                        style={{ minWidth: 36, minHeight: 36, padding: '6px', color: '#dc2626', borderColor: '#fca5a5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={16} color="#dc2626" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Frete e Código de Rastreio (fechamento do romaneio) */}
        <div className="envio-section no-print">
          <h3><Package size={18} /> Frete e Rastreio</h3>
          <div className="envio-form-row">
            <div className="envio-form-field">
              <label>Frete (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={freteInput}
                onChange={(e) => setFreteInput(e.target.value)}
                className="form-control"
              />
            </div>
            <div className="envio-form-field envio-form-field-rastreio">
              <label>Código de Rastreio (opcional)</label>
              <input
                type="text"
                placeholder="Ex: BR123456789XX"
                value={rastreioInput}
                onChange={(e) => setRastreioInput(e.target.value)}
                className="form-control"
              />
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveEnvio}
              disabled={savingEnvio}
            >
              {savingEnvio ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Resumo Financeiro - custo de separação calculado quando não gravado (15 até R$80, 25 acima) */}
        {(() => {
          const valorProdutos = Number(romaneio.valor_produtos ?? 0)
          let taxaSep = Number(romaneio.taxa_separacao ?? 0)
          if (taxaSep <= 0 && valorProdutos >= 1) taxaSep = valorProdutos <= 80 ? 15 : 25
          const totalComTaxa = valorProdutos + taxaSep + (romaneio.valor_frete || 0) - (romaneio.desconto_credito || 0)
          const valorTotalExib = (Number(romaneio.valor_total ?? 0) <= valorProdutos && taxaSep > 0) ? totalComTaxa : (romaneio.valor_total ?? 0)
          return (
        <div className="resumo-financeiro">
          <h3>• Valor {romaneio.status_pagamento === 'pago_50_pct_s_frete' ? 'Restante (50%)' : 'Total'} da Compra: R$ {(romaneio.status_pagamento === 'pago_50_pct_s_frete' ? valorTotalExib / 2 : valorTotalExib).toFixed(2)}</h3>
          <ul>
            <li>• Valor Produtos: R$ {valorProdutos.toFixed(2)}</li>
            {romaneio.total_bruto > 0 && romaneio.total_bruto !== romaneio.valor_total && (
              <li>• Total Bruto: R$ {romaneio.total_bruto?.toFixed(2)}</li>
            )}
            {romaneio.taxa_link > 0 && (
              <li>• Taxa Link/Plataforma: R$ {romaneio.taxa_link?.toFixed(2)}</li>
            )}
            {romaneio.desconto_credito > 0 && (
              <li style={{ marginLeft: 16 }}>○ Desconto (crédito anterior): R$ {romaneio.desconto_credito?.toFixed(2)}</li>
            )}
            {taxaSep > 0 && (
              <li>• Custo Separação: R$ {taxaSep.toFixed(2)}</li>
            )}
            {romaneio.valor_frete > 0 && (
              <li>• Frete: R$ {romaneio.valor_frete?.toFixed(2)}</li>
            )}
            {romaneio.codigo_rastreio && (
              <li>• Código de Rastreio: {romaneio.codigo_rastreio}</li>
            )}
            <li>• Quantidade Total de Produtos: {romaneio.quantidade_itens}</li>
            {romaneio.total_liquido > 0 && (
              <li style={{ marginTop: 8, fontWeight: 'bold' }}>• Recebido Líquido: R$ {romaneio.total_liquido?.toFixed(2)}</li>
            )}
          </ul>
        </div>
          )
        })()}

        {/* ==================== SEÇÃO DE PAGAMENTOS PARCIAIS ==================== */}
        {(() => {
          const totalPago = pagamentos.reduce((s, p) => s + (p.valor || 0), 0)
          const valorTotal = getValorTotalExib()
          const saldoRestante = Math.max(0, valorTotal - totalPago)
          const porcentagemPaga = valorTotal > 0 ? Math.min(100, (totalPago / valorTotal) * 100) : 0
          const quitado = saldoRestante <= 0.01 && totalPago > 0

          return (
        <div className="pagamentos-section no-print">
          <div className="pagamentos-header">
            <h3><Wallet size={20} /> Pagamentos</h3>
            <div className="pagamentos-resumo-badges">
              <span className="pagamento-badge pagamento-badge-pago">
                Pago: R$ {totalPago.toFixed(2)}
              </span>
              {!quitado && (
                <span className="pagamento-badge pagamento-badge-restante">
                  Restante: R$ {saldoRestante.toFixed(2)}
                </span>
              )}
              {quitado && (
                <span className="pagamento-badge pagamento-badge-quitado">
                  <CheckCircle size={14} /> Quitado
                </span>
              )}
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="pagamento-progress-container">
            <div className="pagamento-progress-bar">
              <div
                className={`pagamento-progress-fill ${quitado ? 'quitado' : ''}`}
                style={{ width: `${porcentagemPaga}%` }}
              />
            </div>
            <span className="pagamento-progress-label">
              {porcentagemPaga.toFixed(0)}% pago
            </span>
          </div>

          {/* Lista de pagamentos */}
          {loadingPagamentos ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Loader2 size={20} className="spin" /> Carregando...
            </div>
          ) : pagamentos.length > 0 ? (
            <div className="pagamentos-lista">
              {pagamentos.map((pag, idx) => {
                const MeioIcon = getMeioPagamentoIcon(pag.meio_pagamento)
                return (
                  <div key={pag.id} className="pagamento-item">
                    <div className="pagamento-item-icon">
                      <MeioIcon size={18} />
                    </div>
                    <div className="pagamento-item-info">
                      <div className="pagamento-item-top">
                        <strong>R$ {pag.valor?.toFixed(2)}</strong>
                        <span className="pagamento-meio-badge">
                          {getMeioPagamentoLabel(pag.meio_pagamento)}
                        </span>
                      </div>
                      <div className="pagamento-item-bottom">
                        <span className="pagamento-data">
                          {new Date(pag.created_at).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        {pag.observacao && (
                          <span className="pagamento-obs">— {pag.observacao}</span>
                        )}
                        {pag.registrado_por_client?.nome && (
                          <span className="pagamento-registrado">por {pag.registrado_por_client.nome}</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="btn btn-outline btn-sm pagamento-delete-btn"
                      onClick={() => handleDeletePayment(pag.id)}
                      disabled={deletingPaymentId === pag.id}
                      title="Remover pagamento"
                    >
                      {deletingPaymentId === pag.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="pagamentos-empty">Nenhum pagamento registrado ainda.</p>
          )}

          {/* Formulário de novo pagamento */}
          {showPaymentForm ? (
            <div className="pagamento-form">
              <h4>Registrar Pagamento</h4>
              <div className="pagamento-form-row">
                <div className="pagamento-form-field">
                  <label>Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={newPayment.valor}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, valor: e.target.value }))}
                    className="form-control"
                    autoFocus
                  />
                </div>
                <div className="pagamento-form-field">
                  <label>Meio</label>
                  <select
                    value={newPayment.meio_pagamento}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, meio_pagamento: e.target.value }))}
                    className="form-control"
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartão</option>
                    <option value="transferencia">Transferência</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>
              <div className="pagamento-form-field" style={{ marginTop: 8 }}>
                <label>Observação (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Comprovante recebido via WhatsApp"
                  value={newPayment.observacao}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, observacao: e.target.value }))}
                  className="form-control"
                />
              </div>
              <div className="pagamento-form-actions">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => { setShowPaymentForm(false); setNewPayment({ valor: '', meio_pagamento: 'pix', observacao: '' }) }}
                  disabled={savingPayment}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddPayment}
                  disabled={savingPayment || !newPayment.valor}
                >
                  {savingPayment ? <><Loader2 size={14} className="spin" /> Salvando...</> : <><CheckCircle size={14} /> Confirmar</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="pagamento-actions-row">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowPaymentForm(true)}
              >
                <Plus size={14} /> Registrar Pagamento
              </button>
              {!quitado && totalPago > 0 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handlePayFullRemaining}
                >
                  <CheckCircle size={14} /> Quitar Restante (R$ {saldoRestante.toFixed(2)})
                </button>
              )}
              {!quitado && totalPago === 0 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handlePayFullRemaining}
                >
                  <DollarSign size={14} /> Pagar Total
                </button>
              )}
            </div>
          )}
        </div>
          )
        })()}

        {/* Dados de Pagamento - CENTRALIZED */}
        <div className="dados-pagamento">
          <h4>Dados para o pagamento:</h4>
          <p><strong>PAGAMENTO VIA PIX OU CARTÃO DE CRÉDITO.</strong></p>
          {pixConfig?.chave && (
            <p>
              <strong>
                {pixConfig.chave.replace(/\D/g, '').length === 11 
                  ? 'Chave Pix (CPF): ' 
                  : pixConfig.chave.replace(/\D/g, '').length === 14 
                    ? 'Chave Pix (CNPJ): ' 
                    : 'Chave Pix: '}
              </strong>
              {pixConfig.chave.replace(/\D/g, '').length === 11 || pixConfig.chave.replace(/\D/g, '').length === 14
                ? formatCpfCnpj(pixConfig.chave)
                : pixConfig.chave}
            </p>
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
