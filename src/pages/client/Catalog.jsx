import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Plus, Minus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/common/Toast'
import LotTermsBlock from '../../components/client/LotTermsBlock'
import ClosedLotScreen from '../../components/client/ClosedLotScreen'
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
  const [selectedVariacao, setSelectedVariacao] = useState('')
  const [productPurchases, setProductPurchases] = useState([])
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  const [cartVersion, setCartVersion] = useState(0)
  /** Total comprado por produto (soma de romaneio_items) — mesma fonte da Disponibilidade (lote) no modal */
  const [totalsCompradoPorProduto, setTotalsCompradoPorProduto] = useState({})
  // Usar uma key baseada no ID para garantir que cada acesso ao catálogo seja único
  const clickTracked = useRef(new Map()) // Map<lotId, boolean> para rastrear por catálogo
  const selectedProductRef = useRef(null) // para listeners atualizarem o modal (Qtd peças compradas / pessoas)
  selectedProductRef.current = selectedProduct
  // Estados para bloqueio de lote fechado
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedLotName, setBlockedLotName] = useState(null)
  /** Mensagem de erro no modal (ex.: quantidade mínima) — exibida em vermelho, sem fechar o modal */
  const [modalAddError, setModalAddError] = useState(null)

  const { client } = useAuth()

  // Disponibilidade no lote (calculada: limite_maximo - unidades confirmadas) + flag manual_esgotado.
  const getEsgotadoNoLote = (product) => {
    const realEsgotado = esgotadoNoLote(product.qtd_minima_fornecedor, product.quantidade_pedidos)
    return realEsgotado || !!product.manual_esgotado
  }

  // Função para calcular quantidade faltando (mínimo para fechar compra coletiva)
  const getMissingQuantity = (product) => {
    const minimoLote = product.quantidade_minima_lote || 0
    const totalComprado = product.quantidade_pedidos || 0
    if (minimoLote === 0 || totalComprado >= minimoLote) return 0
    return Math.max(minimoLote - totalComprado, 0)
  }

  // Quantidade mínima por cliente (configurada no produto)
  const getMinQtyPerClient = (product) => {
    if (!product) return 1
    const raw = product.qtd_minima_cliente ?? product.quantidade_minima ?? 1
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : 1
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

  // Quando o carrinho é sincronizado (ex.: usuário removeu itens ou esvaziou no Cart), atualizar totais e modal
  useEffect(() => {
    const onCartSynced = (e) => {
      const eventLotId = e?.detail?.lotId
      if (!eventLotId) return
      const isOurCatalog = String(eventLotId) === String(lot?.id) || String(eventLotId) === String(id)
      if (!isOurCatalog) return
      const uuidToFetch = lot?.id ?? eventLotId
      loadTotalsCompradoPorProduto(uuidToFetch)
      const product = selectedProductRef.current
      if (product?.id) fetchProductPurchasesForModal(uuidToFetch, product)
    }
    window.addEventListener('cart-synced', onCartSynced)
    return () => window.removeEventListener('cart-synced', onCartSynced)
  }, [id, lot?.id])

  // Ao voltar para o catálogo (aba ou página restaurada do cache), atualizar disponibilidade e modal (ex.: após apagar do carrinho)
  useEffect(() => {
    if (!id || !lot?.id) return
    const lotId = lot.id
    const onShow = () => {
      loadTotalsCompradoPorProduto(lotId)
      const product = selectedProductRef.current
      if (product?.id) fetchProductPurchasesForModal(lotId, product)
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') onShow() }
    const onPageShow = (e) => { if (e.persisted) onShow() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [id, lot?.id])

  // Refresh atrasado ao ter lote carregado: ao voltar do Carrinho o sync pode ainda estar rodando; este refresh pega o estado final (lotes e produto de volta)
  useEffect(() => {
    if (!lot?.id) return
    const lotId = lot.id
    const t = setTimeout(() => {
      loadTotalsCompradoPorProduto(lotId)
      const product = selectedProductRef.current
      if (product?.id) fetchProductPurchasesForModal(lotId, product)
    }, 2000)
    return () => clearTimeout(t)
  }, [lot?.id])

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

      // VALIDAÇÃO: Verificar se o lote está fechado E o usuário é um cliente
      if ((lotData.status === 'fechado' || lotData.status === 'fechado_e_bloqueado') && client?.role === 'cliente') {
        console.log('🚫 Lote fechado para clientes - exibindo tela de bloqueio')
        setIsBlocked(true)
        setBlockedLotName(lotData.nome)
        setLoading(false)
        return // Não carregar produtos nem setar o lote
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
            product:products (*, preco, custo)
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
          manual_esgotado: lp.manual_esgotado ?? false
        }))
        setProducts(mapped)
        console.log('Produtos carregados:', mapped.length)
      }

      await loadTotalsCompradoPorProduto(lotIdForProducts)

    } catch (error) {
      console.error('Erro ao carregar catalogo:', error)
      toast.error('Erro ao carregar catálogo. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Função para calcular o preço final do produto com taxas do lote
  const calcularPrecoFinal = (product) => {
    // Aceita tanto um objeto produto quanto um preço direto (retrocompatibilidade)
    let precoBase
    if (product && typeof product === 'object') {
      // Se product.preco for null (coluna GENERATED ALWAYS não retornada em joins),
      // calcular a partir de custo + margem_pct como fallback
      if (product.preco != null) {
        precoBase = Number(product.preco)
      } else if (product.custo != null) {
        const margem = Number(product.margem_pct ?? 10)
        precoBase = Number(product.custo) * (1 + margem / 100)
      } else {
        precoBase = 0
      }
    } else {
      precoBase = Number(product) || 0
    }

    if (!lot || !precoBase) return precoBase || 0

    // Aplicar adicional_por_produto primeiro
    const adicional = Number(lot.adicional_por_produto) || 0
    const precoComAdicional = precoBase * (1 + adicional / 100)

    // Aplicar escritório sobre o preço com adicional
    const escritorio = Number(lot.escritorio_pct) || 0
    const precoFinal = precoComAdicional * (1 + escritorio / 100)

    return Math.round(precoFinal * 100) / 100
  }

  // Carrinho local: quantidade no carrinho por produto (para o badge verde) — mesma chave do addToCart (UUID quando tem lote); lê das duas chaves e mescla se diferente (migração de cart_<link> para cart_<uuid>)
  const cartItemsForLot = useMemo(() => {
    if (typeof window === 'undefined' || !id) return []
    const keyUuid = lot?.id ? `cart_${lot.id}` : null
    const keyLink = `cart_${id}`
    try {
      const fromUuid = keyUuid ? JSON.parse(localStorage.getItem(keyUuid) || '[]') : []
      const fromLink = JSON.parse(localStorage.getItem(keyLink) || '[]')
      if (keyUuid && keyUuid !== keyLink) {
        const byKey = new Map()
        for (const item of [...fromUuid, ...fromLink]) {
          const k = `${item.id}|${item.variacao ?? ''}`
          const existing = byKey.get(k)
          if (existing) existing.quantity = (existing.quantity || 0) + (item.quantity || 0)
          else byKey.set(k, { ...item, lot_id: lot?.id ?? item.lot_id })
        }
        return Array.from(byKey.values())
      }
      return fromLink.length ? fromLink : fromUuid
    } catch {
      return []
    }
  }, [id, lot?.id, cartVersion])

  const getCartCountForProduct = (productId) =>
    cartItemsForLot
      .filter(item => item.id === productId)
      .reduce((sum, item) => sum + (item.quantity || 0), 0)

  /** Carrega totais comprados por produto (romaneio_items) — mesma fonte da Disponibilidade (lote) no modal */
  const loadTotalsCompradoPorProduto = async (lotId) => {
    if (!lotId) return
    try {
      const { data: romaneios } = await supabase
        .from('romaneios')
        .select('id')
        .eq('lot_id', lotId)
        .not('status_pagamento', 'in', '(cancelado,rejeitado)')
      if (!romaneios?.length) {
        setTotalsCompradoPorProduto({})
        return
      }
      const { data: items } = await supabase
        .from('romaneio_items')
        .select('product_id, quantidade')
        .in('romaneio_id', romaneios.map(r => r.id))
      const byProduct = {}
      ;(items || []).forEach(item => {
        const pid = item.product_id
        byProduct[pid] = (byProduct[pid] || 0) + (item.quantidade || 0)
      })
      setTotalsCompradoPorProduto(byProduct)
    } catch (e) {
      console.warn('Erro ao carregar totais comprados:', e)
      setTotalsCompradoPorProduto({})
    }
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

  /** Atualiza a lista de compras do modal (para "Qtd peças compradas" e "X pessoas" refletirem remoção do carrinho) */
  const fetchProductPurchasesForModal = async (lotId, product) => {
    if (!lotId || !product?.id) {
      setProductPurchases([])
      return
    }
    try {
      const { data: romaneios, error: romError } = await supabase
        .from('romaneios')
        .select(`
          id,
          client_id,
          created_at,
          status_pagamento,
          client:clients(nome)
        `)
        .eq('lot_id', lotId)
        .not('status_pagamento', 'in', '(cancelado,rejeitado)')
      if (romError || !romaneios?.length) {
        setProductPurchases([])
        return
      }
      const romaneioIds = romaneios.map(r => r.id)
      const { data: purchases, error: itemsError } = await supabase
        .from('romaneio_items')
        .select('*')
        .eq('product_id', product.id)
        .in('romaneio_id', romaneioIds)
        .order('created_at', { ascending: false })
      if (itemsError) {
        setProductPurchases([])
        return
      }
      const purchasesWithRomaneio = (purchases || []).map(item => {
        const romaneio = romaneios.find(r => r.id === item.romaneio_id)
        return { ...item, romaneio: romaneio || null }
      })
      setProductPurchases(purchasesWithRomaneio)
    } catch (e) {
      setProductPurchases([])
    }
  }

  const handleProductClick = async (product) => {
    setModalAddError(null)
    setSelectedProduct(product)
    const opts = product?.variacoes ? String(product.variacoes).split(',').map(s => s.trim()).filter(Boolean) : []
    setSelectedVariacao(opts?.length ? opts[0] : '')
    setLoadingPurchases(true)
    loadTotalsCompradoPorProduto(lot?.id)

    try {
      if (!lot?.id) {
        setProductPurchases([])
        setLoadingPurchases(false)
        return
      }
      await fetchProductPurchasesForModal(lot.id, product)
    } catch (error) {
      console.error('Erro ao buscar compras:', error)
      setProductPurchases([])
    } finally {
      setLoadingPurchases(false)
    }
  }

  const syncCartToServer = async (cartItems) => {
    if (!client?.auth_id || !cartItems?.length) return
    const lotUuid = lot?.id || cartItems[0]?.lot_id
    if (!lotUuid) return
    try {
      const itemsPayload = cartItems.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        valor_unitario: item.preco,
        variacao: item.variacao ?? ''
      }))
      const clientSnapshot = {
        nome: client.nome,
        telefone: client.telefone,
        endereco: client.enderecos?.[0] || null
      }
      await supabase.rpc('checkout_romaneio', {
        p_lot_id: lotUuid,
        p_items: itemsPayload,
        p_client_snapshot: clientSnapshot
      })
    } catch (e) {
      if (!e?.message?.includes('não está aberto')) console.warn('Sync carrinho:', e)
    }
  }

  const addToCart = async (product, variacao = '') => {
    const qty = getQuantity(product.id)
    const variacaoNorm = (variacao || '').trim()
    // Validar quantidade mínima por cliente
    const minClient = getMinQtyPerClient(product)
    if (qty < minClient) {
      const unidadeText = minClient === 1 ? 'unidade' : 'unidades'
      setModalAddError(`A quantidade mínima para este produto é ${minClient} ${unidadeText}.`)
      return false
    }

    // Avisar cliente sobre restrição de remoção (uma vez por sessão por lote)
    const permitirMod = lot?.permitir_modificacao_produtos
    if (permitirMod === 'nao_permitir' || permitirMod === 'permitir_reduzir_nao_excluir') {
      const warnKey = `cart_warn_nodeletion_${lot?.id ?? id}`
      if (!sessionStorage.getItem(warnKey)) {
        sessionStorage.setItem(warnKey, '1')
        toast.warning('Atenção: produtos adicionados a este catálogo não poderão ser removidos. Certifique-se antes de adicionar.')
      }
    }

    setModalAddError(null)
    setAddingToCart(product.id)
    try {
      const cartKey = `cart_${lot?.id ?? id}`
      const currentCart = JSON.parse(localStorage.getItem(cartKey) || '[]')

      const precoFinal = calcularPrecoFinal(product)

      const existingInfo = currentCart.find(
        item => item.id === product.id && (item.variacao ?? '') === variacaoNorm
      )
      let newCart

      if (existingInfo) {
        newCart = currentCart.map(item =>
          item.id === product.id && (item.variacao ?? '') === variacaoNorm
            ? { ...item, quantity: item.quantity + qty, preco: precoFinal, lot_id: lot?.id ?? item.lot_id }
            : item
        )
      } else {
        newCart = [...currentCart, {
          ...product,
          preco: precoFinal,
          quantity: qty,
          lot_id: lot?.id ?? id,
          variacao: variacaoNorm
        }]
      }

      localStorage.setItem(cartKey, JSON.stringify(newCart))
      setCartVersion(v => v + 1)
      const lotUuid = lot?.id
      if (client?.auth_id) {
        setTotalsCompradoPorProduto(prev => {
          const prevTotal = prev[product.id] ?? 0
          return { ...prev, [product.id]: prevTotal + qty }
        })
        await syncCartToServer(newCart)
        if (lotUuid) await loadTotalsCompradoPorProduto(lotUuid)
        toast.success(`${qty}x ${product.nome}${variacaoNorm ? ` (${variacaoNorm})` : ''} adicionado ao carrinho!`)
      } else {
        toast.warning('Adicionado ao carrinho. Faça login para que sua compra seja contabilizada e apareça na lista de compradores.')
      }

      setQuantities(prev => ({ ...prev, [product.id]: 1 }))
      await new Promise(r => setTimeout(r, 300))
      return true
    } catch (e) {
      console.error(e)
      toast.error('Erro ao adicionar produto ao carrinho')
      return false
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
      <div className="client-page catalog-page p-8 flex items-center justify-center">
        <div className="text-slate-500">Carregando catálogo...</div>
      </div>
    )
  }

  // Se o lote está bloqueado para clientes, exibir tela de bloqueio
  if (isBlocked) {
    return <ClosedLotScreen lotName={blockedLotName} />
  }

  if (!lot) {
    return (
      <div className="client-page catalog-page p-8 flex flex-col items-center justify-center gap-4">
        <div className="text-red-500">Não foi possível carregar o catálogo.</div>
        <button onClick={() => navigate('/app')} className="text-blue-500 underline">
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="client-page catalog-page">
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
      <div className="catalog-content-wrapper" style={{ maxWidth: '1200px', margin: '0 auto' }}>

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
                  {/* BADGE VERMELHA: Faltam X peças — usa mesma variável da Disponibilidade (lote) */}
                  {(() => {
                    const minimoLote = product.quantidade_minima_lote || 0
                    const totalComprado = totalsCompradoPorProduto[product.id] ?? product.quantidade_pedidos ?? 0
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

                  {/* BADGE VERDE: quantidade comprada do produto (total de todos os clientes / romaneio) */}
                  <div className="quantity-badge quantity-purchased">
                    {totalsCompradoPorProduto[product.id] ?? 0}
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
        <div className="product-modal-overlay" onClick={() => { setModalAddError(null); setSelectedProduct(null) }}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header: Título Esquerda, X Direita */}
            <div className="product-modal-header">
              <h2>Detalhes do Produto</h2>
              <button
                className="btn-close-modal"
                onClick={() => { setModalAddError(null); setSelectedProduct(null) }}
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
                        <span className="label">Qtd mínima por cliente:</span> {getMinQtyPerClient(selectedProduct)}
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
                        <span className="label">Valor Unitário:</span> R$ {calcularPrecoFinal(selectedProduct).toFixed(2).replace('.', ',')}
                      </div>
                      {selectedProduct.descricao && (
                        <div className="info-row">
                          <span className="label">Descrição:</span> {selectedProduct.descricao}
                        </div>
                      )}
                      <div className="info-row">
                        <span className="label">Qtd peças compradas:</span>{' '}
                        {(() => {
                          if (loadingPurchases) return '… (…)'
                          const totalPeças = productPurchases.reduce((s, p) => s + (p.quantidade || 0), 0)
                          const numPessoas = new Set(productPurchases.map(p => p.romaneio?.client_id).filter(Boolean)).size
                          const pessoasText = `${numPessoas} ${numPessoas === 1 ? 'pessoa' : 'pessoas'}`
                          return `${totalPeças} (${pessoasText})`
                        })()}
                      </div>
                      <div className="info-row">
                        <span className="label">Disponibilidade (lote):</span>{' '}
                        {loadingPurchases
                          ? '…'
                          : (disponibilidadeLoteParaExibicao(
                              selectedProduct.qtd_minima_fornecedor,
                              productPurchases.reduce((s, p) => s + (p.quantidade || 0), 0)
                            ) ?? '—')}
                      </div>
                      {selectedProduct.variacoes && (
                        <div className="info-row">
                          <span className="label">Variação:</span>
                          <select
                            value={selectedVariacao}
                            onChange={(e) => setSelectedVariacao(e.target.value)}
                            className="variacao-select"
                            style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 4, minWidth: 120 }}
                          >
                            {String(selectedProduct.variacoes).split(',').map(s => s.trim()).filter(Boolean).map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* AVISO DE LINK FECHADO ou ÁREA DE COMPRA */}
                    <div className="info-action-area">
                      {canAddToCart(selectedProduct) ? (
                        <div className="add-to-cart-section">
                          <div className="quantity-controls-modal">
                            <button
                              onClick={() => { setModalAddError(null); decrementQuantity(selectedProduct.id) }}
                              className="qty-btn"
                              disabled={getQuantity(selectedProduct.id) <= 1}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="qty-value">{getQuantity(selectedProduct.id)}</span>
                            <button
                              onClick={() => { setModalAddError(null); incrementQuantity(selectedProduct.id) }}
                              className="qty-btn"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          {modalAddError && (
                            <p className="catalog-modal-min-error" role="alert">{modalAddError}</p>
                          )}
                          <button
                            onClick={async () => {
                              const ok = await addToCart(selectedProduct, selectedVariacao)
                              if (ok) {
                                setSelectedProduct(null)
                                setSelectedVariacao('')
                              }
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
                      {(() => {
                        const cartCount = selectedProduct ? getCartCountForProduct(selectedProduct.id) : 0
                        const hasPurchases = productPurchases.length > 0
                        const showList = lot?.show_buyers_list && hasPurchases
                        if (showList) {
                          // Agrupar compras por cliente para somar quantidade total
                          const byClient = new Map()
                          productPurchases.forEach(purchase => {
                            const clientId = purchase.romaneio?.client_id || purchase.romaneio?.client?.id || purchase.romaneio_id
                            const nome = purchase.romaneio?.client?.nome || 'Cliente'
                            const quantidade = purchase.quantidade || 0
                            const createdAt = purchase.created_at ? new Date(purchase.created_at) : null
                            const key = clientId || nome

                            if (!byClient.has(key)) {
                              byClient.set(key, {
                                nome,
                                totalQuantidade: quantidade,
                                lastDate: createdAt
                              })
                            } else {
                              const entry = byClient.get(key)
                              entry.totalQuantidade += quantidade
                              if (createdAt && (!entry.lastDate || createdAt > entry.lastDate)) {
                                entry.lastDate = createdAt
                              }
                              byClient.set(key, entry)
                            }
                          })

                          const grouped = Array.from(byClient.values()).sort((a, b) => {
                            if (!a.lastDate || !b.lastDate) return 0
                            return b.lastDate - a.lastDate
                          })

                          return (
                            <ol className="purchases-list">
                              {grouped.map((entry, index) => (
                                <li key={index} className="purchase-item-row">
                                  <div className="purchase-header">
                                    <span className="purchase-name">{entry.nome}</span>
                                    {entry.lastDate && (
                                      <span className="purchase-date">
                                        {entry.lastDate.toLocaleDateString('pt-BR')}{' '}
                                        {entry.lastDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                  <div className="purchase-sub">
                                    {entry.totalQuantidade} un. compradas neste produto
                                  </div>
                                </li>
                              ))}
                            </ol>
                          )
                        }
                        return (
                          <div className="no-purchases">
                            {hasPurchases ? 'Lista de compradores oculta.' : cartCount > 0 ? `Você tem ${cartCount} un. no carrinho.` : 'Nenhuma compra registrada.'}
                          </div>
                        )
                      })()}
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
