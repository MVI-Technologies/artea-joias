import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { 
  ArrowLeft, 
  RefreshCw, 
  Plus, 
  Search, 
  Copy, 
  ChevronDown, 
  X, 
  Edit, 
  MessageCircle, 
  Image, 
  Link as LinkIcon, 
  Trash2, 
  Users, 
  Package,
  DollarSign,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle,
  FileText,
  Settings,
  Lock,
  ClipboardList,
  MoreVertical,
  CheckSquare,
  Bell,
  Loader2,
  Save,
  TrendingUp
} from 'lucide-react'
import ImageUpload from '../../../components/common/ImageUpload'
import { supabase } from '../../../lib/supabase'
import { notifyCatalogClosed } from '../../../services/whatsapp'
import './LotDetail.css'

export default function LotDetail({ defaultTab }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [lot, setLot] = useState(null)
  const [products, setProducts] = useState([])
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('todas')
  const [categories, setCategories] = useState([])
  const [activeTab, setActiveTab] = useState(defaultTab || searchParams.get('tab') || 'produtos')
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [availableProducts, setAvailableProducts] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [lotSettings, setLotSettings] = useState({})
  const [closing, setClosing] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [separacaoItems, setSeparacaoItems] = useState({}) // { order_id: boolean }
  
  // States para confirmação e notificação
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [notifyOnClose, setNotifyOnClose] = useState(true)
  const [sendingNotification, setSendingNotification] = useState(false)
  const [notification, setNotification] = useState(null)
  
  // States para status de produtos fracionados
  const [productCompletionStatus, setProductCompletionStatus] = useState({
    total: 0,
    complete: 0,
    incomplete: 0,
    fractionalProducts: []
  })
  
  // States para gerenciamento de produtos
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState({
    nome: '',
    descricao: '',
    preco: '',
    categoria_id: '',
    tipo_venda: 'individual',
    quantidade_pacote: 12,
    imagem1: '',
    variacoes: '',
    observacoes: '',
    qtd_minima_fornecedor: 1,
    qtd_maxima_fornecedor: '',
    qtd_minima_cliente: 1,
    multiplo_pacote: 1,
    posicao_catalogo: 0,
    anotacoes_internas: '',
    revisar_produto: false,
    registrar_peso: false,
    registrar_preco_custo: false
  })
  const [savingProduct, setSavingProduct] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      // Buscar lote
      const { data: lotData, error: lotError } = await supabase
        .from('lots')
        .select('*')
        .eq('id', id)
        .single()

      if (lotError) throw lotError
      setLot(lotData)
      setLotSettings(lotData)

      // Buscar produtos do lote
      const { data: lotProducts, error: lpError } = await supabase
        .from('lot_products')
        .select(`
          *,
          product:products(*, category:categories(*))
        `)
        .eq('lot_id', id)

      if (lpError) throw lpError
      setProducts(lotProducts || [])

      // Buscar reservas agrupadas por cliente
      const { data: reservasData, error: resError } = await supabase
        .from('reservas')
        .select(`
          *,
          client:clients(id, nome, telefone, email),
          product:products(id, nome, preco, imagem1)
        `)
        .eq('lot_id', id)
        .eq('status', 'confirmada')
        .order('created_at', { ascending: false })

      if (!resError) {
        // Agrupar reservas por cliente
        const grouped = (reservasData || []).reduce((acc, res) => {
          const clientId = res.client_id
          if (!acc[clientId]) {
            acc[clientId] = {
              client: res.client,
              items: [],
              total: 0,
              quantidade: 0
            }
          }
          acc[clientId].items.push(res)
          acc[clientId].total += res.valor_total
          acc[clientId].quantidade += res.quantidade
          return acc
        }, {})
        setReservas(Object.values(grouped))
      }

      // Buscar categorias
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('ativo', true)
        .order('nome')

      setCategories(cats || [])
      
      // Calcular status de produtos fracionados
      calculateProductCompletionStatus(lotProducts || [])
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // Calcular status de completude dos produtos fracionados
  const calculateProductCompletionStatus = (lotProducts) => {
    const fractionalProducts = lotProducts.filter(lp => 
      lp.product?.tipo_venda === 'pacote'
    )
    
    if (fractionalProducts.length === 0) {
      setProductCompletionStatus({
        total: 0,
        complete: 0,
        incomplete: 0,
        fractionalProducts: []
      })
      return
    }
    
    const statusData = fractionalProducts.map(lp => {
      const minimo = lp.product?.quantidade_pacote || 12
      const atual = lp.quantidade_pedidos || 0
      const complete = atual >= minimo
      
      return {
        id: lp.product.id,
        nome: lp.product.nome,
        minimo,
        atual,
        faltam: Math.max(0, minimo - atual),
        progresso: Math.min(100, (atual / minimo) * 100),
        complete
      }
    })
    
    setProductCompletionStatus({
      total: fractionalProducts.length,
      complete: statusData.filter(p => p.complete).length,
      incomplete: statusData.filter(p => !p.complete).length,
      fractionalProducts: statusData
    })
  }

  const fetchAvailableProducts = async () => {
    try {
      // Buscar produtos que não estão no lote
      const { data: allProducts } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .eq('ativo', true)
        .order('nome')

      const lotProductIds = products.map(lp => lp.product_id)
      const available = (allProducts || []).filter(p => !lotProductIds.includes(p.id))
      setAvailableProducts(available)
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
    }
  }

  const copyLink = () => {
    const link = `${window.location.origin}/catalogo/${lot?.link_compra || id}`
    navigator.clipboard.writeText(link)
    showNotification('success', 'Link copiado para a área de transferência!')
  }

  const addProductsToLot = async () => {
    if (selectedProducts.length === 0) return

    try {
      const inserts = selectedProducts.map(productId => ({
        lot_id: id,
        product_id: productId,
        quantidade_pedidos: 0,
        quantidade_clientes: 0
      }))

      const { error } = await supabase
        .from('lot_products')
        .insert(inserts)

      if (error) throw error

      setShowAddProductModal(false)
      setSelectedProducts([])
      fetchData()
    } catch (error) {
      console.error('Erro ao adicionar produtos:', error)
      alert('Erro ao adicionar produtos')
    }
  }

  const updateLotSettings = async () => {
    try {
      const { error } = await supabase
        .from('lots')
        .update({
          nome: lotSettings.nome,
          descricao: lotSettings.descricao,
          data_fim: lotSettings.data_fim,
          taxa_separacao: lotSettings.taxa_separacao,
          requer_pacote_fechado: lotSettings.requer_pacote_fechado,
          chave_pix: lotSettings.chave_pix,
          nome_beneficiario: lotSettings.nome_beneficiario,
          mensagem_pagamento: lotSettings.mensagem_pagamento,
          telefone_financeiro: lotSettings.telefone_financeiro
        })
        .eq('id', id)

      if (error) throw error

      setShowSettingsModal(false)
      fetchData()
    } catch (error) {
      console.error('Erro ao atualizar:', error)
      alert('Erro ao atualizar configurações')
    }
  }

  // Mostrar notificação toast
  const showNotification = (type, message) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  // Abrir modal de confirmação para fechar
  const openCloseConfirmation = () => {
    // Verificar se há pacotes incompletos
    if (lot?.requer_pacote_fechado) {
      const pacotesIncompletos = products.filter(lp => {
        const product = lp.product
        if (product?.tipo_venda === 'pacote') {
          const qtdPacote = product.quantidade_pacote || 12
          return (lp.quantidade_pedidos || 0) % qtdPacote !== 0
        }
        return false
      })

      if (pacotesIncompletos.length > 0) {
        showNotification('error', 'Existem pacotes incompletos. O link não pode ser fechado.')
        return
      }
    }

    setConfirmAction('close')
    setShowConfirmModal(true)
  }

  // Executar fechamento do lote
  const closeLot = async () => {
    setShowConfirmModal(false)
    setClosing(true)
    
    try {
      // Primeiro tenta atualizar com select
      let updatedLot = null
      const { data, error } = await supabase
        .from('lots')
        .update({ status: 'fechado' })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        // Se der erro no trigger de romaneios, tenta sem select
        console.warn('Erro no update com select, tentando sem:', error.message)
        
        const { error: error2 } = await supabase
          .from('lots')
          .update({ status: 'fechado' })
          .eq('id', id)
        
        if (error2) throw error2
        
        // Busca os dados atualizados
        const { data: lotData } = await supabase
          .from('lots')
          .select('*')
          .eq('id', id)
          .single()
        
        updatedLot = lotData
      } else {
        updatedLot = data
      }

      // Enviar notificação se marcado
      if (notifyOnClose) {
        setSendingNotification(true)
        
        try {
          const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select('id, nome, telefone')
            .eq('role', 'cliente')
            .not('telefone', 'is', null)
          
          if (!clientsError && clients && clients.length > 0) {
            const result = await notifyCatalogClosed(updatedLot, clients)
            
            if (result.success) {
              showNotification('success', `Link fechado! ${result.data?.success || clients.length} cliente(s) notificado(s).`)
            } else {
              showNotification('warning', `Link fechado, mas erro ao notificar: ${result.error}`)
            }
          } else {
            showNotification('success', 'Link fechado com sucesso!')
          }
        } catch (notifyError) {
          console.error('Erro ao notificar:', notifyError)
          showNotification('warning', 'Link fechado, mas erro ao enviar notificações.')
        } finally {
          setSendingNotification(false)
        }
      } else {
        showNotification('success', 'Link fechado com sucesso!')
      }

      fetchData()
    } catch (error) {
      console.error('Erro ao fechar:', error)
      showNotification('error', 'Erro ao fechar link. Tente novamente.')
    } finally {
      setClosing(false)
    }
  }

  // Abrir confirmação para remover produto
  const openRemoveProductConfirm = (lpId) => {
    setConfirmAction({ type: 'removeProduct', lpId })
    setShowConfirmModal(true)
  }

  // Executar remoção de produto
  const executeRemoveProduct = async () => {
    const lpId = confirmAction.lpId
    setShowConfirmModal(false)
    try {
      await supabase.from('lot_products').delete().eq('id', lpId)
      fetchData()
      showNotification('success', 'Produto removido do link.')
    } catch (error) {
      showNotification('error', 'Erro ao remover produto.')
    }
  }

  // Abrir confirmação para deletar produto
  const openDeleteProductConfirm = (productId) => {
    setConfirmAction({ type: 'deleteProduct', productId })
    setShowConfirmModal(true)
  }

  // Executar deleção de produto
  const executeDeleteProduct = async () => {
    const productId = confirmAction.productId
    setShowConfirmModal(false)
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error
      fetchData()
      showNotification('success', 'Produto excluído permanentemente.')
    } catch (error) {
      console.error('Erro ao excluir produto:', error)
      showNotification('error', 'Erro ao excluir. Verifique se não há reservas.')
    }
  }

  // Handler do modal de confirmação
  const handleConfirm = () => {
    if (confirmAction === 'close') {
      closeLot()
    } else if (confirmAction?.type === 'removeProduct') {
      executeRemoveProduct()
    } else if (confirmAction?.type === 'deleteProduct') {
      executeDeleteProduct()
    }
  }

  // Duplicar lote
  const duplicateLot = async () => {
    setShowActionsMenu(false)
    
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
      if (products && products.length > 0) {
        const newLotProducts = products.map(lp => ({
          lot_id: data.id,
          product_id: lp.product_id,
          quantidade_pedidos: 0,
          quantidade_clientes: 0
        }))
        
        await supabase.from('lot_products').insert(newLotProducts)
      }
      
      showNotification('success', 'Catálogo duplicado com sucesso!')
      navigate(`/admin/lotes/${data.id}`)
    } catch (error) {
      console.error('Erro ao duplicar:', error)
      showNotification('error', 'Erro ao duplicar catálogo')
    }
  }

  // ========================================
  // FUNÇÕES DE GERENCIAMENTO DE PRODUTOS
  // ========================================

  const openCreateProductModal = () => {
    setEditingProduct(null)
    setProductForm({
      nome: '',
      descricao: '',
      preco: '',
      categoria_id: '',
      tipo_venda: 'individual',
      quantidade_pacote: 12,
      imagem1: '',
      // Novos campos UI Ref
      variacoes: '',
      observacoes: '', // Descrição longa
      qtd_minima_fornecedor: 1,
      qtd_maxima_fornecedor: '',
      qtd_minima_cliente: 1,
      multiplo_pacote: 1,
      posicao_catalogo: 0,
      anotacoes_internas: '',
      revisar_produto: false,
      registrar_peso: false,
      registrar_preco_custo: false
    })
    setShowProductModal(true)
  }

  const openEditProductModal = (product) => {
    setEditingProduct(product)
    setProductForm({
      nome: product.nome || '',
      descricao: product.descricao || '',
      preco: product.preco || '',
      categoria_id: product.categoria_id || '',
      tipo_venda: product.tipo_venda || 'individual',
      quantidade_pacote: product.quantidade_pacote || 12,
      imagem1: product.imagem1 || '',
      // Novos campos
      variacoes: product.variacoes || '',
      observacoes: product.observacoes || '',
      qtd_minima_fornecedor: product.qtd_minima_fornecedor || 1,
      qtd_maxima_fornecedor: product.qtd_maxima_fornecedor || '',
      qtd_minima_cliente: product.qtd_minima_cliente || 1,
      multiplo_pacote: product.multiplo_pacote || 1,
      posicao_catalogo: product.posicao_catalogo || 0,
      anotacoes_internas: product.anotacoes_internas || '',
      revisar_produto: product.revisar_produto || false,
      registrar_peso: product.registrar_peso || false,
      registrar_preco_custo: product.registrar_preco_custo || false
    })
    setShowProductModal(true)
  }

  const closeProductModal = () => {
    setShowProductModal(false)
    setEditingProduct(null)
    setProductForm({
      nome: '',
      descricao: '',
      preco: '',
      categoria_id: '',
      tipo_venda: 'individual',
      quantidade_pacote: 12,
      imagem1: '',
      variacoes: '',
      observacoes: '',
      qtd_minima_fornecedor: 1,
      qtd_maxima_fornecedor: '',
      qtd_minima_cliente: 1,
      multiplo_pacote: 1,
      posicao_catalogo: 0,
      anotacoes_internas: '',
      revisar_produto: false,
      registrar_peso: false,
      registrar_preco_custo: false
    })
  }

  const saveProduct = async (keepOpen = false) => {
    // Validate description instead of name
    if (!productForm.descricao || !productForm.descricao.trim()) {
      alert('Descrição é obrigatória')
      return
    }
    if (!productForm.preco || parseFloat(productForm.preco) < 0) { // Allow 0
      alert('Preço é obrigatório')
      return
    }

    setSavingProduct(true)
    try {
      // Auto-generate name from first 3 words of description
      const words = productForm.descricao.trim().split(/\s+/)
      const autoGeneratedName = words.slice(0, 3).join(' ')
      
      const productData = {
        nome: autoGeneratedName, // Auto-generated
        descricao: productForm.descricao.trim(),
        preco: parseFloat(productForm.preco),
        categoria_id: productForm.categoria_id || null,
        imagem1: productForm.imagem1 || null,
        tipo_venda: productForm.tipo_venda,
        quantidade_pacote: productForm.tipo_venda === 'pacote' ? (parseInt(productForm.quantidade_pacote) || 12) : 12,
        ativo: true,
        variacoes: productForm.variacoes,
        observacoes: productForm.observacoes,
        qtd_minima_fornecedor: parseInt(productForm.qtd_minima_fornecedor) || 1,
        qtd_maxima_fornecedor: productForm.qtd_maxima_fornecedor ? parseInt(productForm.qtd_maxima_fornecedor) : null,
        qtd_minima_cliente: parseInt(productForm.qtd_minima_cliente) || 1,
        multiplo_pacote: parseInt(productForm.multiplo_pacote) || 1,
        posicao_catalogo: parseInt(productForm.posicao_catalogo) || 0,
        anotacoes_internas: productForm.anotacoes_internas,
        revisar_produto: productForm.revisar_produto,
        registrar_peso: productForm.registrar_peso,
        registrar_preco_custo: productForm.registrar_preco_custo
      }

      if (editingProduct) {
        // Atualizar produto existente
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)

        if (error) throw error
        
        closeProductModal() // Always close on edit
      } else {
        // Criar novo produto
        const { data: newProduct, error: insertError } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single()

        if (insertError) throw insertError

        // Adicionar ao lote atual
        const { error: lotError } = await supabase
          .from('lot_products')
          .insert({
            lot_id: id,
            product_id: newProduct.id,
            quantidade_pedidos: 0,
            quantidade_clientes: 0
          })

        if (lotError) throw lotError

        if (keepOpen) {
          // Reset only specific fields to speed up entry
          setProductForm(prev => ({
            ...prev,
            nome: '',
            descricao: '',
            preco: '',
            imagem1: '',
            variacoes: '',
            observacoes: '',
            // Keep category, type, and rules for convenience
          }))
          // Optional: Show success toast
        } else {
          closeProductModal()
        }
      }

      fetchData()
    } catch (error) {
      console.error('Erro ao salvar produto:', error)
      alert('Erro ao salvar produto')
    } finally {
      setSavingProduct(false)
    }
  }




  const filteredProducts = products.filter(lp => {
    const product = lp.product
    if (!product) return false
    const matchSearch = product.nome.toLowerCase().includes(search.toLowerCase())
    const matchCategory = categoryFilter === 'todas' || product.categoria_id === categoryFilter
    return matchSearch && matchCategory
  })

  // Calcular estatísticas
  const stats = {
    totalProdutos: products.length,
    totalReservas: reservas.reduce((sum, r) => sum + r.quantidade, 0),
    totalClientes: reservas.length,
    valorTotal: reservas.reduce((sum, r) => sum + r.total, 0)
  }

  if (loading) {
    return <div className="page-container"><div className="loading-spinner" style={{ margin: '40px auto' }} /></div>
  }

  if (!lot) {
    return <div className="page-container">Link não encontrado</div>
  }

  const isOpen = lot.status === 'aberto'
  const isClosed = lot.status === 'fechado'

  return (
    <div className="page-container lot-detail">
      {/* Header */}
      <div className="lot-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/admin/lotes')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>{lot.nome}</h1>
            <div className="lot-status-bar">
              <span className={`status-badge status-${lot.status}`}>
                {lot.status === 'aberto' ? 'ABERTO' : 
                 lot.status === 'fechado' ? 'FECHADO' : 
                 lot.status === 'preparacao' ? 'EM PREPARAÇÃO' : lot.status?.toUpperCase()}
              </span>
              {lot.data_fim && (
                <span className="lot-deadline">
                  <Clock size={14} />
                  Encerra: {new Date(lot.data_fim).toLocaleString('pt-BR')}
                </span>
              )}
            </div>
          </div>
        </div>
          <div className="header-actions-group">
            <button className="btn btn-outline" onClick={fetchData}>
              <RefreshCw size={16} />
            </button>
            <div className="dropdown-container">
              <button 
                className="btn btn-outline"
                onClick={() => setShowActionsMenu(!showActionsMenu)}
              >
                <MoreVertical size={16} /> Ações
              </button>
              {showActionsMenu && (
                <div className="dropdown-menu-right">
                  <div className="dropdown-section">
                    <span className="dropdown-header">Gestão</span>
                    <button onClick={() => { setShowSettingsModal(true); setShowActionsMenu(false); }}>
                      <Settings size={14} /> Editar Link / Configurações
                    </button>
                    <button onClick={() => { setActiveTab('produtos'); setShowActionsMenu(false); }}>
                      <Package size={14} /> Editar Produtos
                    </button>
                    <button onClick={duplicateLot}>
                      <Copy size={14} /> Duplicar Grupo
                    </button>
                  </div>
                  
                  <div className="dropdown-divider" />
                  
                  <div className="dropdown-section">
                    <span className="dropdown-header">Operação</span>
                    <button onClick={() => { setActiveTab('reservas'); setShowActionsMenu(false); }}>
                      <ClipboardList size={14} /> Listar Pedidos
                    </button>
                    <button onClick={() => { setActiveTab('separacao'); setShowActionsMenu(false); }}>
                      <CheckSquare size={14} /> Separar Produtos
                    </button>
                    <button onClick={() => { setActiveTab('romaneios'); setShowActionsMenu(false); }}>
                      <FileText size={14} /> Romaneios
                    </button>
                  </div>

                  <div className="dropdown-divider" />

                  <div className="dropdown-section">
                    <span className="dropdown-header">Relatórios</span>
                    <button onClick={() => navigate(`/admin/relatorios?lotId=${id}&type=financeiro`)}>
                      <DollarSign size={14} /> Relatório Financeiro
                    </button>
                    <button onClick={() => navigate(`/admin/relatorios?lotId=${id}&type=vendas`)}>
                      <TrendingUp size={14} /> Relatório Vendas
                    </button>
                    <button onClick={() => navigate(`/admin/relatorios?lotId=${id}&type=produtos`)}>
                      <Package size={14} /> Ranking Produtos
                    </button>
                  </div>

                  {isOpen && (
                    <>
                      <div className="dropdown-divider" />
                      <button className="text-danger" onClick={() => { openCloseConfirmation(); setShowActionsMenu(false); }}>
                        <Lock size={14} /> Fechar Grupo
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Package size={20} strokeWidth={1.5} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalProdutos}</span>
            <span className="stat-label">Produtos</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Users size={20} strokeWidth={1.5} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalClientes}</span>
            <span className="stat-label">Clientes</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={20} strokeWidth={1.5} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalReservas}</span>
            <span className="stat-label">Reservas</span>
          </div>
        </div>
        <div className="stat-card stat-highlight">
          <div className="stat-icon">
            <DollarSign size={20} strokeWidth={1.5} />
          </div>
          <div className="stat-content">
            <span className="stat-value">R$ {stats.valorTotal.toFixed(2)}</span>
            <span className="stat-label">Total Reservado</span>
          </div>
        </div>
      </div>

      {/* Link Share Section */}
      <div className="lot-link-section">
        <div className="link-info">
          <span className="link-label">Link para compartilhar:</span>
          <span className="link-url">
            {window.location.origin}/catalogo/{lot.link_compra || lot.id}
          </span>
        </div>
        <div className="link-actions">
          <button className="btn btn-primary" onClick={copyLink}>
            <Copy size={16} /> Copiar Link
          </button>
          {isOpen && (
            <button 
              className="btn btn-danger" 
              onClick={openCloseConfirmation}
              disabled={closing || sendingNotification}
            >
              <Lock size={16} /> {closing ? 'Fechando...' : sendingNotification ? 'Notificando...' : 'Fechar Link'}
            </button>
          )}
        </div>
      </div>

      {/* Aviso de Pacote Fechado */}
      {lot.requer_pacote_fechado && (
        <div className="alert alert-warning">
          <AlertTriangle size={18} />
          <div>
            <strong>Pacote Fechado:</strong> Este link só pode ser fechado quando todos os pacotes estiverem completos.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="lot-tabs">
        <button 
          className={`tab-btn ${activeTab === 'produtos' ? 'active' : ''}`}
          onClick={() => setActiveTab('produtos')}
        >
          <Package size={16} /> Produtos ({products.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'reservas' ? 'active' : ''}`}
          onClick={() => setActiveTab('reservas')}
        >
          <Users size={16} /> Reservas ({reservas.length} clientes)
        </button>
        <button 
          className={`tab-btn ${activeTab === 'romaneios' ? 'active' : ''}`}
          onClick={() => setActiveTab('romaneios')}
        >
          <FileText size={16} /> Romaneios
        </button>
        <button 
          className={`tab-btn ${activeTab === 'separacao' ? 'active' : ''}`}
          onClick={() => setActiveTab('separacao')}
        >
          <ClipboardList size={16} /> Separação
        </button>
      </div>

      {/* Tab Content: Produtos */}
      {activeTab === 'produtos' && (
        <div className="tab-content">
          {/* Action buttons */}
          <div className="lot-actions">
            {isOpen && (
              <>
                <button 
                  className="btn btn-primary"
                  onClick={openCreateProductModal}
                >
                  <Plus size={16} /> Criar Produto
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    fetchAvailableProducts()
                    setShowAddProductModal(true)
                  }}
                >
                  <Package size={16} /> Adicionar Existente
                </button>
              </>
            )}
          </div>

          {/* Filters */}
          <div className="lot-filters">
            <div className="search-box">
              <input 
                type="text" 
                placeholder="Buscar por descrição" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search size={18} className="search-icon" />
            </div>
            <select 
              className="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="todas">Todas as Categorias</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nome}</option>
              ))}
            </select>
          </div>

          {/* Product Grid */}
          <div className="products-grid">
            {filteredProducts.length === 0 ? (
              <div className="empty-products">
                <Package size={48} />
                <p>Nenhum produto no link</p>
                {isOpen && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      fetchAvailableProducts()
                      setShowAddProductModal(true)
                    }}
                  >
                    <Plus size={16} /> Adicionar Produto
                  </button>
                )}
              </div>
            ) : (
              filteredProducts.map((lp, index) => {
                const product = lp.product
                if (!product) return null
                
                // Verificar se é pacote e calcular progresso
                const isPacote = product.tipo_venda === 'pacote'
                const qtdPacote = product.quantidade_pacote || 12
                const qtdReservada = lp.quantidade_pedidos || 0
                const progressoPacote = isPacote ? (qtdReservada % qtdPacote) : 0
                const pacotesCompletos = isPacote ? Math.floor(qtdReservada / qtdPacote) : 0
                
                return (
                  <div key={lp.id} className="product-card">
                    {/* Remove button */}
                    {isOpen && (
                      <button className="card-remove" onClick={() => openRemoveProductConfirm(lp.id)}>
                        <X size={16} />
                      </button>
                    )}

                    {/* Product image */}
                    <div className="card-image">
                      {product.imagem1 ? (
                        <img src={product.imagem1} alt={product.nome} />
                      ) : (
                        <div className="no-image">
                          <Image size={40} />
                        </div>
                      )}
                      <span className="card-id">ID {index + 1}</span>
                      {isPacote && (
                        <span className="card-badge-pacote">Pacote {qtdPacote}</span>
                      )}
                    </div>

                    {/* Product info */}
                    <div className="card-info">
                      <p className="info-line"><strong>Qtde Reservadas:</strong> {qtdReservada}</p>
                      <p className="info-line"><strong>Qtde Clientes:</strong> {lp.quantidade_clientes || 0}</p>
                      <p className="info-line"><strong>Categoria:</strong> {product.category?.nome || '-'}</p>
                      <p className="info-line"><strong>Descrição:</strong> {product.descricao || product.nome}</p>
                      <p className="info-line price"><strong>Valor:</strong> R$ {product.preco?.toFixed(2) || '0,00'}</p>
                    </div>

                    {/* Progresso do pacote */}
                    {isPacote && lot.requer_pacote_fechado && (
                      <div className="pacote-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${(progressoPacote / qtdPacote) * 100}%` }}
                          />
                        </div>
                        <span className="progress-text">
                          {progressoPacote}/{qtdPacote} para fechar pacote
                          {pacotesCompletos > 0 && ` (${pacotesCompletos} completo${pacotesCompletos > 1 ? 's' : ''})`}
                        </span>
                      </div>
                    )}

                    {/* Card actions */}
                    <div className="card-actions">
                      <button 
                        className="btn btn-sm btn-outline"
                        onClick={() => openEditProductModal(product)}
                      >
                        <Edit size={14} /> Editar
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => openDeleteProductConfirm(product.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Reservas */}
      {activeTab === 'reservas' && (
        <div className="tab-content">
          {reservas.length === 0 ? (
            <div className="empty-state">
              <Users size={48} />
              <h3>Nenhuma reserva ainda</h3>
              <p>Compartilhe o link para receber reservas de clientes</p>
            </div>
          ) : (
            <div className="reservas-list">
              {reservas.map((clientReserva, idx) => (
                <div key={idx} className="reserva-card">
                  <div className="reserva-header">
                    <div className="client-info">
                      <h4>{clientReserva.client?.nome}</h4>
                      <span>{clientReserva.client?.telefone}</span>
                    </div>
                    <div className="reserva-summary">
                      <span className="reserva-qty">{clientReserva.quantidade} itens</span>
                      <span className="reserva-total">R$ {clientReserva.total.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="reserva-items">
                    {clientReserva.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="reserva-item">
                        <div className="item-image">
                          {item.product?.imagem1 ? (
                            <img src={item.product.imagem1} alt="" />
                          ) : (
                            <div className="no-image-sm"><Image size={16} /></div>
                          )}
                        </div>
                        <div className="item-info">
                          <span className="item-name">{item.product?.nome}</span>
                          <span className="item-qty">Qtd: {item.quantidade}</span>
                        </div>
                        <span className="item-price">R$ {item.valor_total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="reserva-actions">
                    <button className="btn btn-sm btn-outline">
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                    {isClosed && (
                      <button className="btn btn-sm btn-primary">
                        <FileText size={14} /> Ver Romaneio
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Romaneios */}
      {activeTab === 'romaneios' && (
        <div className="tab-content">
          {!isClosed ? (
            <div className="empty-state">
              <FileText size={48} />
              <h3>Romaneios serão gerados automaticamente</h3>
              <p>Quando o link for fechado, os romaneios serão gerados para cada cliente</p>
            </div>
          ) : (
            <div className="romaneios-actions">
              <button 
                className="btn btn-primary btn-lg"
                onClick={() => navigate('/admin/romaneios')}
              >
                <FileText size={18} /> Acessar Romaneios
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Separação */}
      {activeTab === 'separacao' && (
        <div className="tab-content">
          <div className="separacao-container">
             <div className="separacao-header">
               <h3>Checklist de Separação</h3>
               <p>Utilize esta lista para conferir os produtos de cada cliente.</p>
             </div>
             
             {reservas.length === 0 ? (
               <div className="empty-state">
                 <ClipboardList size={48} />
                 <h3>Nada para separar</h3>
               </div>
             ) : (
               <div className="separacao-list">
                 {reservas.map(reservaGroup => (
                   <div key={reservaGroup.client?.id} className="separacao-card">
                     <div className="separacao-client-header">
                       <h4>{reservaGroup.client?.nome}</h4>
                       <span className="badge-count">{reservaGroup.quantidade} itens</span>
                     </div>
                     <div className="separacao-items">
                       {reservaGroup.items.map(item => (
                         <label key={item.id} className="separacao-item">
                           <input 
                              type="checkbox" 
                              checked={!!separacaoItems[item.id]}
                              onChange={(e) => setSeparacaoItems({...separacaoItems, [item.id]: e.target.checked})}
                           />
                           <span className="checkmark-box"><CheckSquare size={18} /></span>
                           <div className="sep-item-info">
                              <span className="sep-prod-name">{item.product?.nome}</span>
                              <span className="sep-prod-qty">x{item.quantidade}</span>
                           </div>
                         </label>
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      )}

      {/* Modal: Adicionar Produtos */}
      {showAddProductModal && (
        <div className="modal-overlay" onClick={() => setShowAddProductModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adicionar Produtos ao Link</h2>
              <button className="modal-close" onClick={() => setShowAddProductModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <p className="modal-hint">Selecione os produtos para adicionar:</p>
              
              <div className="products-select-grid">
                {availableProducts.length === 0 ? (
                  <p>Todos os produtos já estão neste link</p>
                ) : (
                  availableProducts.map(product => (
                    <label key={product.id} className="product-select-item">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts([...selectedProducts, product.id])
                          } else {
                            setSelectedProducts(selectedProducts.filter(id => id !== product.id))
                          }
                        }}
                      />
                      <div className="product-select-image">
                        {product.imagem1 ? (
                          <img src={product.imagem1} alt="" />
                        ) : (
                          <div className="no-image-sm"><Image size={20} /></div>
                        )}
                      </div>
                      <div className="product-select-info">
                        <span className="product-name">{product.nome}</span>
                        <span className="product-price">R$ {product.preco?.toFixed(2)}</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddProductModal(false)}>
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={addProductsToLot}
                disabled={selectedProducts.length === 0}
              >
                Adicionar {selectedProducts.length > 0 ? `(${selectedProducts.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configurações */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content modal-settings" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Settings size={20} /> Configurações do Link</h2>
              <button className="modal-close" onClick={() => setShowSettingsModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body settings-body">
              {/* Seção: Informações Básicas */}
              <div className="settings-section">
                <h3 className="settings-section-title">
                  <FileText size={16} /> Informações Básicas
                </h3>
                
                <div className="form-group">
                  <label>Nome do Link</label>
                  <input
                    type="text"
                    value={lotSettings.nome || ''}
                    onChange={(e) => setLotSettings({ ...lotSettings, nome: e.target.value })}
                    placeholder="Ex: LINK 502 - Novidades"
                  />
                </div>

                <div className="form-group">
                  <label>Descrição</label>
                  <textarea
                    value={lotSettings.descricao || ''}
                    onChange={(e) => setLotSettings({ ...lotSettings, descricao: e.target.value })}
                    rows={2}
                    placeholder="Descrição para os clientes..."
                  />
                </div>
              </div>

              {/* Seção: Regras e Prazos */}
              <div className="settings-section">
                <h3 className="settings-section-title">
                  <Clock size={16} /> Regras e Prazos
                </h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Data/Hora de Encerramento</label>
                    <input
                      type="datetime-local"
                      value={lotSettings.data_fim ? new Date(lotSettings.data_fim).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setLotSettings({ ...lotSettings, data_fim: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Taxa de Separação (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={lotSettings.taxa_separacao || 0}
                      onChange={(e) => setLotSettings({ ...lotSettings, taxa_separacao: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={lotSettings.requer_pacote_fechado || false}
                      onChange={(e) => setLotSettings({ ...lotSettings, requer_pacote_fechado: e.target.checked })}
                    />
                    <span className="checkbox-text">Requer pacote fechado</span>
                  </label>
                  <p className="checkbox-hint">Só permite fechar quando todos os pacotes estiverem completos</p>
                </div>
              </div>

              {/* Seção: Dados de Pagamento */}
              <div className="settings-section">
                <h3 className="settings-section-title">
                  <DollarSign size={16} /> Dados de Pagamento
                </h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Chave PIX</label>
                    <input
                      type="text"
                      value={lotSettings.chave_pix || ''}
                      onChange={(e) => setLotSettings({ ...lotSettings, chave_pix: e.target.value })}
                      placeholder="CNPJ, email ou telefone"
                    />
                  </div>
                  <div className="form-group">
                    <label>Nome do Beneficiário</label>
                    <input
                      type="text"
                      value={lotSettings.nome_beneficiario || ''}
                      onChange={(e) => setLotSettings({ ...lotSettings, nome_beneficiario: e.target.value })}
                      placeholder="Nome que aparece no PIX"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Telefone do Setor Financeiro</label>
                  <input
                    type="text"
                    value={lotSettings.telefone_financeiro || ''}
                    onChange={(e) => setLotSettings({ ...lotSettings, telefone_financeiro: e.target.value })}
                    placeholder="(XX) XXXXX-XXXX"
                  />
                </div>

                <div className="form-group">
                  <label>Mensagem de Pagamento</label>
                  <textarea
                    value={lotSettings.mensagem_pagamento || ''}
                    onChange={(e) => setLotSettings({ ...lotSettings, mensagem_pagamento: e.target.value })}
                    placeholder="Instruções adicionais para o cliente..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowSettingsModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={updateLotSettings}>
                <Save size={16} /> Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmação Personalizado */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {confirmAction === 'close' ? '🔒 Fechar Link' : 
                 confirmAction?.type === 'removeProduct' ? '📦 Remover Produto' :
                 confirmAction?.type === 'deleteProduct' ? '🗑️ Excluir Produto' : 'Confirmar'}
              </h2>
              <button className="modal-close" onClick={() => setShowConfirmModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              {confirmAction === 'close' && (
                <>
                  <p className="confirm-message">
                    Tem certeza que deseja <strong>fechar este link</strong>?
                  </p>
                  <p className="confirm-hint">
                    Após fechado, os clientes não poderão mais fazer reservas.
                  </p>
                  
                  <div className="confirm-option">
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={notifyOnClose}
                        onChange={(e) => setNotifyOnClose(e.target.checked)}
                      />
                      <span className="checkbox-label">
                        <Bell size={16} />
                        Notificar clientes via WhatsApp sobre o fechamento
                      </span>
                    </label>
                  </div>
                </>
              )}
              
              {confirmAction?.type === 'removeProduct' && (
                <p className="confirm-message">
                  Deseja <strong>remover</strong> este produto do link?
                  <br />
                  <small>O produto continuará existindo no sistema.</small>
                </p>
              )}
              
              {confirmAction?.type === 'deleteProduct' && (
                <>
                  <p className="confirm-message confirm-danger">
                    ⚠️ Tem certeza que deseja <strong>EXCLUIR PERMANENTEMENTE</strong> este produto?
                  </p>
                  <p className="confirm-hint">
                    Esta ação não pode ser desfeita. O produto será removido do sistema.
                  </p>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowConfirmModal(false)}>
                Cancelar
              </button>
              <button 
                className={`btn ${confirmAction?.type === 'deleteProduct' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleConfirm}
              >
                {confirmAction === 'close' ? 'Fechar Link' : 
                 confirmAction?.type === 'removeProduct' ? 'Remover' :
                 confirmAction?.type === 'deleteProduct' ? 'Excluir' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificação Toast */}
      {notification && (
        <div className={`toast-notification toast-${notification.type}`}>
          {notification.type === 'success' && <CheckCircle size={20} />}
          {notification.type === 'error' && <AlertTriangle size={20} />}
          {notification.type === 'warning' && <AlertTriangle size={20} />}
          <span>{notification.message}</span>
          <button className="toast-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Modal: Criar/Editar Produto */}
      {showProductModal && (
        <div className="modal-overlay" onClick={closeProductModal}>
          <div className="modal-content product-modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? 'Editar Produto' : 'Criar Novo Produto'}</h2>
              <button className="modal-close" onClick={closeProductModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body product-modal-body">
              {/* LAYOUT SUPERIOR: Foto à Direita, Infos à Esquerda */}
              <div className="product-modal-top">
                
                {/* 1. SEÇÃO DE FOTO (Direita na desktop, topo no mobile) */}
                <div className="product-photo-section">
                   <label className="photo-upload-label">Foto</label>
                   <ImageUpload
                     value={productForm.imagem1}
                     onChange={(url) => setProductForm(prev => ({ ...prev, imagem1: url }))}
                   />
                </div>

                {/* 2. CORE INFO (Esquerda) - Borda Tracejada */}
                <div className="product-core-info">
                  <div className="form-row-custom">
                    <div className="form-group sm-width">
                      <label>Preço Unitário (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-clean"
                        value={productForm.preco}
                        onChange={(e) => setProductForm({ ...productForm, preco: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="form-group md-width">
                      <label>Categoria</label>
                      <select
                        className="input-clean"
                        value={productForm.categoria_id}
                        onChange={(e) => setProductForm({ ...productForm, categoria_id: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group flex-grow">
                      <label>Descrição *</label>
                      <input
                        type="text"
                        className="input-clean"
                        value={productForm.descricao}
                        onChange={(e) => setProductForm({ ...productForm, descricao: e.target.value })}
                        placeholder="Ex: Luxo Aço Inox Dourado"
                      />
                    </div>
                  </div>

                  <div className="form-group mt-3">
                    <label>Variações/Tamanho (separados por vírgula)</label>
                    <input
                      type="text"
                      className="input-clean"
                      value={productForm.variacoes}
                      onChange={(e) => setProductForm({ ...productForm, variacoes: e.target.value })}
                      placeholder="Ex: P, M, G, GG"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO TIPO DE VENDA (Fora do tracejado) */}
               <div className="form-group" style={{ maxWidth: '200px' }}>
                  <label>Tipo de Venda</label>
                  <select
                    className="input-bordered"
                    value={productForm.tipo_venda}
                    onChange={(e) => setProductForm({ ...productForm, tipo_venda: e.target.value })}
                  >
                    <option value="individual">Individual</option>
                    <option value="pacote">Pacote</option>
                  </select>
                </div>

              {/* SEÇÃO INTERMEDIÁRIA: Regras de Quantidade */}
              <div className="product-rules-grid">
                <div className="form-group">
                  <label>Qtd mínima fornecedor</label>
                  <input
                    type="number"
                    className="input-bordered"
                    value={productForm.qtd_minima_fornecedor}
                    onChange={(e) => setProductForm({ ...productForm, qtd_minima_fornecedor: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Qtd máxima fornecedor</label>
                  <input
                    type="number"
                    className="input-bordered"
                    value={productForm.qtd_maxima_fornecedor}
                    onChange={(e) => setProductForm({ ...productForm, qtd_maxima_fornecedor: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Qtd mínima cliente</label>
                  <input
                    type="number"
                    className="input-bordered"
                    value={productForm.qtd_minima_cliente}
                    onChange={(e) => setProductForm({ ...productForm, qtd_minima_cliente: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Múltiplo do Fornecedor Peças por pacote</label>
                  <input
                    type="number"
                    className="input-bordered"
                    value={productForm.multiplo_pacote}
                    onChange={(e) => setProductForm({ ...productForm, multiplo_pacote: e.target.value })}
                  />
                  {productForm.tipo_venda === 'pacote' && (
                     <small className="field-hint">Qtde atual: {productForm.quantidade_pacote || 12}</small>
                  )}
                </div>
              </div>

              {/* SEÇÃO INFERIOR: Detalhes e Checkboxes */}
              <div className="product-bottom-section">
                <div className="form-group">
                   <label>Posição no catálogo <Info size={12} /></label>
                   <input
                     type="number"
                     className="input-bordered"
                     style={{ width: '100px' }}
                     value={productForm.posicao_catalogo}
                     onChange={(e) => setProductForm({ ...productForm, posicao_catalogo: e.target.value })}
                   />
                </div>

                <div className="form-group">
                  <label>Observações</label>
                  <input
                    type="text"
                    className="input-bordered"
                    value={productForm.observacoes}
                    onChange={(e) => setProductForm({ ...productForm, observacoes: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Anotações Internas</label>
                  <input
                    type="text"
                    className="input-bordered"
                    value={productForm.anotacoes_internas}
                    onChange={(e) => setProductForm({ ...productForm, anotacoes_internas: e.target.value })}
                  />
                </div>

                <div className="checkbox-stack">
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={productForm.revisar_produto}
                      onChange={(e) => setProductForm({ ...productForm, revisar_produto: e.target.checked })}
                    />
                    <span>Revisar produto</span>
                  </label>
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={productForm.registrar_peso}
                      onChange={(e) => setProductForm({ ...productForm, registrar_peso: e.target.checked })}
                    />
                    <span>Registrar Peso</span>
                  </label>
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={productForm.registrar_preco_custo}
                      onChange={(e) => setProductForm({ ...productForm, registrar_preco_custo: e.target.checked })}
                    />
                    <span>Registrar preço custo</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeProductModal}>
                Cancelar
              </button>
              
              {!editingProduct && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => saveProduct(true)}
                  disabled={savingProduct}
                  style={{ backgroundColor: '#475569', color: 'white', border: 'none' }}
                >
                  {savingProduct ? 'Salvando...' : 'Salvar e Próximo'}
                </button>
              )}

              <button 
                className="btn btn-primary" 
                onClick={() => saveProduct(false)}
                disabled={savingProduct}
                style={{ backgroundColor: '#1e293b', borderColor: '#1e293b' }} // Dark premium color
              >
                {savingProduct ? 'Salvando...' : (editingProduct ? 'Salvar Alterações' : 'Salvar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ======================================================================================
   NÃO REMOVER O CÓDIGO ABAIXO - O COMPONENTE TEM QUE FECHAR AQUI
   ====================================================================================== */
