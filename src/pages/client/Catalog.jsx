import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Plus, Minus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/common/Toast'
import LotTermsBlock from '../../components/client/LotTermsBlock'
import { calcPrecoNoLote, formatPrice } from '../../utils/pricing'
import { esgotadoNoLote, disponibilidadeLoteParaExibicao } from '../../utils/lotAvailability'
import './Catalog.css'

// LOG IMEDIATO AO CARREGAR O ARQUIVO
console.log('%c📦 ARQUIVO Catalog.jsx CARREGADO', 'background: purple; color: white; font-size: 20px; padding: 10px;')
window.console.log('%c📦 ARQUIVO Catalog.jsx CARREGADO (window.console)', 'background: purple; color: white; font-size: 20px; padding: 10px;')

export default function Catalog() {
  const { linkUrl } = useParams()
  const { lotId } = useParams()
  const id = lotId || linkUrl

  // FORÇAR LOGS - usar window.console para garantir que execute
  window.console.log('%c🚀🚀🚀 COMPONENTE CATALOG RENDERIZADO 🚀🚀🚀', 'background: #222; color: #bada55; font-size: 20px; padding: 10px;')
  window.console.log('ID recebido:', id)
  window.console.log('linkUrl:', linkUrl, 'lotId:', lotId)

  const navigate = useNavigate()
  const toast = useToast()
  const [lot, setLot] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState(null)
  const [quantities, setQuantities] = useState({})
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [productPurchases, setProductPurchases] = useState([])
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  // Usar uma key baseada no ID para garantir que cada acesso ao catálogo seja único
  const clickTracked = useRef(new Map()) // Map<lotId, boolean> para rastrear por catálogo

  const { client } = useAuth()

  // Disponibilidade no lote (calculada: limite_maximo - unidades confirmadas). Sem uso de estoque manual.
  const getEsgotadoNoLote = (product) =>
    esgotadoNoLote(product.qtd_minima_fornecedor, product.quantidade_pedidos)

  // Função para calcular quantidade faltando (mínimo para fechar compra coletiva)
  const getMissingQuantity = (product) => {
    const minimoLote = product.quantidade_minima_lote || 0
    const totalComprado = product.quantidade_pedidos || 0
    if (minimoLote === 0 || totalComprado >= minimoLote) return 0
    return Math.max(minimoLote - totalComprado, 0)
  }

  window.console.log('🔍 Estado atual:', { id, loading, lot: lot?.id, client: client?.id })

  useEffect(() => {
    window.console.log('%c🔵 useEffect inicial executado', 'background: blue; color: white; padding: 5px;')
    window.console.log('ID:', id)

    // SEMPRE resetar tracking quando muda o ID do catálogo
    // Isso permite que cada acesso ao catálogo seja registrado como um novo clique
    if (id) {
      clickTracked.current.delete(id) // Remove tracking anterior deste catálogo
      window.console.log('🔄 Tracking resetado para este catálogo - permitindo novo registro')
    }

    if (id) {
      window.console.log('Chamando loadCatalog()')
      loadCatalog()
    } else {
      window.console.warn('⚠️ ID não encontrado!')
    }
  }, [id])

  // Registrar clique no catálogo (sempre que o catálogo é carregado)
  // REMOVIDO: não usar mais este useEffect para tracking, pois está sendo feito diretamente no loadCatalog

  // Registrar clique no catálogo (versão direta com lotId)
  const trackCatalogClickDirect = async (lotIdParam) => {
    try {
      window.console.log('%c=== TRACKING DIRETO INICIADO ===', 'background: purple; color: white; font-size: 16px; padding: 10px;')
      window.console.log('Lot ID recebido:', lotIdParam)
      window.console.log('Client:', client)

      // Teste imediato de inserção
      window.console.log('🔍 Tentando inserir clique na tabela catalog_clicks...')

      if (!lotIdParam) {
        console.warn('❌ Não é possível registrar clique: lotId não fornecido')
        return
      }

      // Gerar session_id único se não houver client_id
      const sessionId = client?.id ? null : `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const clickData = {
        lot_id: lotIdParam,
        client_id: client?.id || null,
        session_id: sessionId,
        ip_address: null,
        user_agent: navigator.userAgent
      }

      window.console.log('%c📊 DADOS DO CLIQUE', 'background: orange; color: black; padding: 5px;')
      window.console.log(clickData)

      window.console.log('🔍 Fazendo INSERT no Supabase...')
      window.console.log('Tabela: catalog_clicks')
      window.console.log('Dados a inserir:', JSON.stringify(clickData, null, 2))

      const { data, error } = await supabase
        .from('catalog_clicks')
        .insert(clickData)
        .select()

      window.console.log('📡 Resposta do Supabase recebida')
      window.console.log('Data retornada:', data)
      window.console.log('Error retornado:', error)

      if (error) {
        window.console.error('%c❌❌❌ ERRO AO REGISTRAR CLIQUE ❌❌❌', 'background: red; color: white; font-size: 16px; padding: 10px;')
        window.console.error('Código:', error.code)
        window.console.error('Mensagem:', error.message)
        window.console.error('Detalhes:', error.details)
        window.console.error('Hint:', error.hint)
        window.console.error('Erro completo:', JSON.stringify(error, null, 2))

        // Tentar novamente sem client_id
        window.console.log('%c🔄 TENTANDO SEM CLIENT_ID', 'background: orange; color: white; padding: 5px;')
        const { data: retryData, error: retryError } = await supabase
          .from('catalog_clicks')
          .insert({
            lot_id: lotIdParam,
            client_id: null,
            session_id: sessionId,
            ip_address: null,
            user_agent: navigator.userAgent
          })
          .select()

        if (retryError) {
          window.console.error('%c❌ ERRO NA TENTATIVA 2', 'background: red; color: white; padding: 5px;')
          window.console.error(retryError)
        } else {
          window.console.log('%c✅✅✅ CLIQUE REGISTRADO COM SUCESSO (SEM CLIENT_ID) ✅✅✅', 'background: green; color: white; font-size: 16px; padding: 10px;')
          window.console.log('Dados retornados:', retryData)
          window.console.log('ID do registro:', retryData?.[0]?.id)
          window.console.log('Created_at:', retryData?.[0]?.created_at)

          // Verificar se realmente foi salvo fazendo uma query
          setTimeout(async () => {
            const { data: verifyData, error: verifyError } = await supabase
              .from('catalog_clicks')
              .select('*')
              .eq('id', retryData?.[0]?.id)
              .single()

            if (verifyError) {
              window.console.error('❌ ERRO ao verificar inserção:', verifyError)
            } else {
              window.console.log('✅ VERIFICAÇÃO: Clique confirmado no banco:', verifyData)
            }
          }, 1000)
        }
      } else {
        window.console.log('%c✅✅✅ CLIQUE REGISTRADO COM SUCESSO ✅✅✅', 'background: green; color: white; font-size: 16px; padding: 10px;')
        window.console.log('Dados retornados:', data)
        window.console.log('ID do registro:', data?.[0]?.id)
        window.console.log('Created_at:', data?.[0]?.created_at)

        // Verificar se realmente foi salvo fazendo uma query
        setTimeout(async () => {
          const { data: verifyData, error: verifyError } = await supabase
            .from('catalog_clicks')
            .select('*')
            .eq('id', data?.[0]?.id)
            .single()

          if (verifyError) {
            window.console.error('❌ ERRO ao verificar inserção:', verifyError)
          } else {
            window.console.log('✅ VERIFICAÇÃO: Clique confirmado no banco:', verifyData)
          }
        }, 1000)
      }
    } catch (error) {
      window.console.error('%c❌ ERRO INESPERADO', 'background: red; color: white; padding: 5px;')
      window.console.error(error)
      window.console.error('Stack:', error.stack)
    }
  }

  // Registrar clique no catálogo
  const trackCatalogClick = async () => {
    try {
      console.log('=== INICIANDO TRACKING DE CLIQUE ===')
      console.log('Lot:', lot)
      console.log('Client:', client)

      if (!lot || !lot.id) {
        console.warn('❌ Não é possível registrar clique: lot não encontrado', { lot })
        return
      }

      // Usar o ID real do lot (UUID), não o linkUrl que pode ser string
      const lotId = lot.id
      console.log('Lot ID para tracking:', lotId)

      // Gerar session_id único se não houver client_id
      const sessionId = client?.id ? null : `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const clickData = {
        lot_id: lotId,
        client_id: client?.id || null,
        session_id: sessionId,
        ip_address: null,
        user_agent: navigator.userAgent
      }

      console.log('📊 Dados do clique a serem inseridos:', clickData)
      console.log('🔍 Verificando se tabela catalog_clicks existe...')

      const { data, error } = await supabase
        .from('catalog_clicks')
        .insert(clickData)
        .select()

      if (error) {
        console.error('❌ ERRO ao registrar clique:', error)
        console.error('Código do erro:', error.code)
        console.error('Mensagem:', error.message)
        console.error('Detalhes:', error.details)
        console.error('Hint:', error.hint)

        // Tentar novamente sem client_id se houver erro de RLS
        if (error.code === '42501' || error.message?.includes('permission') || error.code === 'PGRST301') {
          console.log('🔄 Tentando registrar sem client_id devido a erro de permissão')
          const { data: retryData, error: retryError } = await supabase
            .from('catalog_clicks')
            .insert({
              lot_id: lotId,
              client_id: null,
              session_id: sessionId,
              ip_address: null,
              user_agent: navigator.userAgent
            })
            .select()

          if (retryError) {
            console.error('❌ Erro ao registrar clique (tentativa 2):', retryError)
            console.error('Código:', retryError.code, 'Mensagem:', retryError.message)
          } else {
            console.log('✅ Clique registrado com sucesso (sem client_id):', retryData)
          }
        }
      } else {
        console.log('✅ Clique registrado com sucesso:', data)
        console.log('=== TRACKING CONCLUÍDO ===')
      }
    } catch (error) {
      console.error('❌ Erro inesperado ao registrar clique:', error)
      console.error('Stack:', error.stack)
    }
  }

  const loadCatalog = async () => {
    try {
      // FORÇAR LOGS - usar window.console e também console direto
      const logMessage = `🚀 INICIANDO CARREGAMENTO DO CATÁLOGO - ID: ${id}`
      window.console.log('%c' + logMessage, 'background: #0066cc; color: white; font-size: 18px; font-weight: bold; padding: 10px;')
      console.log(logMessage) // Duplo log para garantir
      console.log('ID recebido:', id)
      window.console.log('ID recebido:', id)
      window.console.trace('Stack trace do carregamento')

      // Teste direto de inserção
      window.console.log('🔍 Testando inserção direta...')

      // 1. Carregar Lote - tentar primeiro por ID, depois por link_compra
      let lotData = null
      let lotError = null

      // Tentar buscar por ID (UUID)
      const { data: dataById, error: errorById } = await supabase
        .from('lots')
        .select('*')
        .eq('id', id)
        .single()

      if (!errorById && dataById) {
        lotData = dataById
        console.log('Catálogo encontrado por ID:', lotData)
      } else {
        // Se não encontrou por ID, tentar por link_compra (caso seja string)
        console.log('Não encontrado por ID, tentando por link_compra:', id)
        const { data: dataByLink, error: errorByLink } = await supabase
          .from('lots')
          .select('*')
          .eq('link_compra', id)
          .single()

        if (!errorByLink && dataByLink) {
          lotData = dataByLink
          console.log('Catálogo encontrado por link_compra:', lotData)
        } else {
          lotError = errorByLink || errorById
        }
      }

      if (lotError || !lotData) {
        console.error('Erro ao buscar catálogo:', lotError)
        throw lotError || new Error('Catálogo não encontrado')
      }

      // IMPORTANTE: Setar o lot ANTES de carregar produtos para que o tracking funcione
      window.console.log('%c🟡 SETANDO LOT NO ESTADO', 'background: yellow; color: black; padding: 5px;')
      window.console.log('Lot ID:', lotData.id)
      setLot(lotData)
      window.console.log('%c✅ LOT SETADO', 'background: green; color: white; padding: 5px;')

      // SEMPRE executar tracking quando o catálogo é carregado
      // Cada acesso ao catálogo deve registrar um novo clique (acumular)
      // O clickTracked.current evita apenas múltiplos registros no mesmo carregamento da página
      const lotIdForTracking = lotData.id
      const alreadyTracked = clickTracked.current.get(lotIdForTracking)

      if (!alreadyTracked) {
        window.console.log('%c🎯🎯🎯 REGISTRANDO NOVO CLIQUE NO CATÁLOGO 🎯🎯🎯', 'background: green; color: white; font-size: 16px; font-weight: bold; padding: 10px;')
        window.console.log('Cada acesso ao catálogo será registrado como um novo clique')
        clickTracked.current.set(lotIdForTracking, true) // Marcar como tracked apenas para evitar múltiplos registros no mesmo carregamento

        // Executar tracking IMEDIATAMENTE
        trackCatalogClickDirect(lotIdForTracking).catch(err => {
          window.console.error('Erro no tracking direto:', err)
          // Se der erro, permitir tentar novamente
          clickTracked.current.delete(lotIdForTracking)
        })
      } else {
        window.console.log('ℹ️ Tracking já executado neste carregamento da página (evitando duplicata no mesmo render)')
        window.console.log('💡 Quando você voltar e acessar novamente, será registrado um novo clique')
      }

      // 2. Carregar Produtos do Lote
      const lotIdForProducts = lotData.id // Usar o ID real do lot encontrado
      const { data: prodData, error: prodError } = await supabase
        .from('lot_products')
        .select(`
            *,
            product:products (*)
        `)
        .eq('lot_id', lotIdForProducts)

      if (prodError) {
        console.error('Erro ao buscar produtos:', prodError)
        // Não lançar erro aqui - deixar produtos vazios mas permitir tracking
        setProducts([])
      } else {
        const mapped = (prodData || []).map(lp => ({
          ...lp.product,
          lp_id: lp.id,
          quantidade_pedidos: lp.quantidade_pedidos || 0,
          quantidade_clientes: lp.quantidade_clientes || 0,
          quantidade_minima_lote: lp.product.qtd_minima_fornecedor || 0, // Mínimo do fornecedor = mínimo para compra coletiva
        }))
        setProducts(mapped)
        console.log('Produtos carregados:', mapped.length)
      }

    } catch (error) {
      console.error('Erro ao carregar catalogo:', error)
      toast.error('Erro ao carregar catálogo. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Função para calcular o preço final do produto com taxas do lote
  const calcularPrecoFinal = (precoBase) => {
    if (!lot || !precoBase) return precoBase || 0

    // Aplicar adicional_por_produto primeiro
    const adicional = lot.adicional_por_produto || 0
    const precoComAdicional = precoBase * (1 + adicional / 100)

    // Aplicar escritório sobre o preço com adicional
    const escritorio = lot.escritorio_pct || 0
    const precoFinal = precoComAdicional * (1 + escritorio / 100)

    return Math.round(precoFinal * 100) / 100
  }

  // Funções para controlar quantidade
  const getQuantity = (productId) => quantities[productId] || 1

  const incrementQuantity = (productId) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: (prev[productId] || 1) + 1
    }))
  }

  const decrementQuantity = (productId) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) - 1)
    }))
  }

  const handleProductClick = async (product) => {
    setSelectedProduct(product)
    setLoadingPurchases(true)

    try {
      if (!lot?.id) {
        setProductPurchases([])
        setLoadingPurchases(false)
        return
      }

      // Buscar romaneios do lote atual (apenas não cancelados)
      const { data: romaneios, error: romError } = await supabase
        .from('romaneios')
        .select(`
          id,
          client_id,
          created_at,
          status_pagamento,
          client:clients(nome)
        `)
        .eq('lot_id', lot.id)
        .not('status_pagamento', 'in', '(cancelado,rejeitado)')

      if (romError) {
        console.error('Erro ao buscar romaneios:', romError)
        setProductPurchases([])
        setLoadingPurchases(false)
        return
      }

      if (!romaneios || romaneios.length === 0) {
        setProductPurchases([])
        setLoadingPurchases(false)
        return
      }

      const romaneioIds = romaneios.map(r => r.id)

      // Buscar itens deste produto nos romaneios
      const { data: purchases, error: itemsError } = await supabase
        .from('romaneio_items')
        .select('*')
        .eq('product_id', product.id)
        .in('romaneio_id', romaneioIds)
        .order('created_at', { ascending: false })

      if (itemsError) {
        console.error('Erro ao buscar itens:', itemsError)
        setProductPurchases([])
      } else {
        // Combinar dados dos romaneios com os itens
        const purchasesWithRomaneio = (purchases || []).map(item => {
          const romaneio = romaneios.find(r => r.id === item.romaneio_id)
          return {
            ...item,
            romaneio: romaneio || null
          }
        })
        setProductPurchases(purchasesWithRomaneio)
      }
    } catch (error) {
      console.error('Erro ao buscar compras:', error)
      setProductPurchases([])
    } finally {
      setLoadingPurchases(false)
    }
  }

  const addToCart = async (product) => {
    const qty = getQuantity(product.id)
    setAddingToCart(product.id)
    try {
      const cartKey = `cart_${id}`
      const currentCart = JSON.parse(localStorage.getItem(cartKey) || '[]')

      // Calcular o preço final com as taxas do lote
      const precoFinal = calcularPrecoFinal(product.preco)

      const existingInfo = currentCart.find(item => item.id === product.id)
      let newCart;

      if (existingInfo) {
        newCart = currentCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + qty, preco: precoFinal }
            : item
        )
      } else {
        newCart = [...currentCart, { ...product, preco: precoFinal, quantity: qty, lot_id: id }]
      }

      localStorage.setItem(cartKey, JSON.stringify(newCart))

      // Resetar quantidade para 1 após adicionar
      setQuantities(prev => ({ ...prev, [product.id]: 1 }))

      // Mostrar toast de sucesso
      toast.success(`${qty}x ${product.nome} adicionado ao carrinho!`)

      // Pequeno feedback visual
      await new Promise(r => setTimeout(r, 300))

    } catch (e) {
      console.error(e)
      toast.error('Erro ao adicionar produto ao carrinho')
    } finally {
      setAddingToCart(null)
    }
  }

  const canAddToCart = (product) => {
    if (!lot) return false
    if (lot.status === 'fechado' || lot.status === 'fechado_e_bloqueado') {
      return false
    }
    if (getEsgotadoNoLote(product)) {
      return false
    }
    return true
  }

  const getUnavailableMessage = (product) => {
    if (!lot) return 'Catálogo não disponível'
    if (lot.status === 'fechado' || lot.status === 'fechado_e_bloqueado') {
      return 'Link fechado para compras!'
    }
    if (getEsgotadoNoLote(product)) {
      return 'Produto esgotado!'
    }
    return null
  }

  if (loading) {
    return (
      <div className="client-page p-8 flex items-center justify-center">
        <div className="text-slate-500">Carregando catálogo...</div>
      </div>
    )
  }

  if (!lot) {
    return (
      <div className="client-page p-8 flex flex-col items-center justify-center gap-4">
        <div className="text-red-500">Não foi possível carregar o catálogo.</div>
        <button onClick={() => navigate('/app')} className="text-blue-500 underline">
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="client-page">
      {/* Header Sticky */}
      <header className="catalog-header">
        <div className="catalog-nav">
          <div className="nav-left">
            <button onClick={() => navigate('/app')} className="btn-back">
              <ArrowLeft size={20} />
            </button>
            <div className="catalog-title">
              <h2>{lot.nome}</h2>
              <span className="status-text">● Grupo Aberto</span>
            </div>
          </div>
          {/* Botão do Carrinho */}
          <button
            onClick={() => navigate('/app/carrinho')}
            className="btn-cart-header"
          >
            <ShoppingCart size={20} />
            {(() => {
              const cartKey = `cart_${id}`
              const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
              const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
              return totalItems > 0 ? <span className="cart-badge">{totalItems}</span> : null
            })()}
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="catalog-content-wrapper" style={{ padding: '0 16px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* 1. Bloco de Descrição (REGRAS) */}
        {lot.descricao && (
          <div className="catalog-description-section">
            <h3 className="section-title">REGRAS</h3>
            <div className="description-text">
              {lot.descricao}
            </div>
          </div>
        )}

        {/* 2. Metadados (Resumo Estruturado) */}
        <LotTermsBlock lot={lot} />

        {/* 3. Filtros */}
        <div className="catalog-filters-bar">
          <button className="btn-toggle-filters">
            Exibir/Ocultar Filtros
          </button>
        </div>

        {/* 4. Grid de Produtos */}
        <div className="products-grid">
          {products.map(product => (
            <div
              key={product.id}
              className={`product-card ${addingToCart === product.id ? 'adding' : ''} ${getEsgotadoNoLote(product) ? 'out-of-stock' : ''}`}
              onClick={() => handleProductClick(product)}
            >
              <div className={`product-image-area ${getEsgotadoNoLote(product) ? 'out-of-stock-image' : ''}`}>
                {product.imagem1 ? (
                  <img src={product.imagem1} alt={product.nome} className="product-img" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    Sem foto
                  </div>
                )}

                {/* Overlay ESGOTADO quando disponibilidade no lote = 0 */}
                {getEsgotadoNoLote(product) && (
                  <div className="out-of-stock-overlay">
                    <div className="out-of-stock-text">ESGOTADO</div>
                  </div>
                )}

                {/* Marca d'água se configurado */}
                {lot?.adicionar_marca_agua && (
                  <div className="watermark-overlay">
                    <div className="watermark-text">{lot.nome || 'CATÁLOGO'}</div>
                  </div>
                )}

                {/* Indicadores de Progresso de Compra Coletiva */}
                <div className="product-quantity-indicators">
                  {/* BADGE VERMELHA: Faltam X peças para atingir o mínimo */}
                  {(() => {
                    const minimoLote = product.quantidade_minima_lote || 0
                    const totalComprado = product.quantidade_pedidos || 0
                    const faltam = Math.max(minimoLote - totalComprado, 0)

                    // Só exibe se há mínimo definido E ainda faltam peças
                    if (minimoLote > 0 && faltam > 0) {
                      return (
                        <div className="quantity-badge quantity-missing">
                          Faltam {faltam}
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* BADGE VERDE: Compradas (sempre visível) */}
                  <div className="quantity-badge quantity-purchased">
                    {product.quantidade_pedidos || 0}
                  </div>
                </div>
              </div>

              {/* Product Info removed as requested - showing only image and badges */}
            </div>
          ))}
        </div>
      </div> {/* Close catalog-content-wrapper */}

      {/* Modal de Detalhes do Produto */}
      {selectedProduct && (
        <div className="product-modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header: Título Esquerda, X Direita */}
            <div className="product-modal-header">
              <h2>Detalhes do Produto</h2>
              <button
                className="btn-close-modal"
                onClick={() => setSelectedProduct(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="product-modal-body">
              <div className="modal-grid">

                {/* COLUNA 1: IMAGEM */}
                <div className="modal-col-image">
                  {selectedProduct.imagem1 ? (
                    <img src={selectedProduct.imagem1} alt={selectedProduct.nome} className="modal-product-img" />
                  ) : (
                    <div className="modal-no-image">
                      <span>Sem foto</span>
                    </div>
                  )}
                </div>

                {/* COLUNA 2: CARD DE INFO */}
                <div className="modal-col-info">
                  <div className="info-card">
                    {/* Topo pequeno */}
                    <div className="info-card-top">
                      <div className="info-line-small">
                        <span className="label">Qtd mínima por cliente:</span> {selectedProduct.quantidade_minima || 1}
                      </div>
                      {selectedProduct.observacoes && (
                        <div className="info-line-small">
                          <span className="label">Observações:</span> {selectedProduct.observacoes}
                        </div>
                      )}
                    </div>

                    {/* Título Grande */}
                    <h1 className="info-product-title">{selectedProduct.nome}</h1>

                    {/* Bloco de Detalhes */}
                    <div className="info-details-block">
                      <div className="info-row">
                        <span className="label">Valor Unitário:</span> R$ {calcularPrecoFinal(selectedProduct.preco).toFixed(2).replace('.', ',')}
                      </div>
                      {selectedProduct.descricao && (
                        <div className="info-row">
                          <span className="label">Descrição:</span> {selectedProduct.descricao}
                        </div>
                      )}
                      <div className="info-row">
                        <span className="label">Qtd peças compradas:</span> {selectedProduct.quantidade_pedidos || 0} ({selectedProduct.quantidade_clientes || 0} pessoas)
                      </div>
                      <div className="info-row">
                        <span className="label">Disponibilidade (lote):</span>{' '}
                        {disponibilidadeLoteParaExibicao(selectedProduct.qtd_minima_fornecedor, selectedProduct.quantidade_pedidos) ?? '—'}
                      </div>
                    </div>

                    {/* AVISO DE LINK FECHADO ou ÁREA DE COMPRA */}
                    <div className="info-action-area">
                      {canAddToCart(selectedProduct) ? (
                        <div className="add-to-cart-section">
                          <div className="quantity-controls-modal">
                            <button
                              onClick={() => decrementQuantity(selectedProduct.id)}
                              className="qty-btn"
                              disabled={getQuantity(selectedProduct.id) <= 1}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="qty-value">{getQuantity(selectedProduct.id)}</span>
                            <button
                              onClick={() => incrementQuantity(selectedProduct.id)}
                              className="qty-btn"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              addToCart(selectedProduct)
                              setSelectedProduct(null)
                            }}
                            disabled={addingToCart === selectedProduct.id}
                            className="btn-add-cart-modal"
                          >
                            <ShoppingCart size={18} />
                            Adicionar ao Carrinho
                          </button>
                        </div>
                      ) : (
                        <div className="closed-link-alert">
                          {getUnavailableMessage(selectedProduct)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* COLUNA 3: COMPRAS */}
                <div className="modal-col-purchases">
                  <h3 className="purchases-title">Compras</h3>

                  {loadingPurchases ? (
                    <div className="loading-purchases">Carregando...</div>
                  ) : (
                    <div className="purchases-list-container">
                      {(lot?.show_buyers_list && productPurchases.length > 0) ? (
                        <ol className="purchases-list">
                          {productPurchases.map((purchase, index) => (
                            <li key={purchase.id || index} className="purchase-item-row">
                              <div className="purchase-header">
                                <span className="purchase-name">{purchase.romaneio?.client?.nome || 'Cliente'}</span>
                                <span className="purchase-date">
                                  {new Date(purchase.created_at).toLocaleDateString('pt-BR')} {new Date(purchase.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="purchase-sub">
                                {purchase.product_name || selectedProduct.nome} - {purchase.quantidade} (qtd confirmada: {purchase.quantidade}) un. compradas
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <div className="no-purchases">
                          {productPurchases.length > 0 ? 'Lista de compradores oculta.' : 'Nenhuma compra registrada.'}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    className="btn-scroll-top"
                    onClick={() => {
                      const list = document.querySelector('.purchases-list-container');
                      if (list) list.scrollTop = 0;
                    }}
                  >
                    Ir para o topo
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
