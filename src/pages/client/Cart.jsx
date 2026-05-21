import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Trash2, ArrowRight, Plus, Minus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/common/Toast'
import { calcPrecoClienteNoLote } from '../../utils/pricing'
import './Cart.css'

const SYNC_DEBOUNCE_MS = 800

const PERMITIR_VALIDOS = ['permitir_reduzir_excluir', 'nao_permitir', 'permitir_reduzir_nao_excluir']
/** Valor efetivo da regra do lote: se null/undefined/inválido, usa permitir_reduzir_excluir (mesmo comportamento antigo para nulo). */
function permitirEfetivo(val) {
    if (val != null && PERMITIR_VALIDOS.includes(String(val))) return String(val)
    // Nulo ou inválido: considerar como permitir reduzir/excluir, mantendo compatibilidade
    return 'permitir_reduzir_excluir'
}

/** Taxa de separação: até R$ 80 = R$ 15, acima de R$ 80 = R$ 25 */
function getTaxaSeparacao(subtotal) {
    const n = Number(subtotal) || 0
    return n <= 80 ? 15 : 25
}

/** Por lotId -> productId -> { limit, totalPedidos, ourQuantityAtLoad }. available = limit - totalPedidos + ourQuantityAtLoad - currentQty (considera qtd atual no carrinho). */
const norm = (x) => (x == null ? '' : String(x))

export default function Cart() {
    const navigate = useNavigate()
    const { user, client } = useAuth()
    const toast = useToast()
    const [cartItems, setCartItems] = useState([])
    const [groupedItems, setGroupedItems] = useState({})
    const [productAvailability, setProductAvailability] = useState({}) // { [lotId]: { [productId]: { limit, totalPedidos } } }
    const [loading, setLoading] = useState(true)
    const syncTimeoutRef = useRef({})
    const pendingSyncsRef = useRef(new Set()) // Lotes que precisam de sync assim que o client carregar

    useEffect(() => {
        loadCart()
        // Disparar syncs pendentes se o client acabou de carregar
        if (client?.auth_id && pendingSyncsRef.current.size > 0) {
            pendingSyncsRef.current.forEach(lotId => {
                console.log(`Cart: Disparando sync pendente para lote ${lotId}`)
                syncCartToServer(lotId).then(res => {
                    if (res?.error) toast.error(`Erro ao sincronizar carrinho: ${res.error}`)
                })
            })
            pendingSyncsRef.current.clear()
        }
    }, [client?.id])

    const loadCart = async () => {
        setLoading(true)
        // openDrafts scoped here so it's accessible further down (line 261 check)
        let openDrafts = []
        try {
            // Se o cliente está logado, trazer do servidor o estado do romaneio (rascunho) para lotes ainda abertos.
            // Assim, alterações feitas pelo admin no romaneio refletem no carrinho do cliente.
            if (client?.id) {
                const { data: draftRomaneios } = await supabase
                    .from('romaneios')
                    .select('id, lot_id, lot:lots(id, status, link_compra, adicional_por_produto, escritorio_pct)')
                    .eq('client_id', client.id)
                    .in('status_pagamento', ['aguardando_pagamento', 'aguardando', 'pendente', 'gerado', 'pago_50_pct', 'pago_50_pct_s_frete', 'parcialmente_pago'])

                openDrafts = (draftRomaneios || []).filter(
                    r => r.lot?.status === 'aberto' || r.lot?.status === 'pronto_e_aberto'
                )

                for (const rom of openDrafts) {
                    const lotId = rom.lot_id || rom.lot?.id
                    if (!lotId) continue

                    const { data: serverItems, error: serverItemsError } = await supabase
                        .from('romaneio_items')
                        .select('product_id, quantidade, preco_unitario, variacao, product:products(id, nome, imagem1, preco, custo, margem_pct)')
                        .eq('romaneio_id', rom.id)

                    // Se houve erro ao buscar itens do servidor, não sobrescrever localStorage
                    if (serverItemsError) {
                        console.warn('Cart: erro ao buscar itens do servidor, mantendo localStorage:', serverItemsError.message)
                        continue
                    }

                    const cartItemsFromServer = (serverItems || []).map(ri => {
                        // If preco_unitario was saved correctly, use it.
                        // Otherwise, recalculate using centralized pricing (includes lot margins).
                        const precoFinal = (ri.preco_unitario != null && Number(ri.preco_unitario) > 0)
                            ? Number(ri.preco_unitario)
                            : calcPrecoClienteNoLote(ri.product, rom.lot)
                        return {
                            id: ri.product_id,
                            quantity: ri.quantidade || 0,
                            preco: precoFinal,
                            variacao: ri.variacao ?? '',
                            lot_id: lotId,
                            nome: ri.product?.nome ?? '',
                            imagem1: ri.product?.imagem1 ?? null
                        }
                    }).filter(i => i.quantity > 0)

                    const key = String(lotId)
                    const localKey = `cart_${key}`

                    // Proteção contra race condition: não sobrescrever localStorage com
                    // dados do servidor se o servidor tiver MENOS itens que o local.
                    // Isso acontece quando uma chamada de sync antiga chegou ao servidor
                    // depois de uma nova e sobrescreveu com um carrinho menor.
                    // Nesse caso, o localStorage (mais novo) prevalece e será re-sincronizado.
                    const localItems = (() => {
                        try { return JSON.parse(localStorage.getItem(localKey) || '[]') } catch { return [] }
                    })()
                    const localTotal = localItems.reduce((s, i) => s + (i.quantity || 0), 0)
                    const serverTotal = cartItemsFromServer.reduce((s, i) => s + (i.quantity || 0), 0)

                    if (cartItemsFromServer.length > 0 || localItems.length === 0) {
                        // Servidor tem dados: sobrescrever local com estado autoritativo do servidor
                        // OU local está vazio: aceitar o que o servidor tem (pode ser 0)
                        if (serverTotal >= localTotal || localItems.length === 0) {
                            localStorage.setItem(localKey, JSON.stringify(cartItemsFromServer))
                        } else {
                            // Servidor tem menos itens que o local — possível artifact de race condition.
                            // Manter o localStorage e agendar re-sync para corrigir o servidor.
                            console.warn(`Cart: servidor tem ${serverTotal} itens mas local tem ${localTotal}. Mantendo local e re-sincronizando servidor.`)
                            // Re-sincronizar o local → servidor para corrigir o estado do banco
                            const itemsPayload = localItems.map(item => ({
                                product_id: item.id,
                                quantity: item.quantity,
                                valor_unitario: item.preco,
                                variacao: item.variacao ?? ''
                            }))
                            // Fire-and-forget: não aguardar para não bloquear o carregamento
                            supabase.rpc('checkout_romaneio', {
                                p_lot_id: typeof lotId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(lotId) ? lotId : (rom.lot?.id ?? lotId),
                                p_items: itemsPayload,
                                p_client_snapshot: {}
                            }).then(({ error }) => {
                                if (error && !error.message?.includes('não está aberto')) {
                                    console.warn('Cart: re-sync do local para servidor falhou:', error.message)
                                }
                            })
                        }
                    }
                    // Se servidor retornou [] e local também tem [], não fazer nada (nenhuma mudança)

                    const linkCompra = rom.lot?.link_compra
                    if (linkCompra && String(linkCompra) !== String(lotId)) {
                        localStorage.removeItem(`cart_${linkCompra}`)
                    }
                }

            }

            // Ler de todas as chaves cart_lotID do localStorage
            const allItems = []
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.startsWith('cart_')) {
                    try {
                        const items = JSON.parse(localStorage.getItem(key))
                        if (Array.isArray(items)) {
                            allItems.push(...items)
                        }
                    } catch { /* ignore malformed entries */ }
                }
            }

            // Agrupar por lot_id
            const grouped = {}

            // Normalizar lot_id sempre como string para evitar 507 vs "507" no lookup
            const norm = (id) => (id == null ? '' : String(id))
            // Buscar infos dos lotes (por id UUID e por link_compra) para aplicar permitir_modificacao_produtos
            const lotIds = [...new Set(allItems.map(i => norm(i.lot_id)))]
            let lotsMap = {}

            if (lotIds.length > 0) {
                const uuidIds = lotIds.filter(l => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(l))
                const linkIds = lotIds.filter(l => !uuidIds.includes(l))
                const lotsList = []
                if (uuidIds.length > 0) {
                    const { data: byId } = await supabase
                        .from('lots')
                        .select('id, nome, status, data_fim, permitir_modificacao_produtos, exigir_dados_galvanica, link_compra')
                        .in('id', uuidIds)
                    if (byId?.length) lotsList.push(...byId)
                }
                if (linkIds.length > 0) {
                    const { data: byLink } = await supabase
                        .from('lots')
                        .select('id, nome, status, data_fim, permitir_modificacao_produtos, exigir_dados_galvanica, link_compra')
                        .in('link_compra', linkIds)
                    if (byLink?.length) lotsList.push(...byLink)
                }
                lotsList.forEach(l => {
                    lotsMap[norm(l.id)] = l
                    if (l.link_compra != null && l.link_compra !== '') lotsMap[norm(l.link_compra)] = l
                })
            }

            const fallbackLot = {
                nome: 'Link Indisponível',
                status: 'fechado',
                permitir_modificacao_produtos: 'nao_permitir'
            }
            allItems.forEach(item => {
                const key = norm(item.lot_id)
                if (!grouped[key]) {
                    grouped[key] = {
                        lot: lotsMap[key] || fallbackLot,
                        items: [],
                        total: 0
                    }
                }
                grouped[key].items.push(item)
                grouped[key].total += item.preco * item.quantity
            })

            // Ocultar da exibição os grupos cujo link já foi fechado.
            // IMPORTANTE: NÃO apagar o localStorage — o romaneio continua no banco
            // e o admin precisa ver o pedido. Apenas escondemos da tela do cliente.
            // Manter tanto 'aberto' quanto 'pronto_e_aberto' visíveis (cliente pode ver o carrinho em ambos)
            for (const lotId of Object.keys(grouped)) {
                const s = grouped[lotId].lot.status
                if (s !== 'aberto' && s !== 'pronto_e_aberto') {
                    delete grouped[lotId]
                }
            }

            // Disponibilidade por produto no lote; ourQuantityAtLoad = nossa qtd quando carregamos (para calcular disponível ao diminuir)
            const availabilityByLot = {}
            for (const lotId of Object.keys(grouped)) {
                const lotUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)
                    ? lotId
                    : (lotsMap[lotId]?.id ?? lotId)
                const { data: lpData } = await supabase
                    .from('lot_products')
                    .select('product_id, quantidade_pedidos, product:products(qtd_minima_fornecedor)')
                    .eq('lot_id', lotUuid)
                const groupItems = grouped[lotId]?.items ?? []
                if (lpData?.length) {
                    availabilityByLot[lotId] = {}
                    lpData.forEach(lp => {
                        const limit = lp.product?.qtd_minima_fornecedor != null ? Number(lp.product.qtd_minima_fornecedor) : 0
                        const totalPedidos = Number(lp.quantidade_pedidos) || 0
                        const ourQuantityAtLoad = groupItems
                            .filter(i => norm(i.id) === norm(lp.product_id))
                            .reduce((s, i) => s + (i.quantity || 0), 0)
                        availabilityByLot[lotId][norm(lp.product_id)] = { limit, totalPedidos, ourQuantityAtLoad }
                    })
                }
            }
            setProductAvailability(availabilityByLot)

            const remainingItems = Object.values(grouped).flatMap(g => g.items)
            setGroupedItems(grouped)
            setCartItems(remainingItems)

            // ✅ NOVO: Verificar se algum lote local NÃO tem correspondente no servidor (openDrafts)
            // Se o usuário está logado, devemos garantir que o servidor saiba desses itens.
            if (client?.auth_id) {
                // Atualizar owner ID
                localStorage.setItem('cart_owner_id', client.auth_id)

                const serverLotIds = new Set((openDrafts || []).map(r => norm(r.lot_id || r.lot?.id)))
                for (const lotId of Object.keys(grouped)) {
                    const lotUuid = lotsMap[lotId]?.id || lotId
                    if (!serverLotIds.has(norm(lotUuid))) {
                        console.log(`Cart: Lote ${lotId} está no local mas não no servidor. Sincronizando...`)
                        syncCartToServer(lotId).then(res => {
                            if (res?.error) toast.error(`Erro ao sincronizar carrinho: ${res.error}`)
                        })
                    }
                }
            } else if (user) {
                // Se temos user mas não client ainda, marcar para sync posterior
                for (const lotId of Object.keys(grouped)) {
                    pendingSyncsRef.current.add(lotId)
                }
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    /** Reverte apenas o carrinho de um lote a partir do servidor (sem recarregar a tela toda). */
    const revertLotFromServer = async (lotId) => {
        if (!client?.id) return
        const lotUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)
            ? lotId
            : (groupedItems[lotId]?.lot?.id ?? lotId)
        try {
            const { data: rom } = await supabase
                .from('romaneios')
                .select('id')
                .eq('lot_id', lotUuid)
                .eq('client_id', client.id)
                .in('status_pagamento', ['aguardando_pagamento', 'aguardando', 'pendente', 'gerado', 'pago_50_pct', 'pago_50_pct_s_frete', 'parcialmente_pago'])
                .maybeSingle()
            const items = []
            if (rom?.id) {
                const { data: serverItems } = await supabase
                    .from('romaneio_items')
                    .select('product_id, quantidade, preco_unitario, variacao, product:products(id, nome, imagem1, preco, custo, margem_pct)')
                    .eq('romaneio_id', rom.id)
                // Fetch lot data for pricing
                const { data: lotData } = await supabase
                    .from('lots')
                    .select('id, adicional_por_produto, escritorio_pct')
                    .eq('id', lotUuid)
                    .single()
                const list = (serverItems || []).map(ri => {
                    const precoFinal = (ri.preco_unitario != null && Number(ri.preco_unitario) > 0)
                        ? Number(ri.preco_unitario)
                        : calcPrecoClienteNoLote(ri.product, lotData)
                    return {
                        id: ri.product_id,
                        quantity: ri.quantidade || 0,
                        preco: precoFinal,
                        variacao: ri.variacao ?? '',
                        lot_id: lotUuid,
                        nome: ri.product?.nome ?? '',
                        imagem1: ri.product?.imagem1 ?? null
                    }
                }).filter(i => i.quantity > 0)
                items.push(...list)
            }
            const key = String(lotUuid)
            localStorage.setItem(`cart_${key}`, JSON.stringify(items))
            if (norm(lotId) !== norm(lotUuid)) {
                localStorage.setItem(`cart_${lotId}`, JSON.stringify(items))
            }
            const group = groupedItems[lotId]
            const total = items.reduce((s, i) => s + i.preco * i.quantity, 0)
            setGroupedItems(prev => ({ ...prev, [lotId]: { ...group, items, total } }))
            setCartItems(prev => {
                const rest = prev.filter(i => norm(i.lot_id) !== norm(lotId) && norm(i.lot_id) !== norm(lotUuid))
                return [...rest, ...items]
            })
            const { data: lpData } = await supabase
                .from('lot_products')
                .select('product_id, quantidade_pedidos, product:products(qtd_minima_fornecedor)')
                .eq('lot_id', lotUuid)
            if (lpData?.length) {
                const next = {}
                lpData.forEach(lp => {
                    const limit = lp.product?.qtd_minima_fornecedor != null ? Number(lp.product.qtd_minima_fornecedor) : 0
                    const totalPedidos = Number(lp.quantidade_pedidos) || 0
                    const ourQuantityAtLoad = items
                        .filter(i => norm(i.id) === norm(lp.product_id))
                        .reduce((s, i) => s + (i.quantity || 0), 0)
                    next[norm(lp.product_id)] = { limit, totalPedidos, ourQuantityAtLoad }
                })
                setProductAvailability(prev => ({ ...prev, [lotId]: next }))
            }
        } catch (e) {
            console.warn('Revert lot:', e)
        }
    }

    /** Quando o sync falha por estoque: limita o carrinho à disponibilidade (volta para o máximo permitido, não para o estado anterior). */
    const capLotToAvailability = async (lotId) => {
        if (!client?.id) return
        const lotUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)
            ? lotId
            : (groupedItems[lotId]?.lot?.id ?? lotId)
        const key = `cart_${lotId}`
        let items = JSON.parse(localStorage.getItem(key) || '[]')
        const altKey = norm(lotId) !== norm(lotUuid) ? `cart_${lotUuid}` : null
        if (items.length === 0 && altKey) {
            items = JSON.parse(localStorage.getItem(altKey) || '[]')
        }
        if (items.length === 0) return
        try {
            const [{ data: rom }, { data: lpData }] = await Promise.all([
                supabase.from('romaneios').select('id').eq('lot_id', lotUuid).eq('client_id', client.id).in('status_pagamento', ['aguardando_pagamento', 'aguardando', 'pendente', 'gerado', 'pago_50_pct', 'pago_50_pct_s_frete', 'parcialmente_pago']).maybeSingle(),
                supabase.from('lot_products').select('product_id, quantidade_pedidos, product:products(qtd_minima_fornecedor)').eq('lot_id', lotUuid)
            ])
            let serverItems = []
            if (rom?.id) {
                const { data: serverRows } = await supabase.from('romaneio_items').select('product_id, quantidade, preco_unitario, variacao, product:products(id, nome, imagem1, preco, custo, margem_pct)').eq('romaneio_id', rom.id)
                // Fetch lot data for pricing fallback
                const { data: lotDataForPricing } = await supabase.from('lots').select('id, adicional_por_produto, escritorio_pct').eq('id', lotUuid).single()
                serverRows?.forEach(ri => {
                    const precoFinal = (ri.preco_unitario != null && Number(ri.preco_unitario) > 0)
                        ? Number(ri.preco_unitario)
                        : calcPrecoClienteNoLote(ri.product, lotDataForPricing)
                    serverItems.push({
                        id: ri.product_id,
                        quantity: ri.quantidade || 0,
                        preco: precoFinal,
                        variacao: ri.variacao ?? '',
                        lot_id: lotUuid,
                        nome: ri.product?.nome ?? '',
                        imagem1: ri.product?.imagem1 ?? null
                    })
                })
            }
            const avByProduct = {}
            lpData?.forEach(lp => {
                const limit = lp.product?.qtd_minima_fornecedor != null ? Number(lp.product.qtd_minima_fornecedor) : 0
                const totalPedidos = Number(lp.quantidade_pedidos) || 0
                avByProduct[norm(lp.product_id)] = { limit, totalPedidos }
            })
            const serverQtyByProduct = {}
            serverItems.forEach(i => {
                const pid = norm(i.id)
                serverQtyByProduct[pid] = (serverQtyByProduct[pid] || 0) + (i.quantity || 0)
            })
            const currentQtyByProduct = {}
            items.forEach(i => {
                const pid = norm(i.id)
                currentQtyByProduct[pid] = (currentQtyByProduct[pid] || 0) + (i.quantity || 0)
            })
            const maxAllowedByProduct = {}
            Object.keys(avByProduct).forEach(pid => {
                const { limit, totalPedidos } = avByProduct[pid]
                if (limit <= 0) return
                const ourServer = serverQtyByProduct[pid] || 0
                maxAllowedByProduct[pid] = Math.max(0, limit - totalPedidos + ourServer)
            })
            let needCap = false
            const newItems = []
            const reducedByProduct = {}
            for (const item of items) {
                const pid = norm(item.id)
                const maxAllowed = maxAllowedByProduct[pid]
                if (maxAllowed == null) {
                    newItems.push({ ...item })
                    continue
                }
                const soFar = reducedByProduct[pid] || 0
                const maxForThisLine = Math.max(0, maxAllowed - soFar)
                const newQty = Math.min(item.quantity || 0, maxForThisLine)
                if (newQty < (item.quantity || 0)) needCap = true
                reducedByProduct[pid] = soFar + newQty
                newItems.push({ ...item, quantity: newQty })
            }
            const finalItems = newItems.filter(i => (i.quantity || 0) > 0)
            if (!needCap && finalItems.length === items.length) {
                revertLotFromServer(lotId)
                return
            }
            const storageKey = String(norm(lotId) === norm(lotUuid) ? lotUuid : lotId)
            localStorage.setItem(`cart_${storageKey}`, JSON.stringify(finalItems))
            if (altKey && storageKey !== altKey.replace('cart_', '')) {
                localStorage.setItem(altKey, JSON.stringify(finalItems))
            }
            const group = groupedItems[lotId]
            const total = finalItems.reduce((s, i) => s + i.preco * i.quantity, 0)
            const availabilityNext = {}
            lpData?.forEach(lp => {
                const limit = lp.product?.qtd_minima_fornecedor != null ? Number(lp.product.qtd_minima_fornecedor) : 0
                const totalPedidos = Number(lp.quantidade_pedidos) || 0
                const ourQuantityAtLoad = finalItems.filter(i => norm(i.id) === norm(lp.product_id)).reduce((s, i) => s + (i.quantity || 0), 0)
                availabilityNext[norm(lp.product_id)] = { limit, totalPedidos, ourQuantityAtLoad }
            })
            setProductAvailability(prev => ({ ...prev, [lotId]: availabilityNext }))
            setGroupedItems(prev => ({ ...prev, [lotId]: { ...group, items: finalItems, total } }))
            setCartItems(prev => {
                const rest = prev.filter(i => norm(i.lot_id) !== norm(lotId) && norm(i.lot_id) !== norm(lotUuid))
                return [...rest, ...finalItems]
            })
        } catch (e) {
            console.warn('Cap lot:', e)
            revertLotFromServer(lotId)
        }
    }

    const syncCartToServer = async (lotId) => {
        if (!user || !client?.auth_id) return { error: null }
        const key = `cart_${lotId}`
        const items = JSON.parse(localStorage.getItem(key) || '[]')
        let lotUuid = lotId
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)
        
        if (!isUuid) {
            // Tentar resolver link amigável para UUID
            const { data, error: lookupError } = await supabase
                .from('lots')
                .select('id')
                .or(`link_compra.eq.${lotId},nome.ilike.%${lotId}%`) // Tenta por link ou nome (ex: 518)
                .limit(1)
                .maybeSingle()
            
            if (data?.id) {
                lotUuid = data.id
            } else {
                console.warn(`Cart: Não foi possível resolver o ID do lote para "${lotId}". RPC pode falhar.`, lookupError)
            }
        }

        try {
            if (items.length === 0) {
                await supabase.rpc('clear_draft_romaneio', { p_lot_id: lotUuid })
                window.dispatchEvent(new CustomEvent('cart-synced', { detail: { lotId: lotUuid } }))
                return { error: null }
            }
            const itemsPayload = items.map(item => ({
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
            const { error } = await supabase.rpc('checkout_romaneio', {
                p_lot_id: lotUuid,
                p_items: itemsPayload,
                p_client_snapshot: clientSnapshot
            })
            if (error) {
                if (!error.message?.includes('não está aberto')) {
                    console.warn('Sync carrinho:', error.message)
                }
                const isAvailabilityError = /disponibilidade|insuficiente|esgotado/i.test(error.message || '')
                const message = isAvailabilityError
                    ? 'Este produto está esgotado neste catálogo. Não foi possível aumentar a quantidade.'
                    : error.message
                return { error: message }
            }
            window.dispatchEvent(new CustomEvent('cart-synced', { detail: { lotId: lotUuid } }))
            return { error: null }
        } catch (e) {
            console.warn('Sync carrinho:', e)
            const msg = e?.message || String(e)
            const isAvailabilityError = /disponibilidade|insuficiente|esgotado/i.test(msg)
            return {
                error: isAvailabilityError
                    ? 'Este produto está esgotado neste catálogo. Não foi possível atualizar a quantidade.'
                    : msg
            }
        }
    }

    const scheduleSync = (lotId) => {
        if (syncTimeoutRef.current[lotId]) clearTimeout(syncTimeoutRef.current[lotId])
        syncTimeoutRef.current[lotId] = setTimeout(() => {
            syncCartToServer(lotId).then((result) => {
                delete syncTimeoutRef.current[lotId]
                if (result?.error) {
                    toast.error(result.error)
                    const isAvailabilityError = /disponibilidade|insuficiente|esgotado/i.test(result.error)
                    if (isAvailabilityError) {
                        capLotToAvailability(lotId)
                    } else {
                        revertLotFromServer(lotId)
                    }
                }
            })
        }, SYNC_DEBOUNCE_MS)
    }

    /** Disponibilidade para adicionar: considera qtd atual no carrinho. <= 0 = não pode subir mais. */
    const getAvailable = (lotId, productId, currentQuantityInCart) => {
        const av = productAvailability[lotId]?.[norm(productId)]
        if (!av || av.limit == null || av.limit <= 0) return null
        const ourAtLoad = av.ourQuantityAtLoad ?? 0
        const totalPedidos = av.totalPedidos ?? 0
        return Math.max(0, (av.limit || 0) - totalPedidos + ourAtLoad - (currentQuantityInCart || 0))
    }

    const updateQuantity = (lotId, itemId, delta) => {
        const group = groupedItems[lotId]
        // Garantir leitura do carrinho na chave correta (pode ser UUID ou link_compra conforme origem dos itens)
        const norm = (x) => (x == null ? '' : String(x))
        let key = `cart_${lotId}`
        let items = JSON.parse(localStorage.getItem(key) || '[]')
        if (items.length === 0 && group?.lot) {
            const altId = group.lot.id && norm(group.lot.id) !== norm(lotId) ? `cart_${group.lot.id}` : null
            const altLink = group.lot.link_compra != null && norm(group.lot.link_compra) !== norm(lotId) ? `cart_${group.lot.link_compra}` : null
            for (const k of [altId, altLink].filter(Boolean)) {
                const alt = JSON.parse(localStorage.getItem(k) || '[]')
                if (alt.length > 0) {
                    items = alt
                    key = k
                    break
                }
            }
        }

        // Verificar configuração do lote
        const permitirModificacao = permitirEfetivo(group?.lot?.permitir_modificacao_produtos)

        // Se não permite modificação, bloquear
        if (permitirModificacao === 'nao_permitir') {
            toast.error('Não é possível apagar pois o adm restringiu.')
            return
        }
        
        if (group?.lot?.status !== 'aberto') {
            toast.error('Não é possível apagar pois o link já foi fechado pelo adm.')
            return
        }

        const idx = String(itemId).indexOf('__')
        const productId = idx >= 0 ? itemId.slice(0, idx) : itemId
        const variacaoPart = idx >= 0 ? itemId.slice(idx + 2) : ''

        // Comparação normalizada (id pode vir como string ou UUID em diferentes contextos)
        const sameProduct = (item) =>
            norm(item.id) === norm(productId) && norm(item.variacao ?? '') === norm(variacaoPart)

        const targetItem = items.find(sameProduct)
        if (targetItem) {
            const rawMin = targetItem.qtd_minima_cliente ?? targetItem.quantidade_minima ?? 1
            const minClient = Number.isFinite(parseInt(rawMin, 10)) && parseInt(rawMin, 10) > 0
                ? parseInt(rawMin, 10)
                : 1
            if (delta < 0 && targetItem.quantity <= minClient) {
                const unidadeText = minClient === 1 ? 'unidade' : 'unidades'
                toast.warning(`A quantidade mínima para este produto é ${minClient} ${unidadeText}.`)
                return
            }
            if (delta > 0) {
                const currentTotalForProduct = items
                    .filter(i => norm(i.id) === norm(productId))
                    .reduce((s, i) => s + (i.quantity || 0), 0)
                const available = getAvailable(lotId, productId, currentTotalForProduct)
                if (available !== null && available < delta) {
                    toast.error('Este produto está esgotado neste catálogo. Não é possível aumentar a quantidade.')
                    return
                }
            }
        }

        items = items.map(item => {
            const match = sameProduct(item)
            if (match) {
                // Se não houver alvo (caso raro), usar mínimo 1
                const rawMin = item.qtd_minima_cliente ?? item.quantidade_minima ?? 1
                const minClient = Number.isFinite(parseInt(rawMin, 10)) && parseInt(rawMin, 10) > 0
                    ? parseInt(rawMin, 10)
                    : 1
                return { ...item, quantity: Math.max(minClient, item.quantity + delta) }
            }
            return item
        })

        localStorage.setItem(key, JSON.stringify(items))
        // Atualizar owner se estiver logado
        if (client?.auth_id) localStorage.setItem('cart_owner_id', client.auth_id)

        // Atualização otimista: só atualiza o estado do grupo, sem refetch (evita "reload" da tela)
        const newTotal = items.reduce((s, i) => s + i.preco * i.quantity, 0)
        setGroupedItems(prev => ({
            ...prev,
            [lotId]: { ...group, items, total: newTotal }
        }))
        setCartItems(prev => {
            const rest = prev.filter(i => norm(i.lot_id) !== norm(lotId))
            return [...rest, ...items]
        })
        scheduleSync(lotId)
    }

    const removeItem = (lotId, itemId) => {
        const group = groupedItems[lotId]
        const norm = (x) => (x == null ? '' : String(x))
        let key = `cart_${lotId}`
        let items = JSON.parse(localStorage.getItem(key) || '[]')
        if (items.length === 0 && group?.lot) {
            const altId = group.lot.id && norm(group.lot.id) !== norm(lotId) ? `cart_${group.lot.id}` : null
            const altLink = group.lot.link_compra != null && norm(group.lot.link_compra) !== norm(lotId) ? `cart_${group.lot.link_compra}` : null
            for (const k of [altId, altLink].filter(Boolean)) {
                const alt = JSON.parse(localStorage.getItem(k) || '[]')
                if (alt.length > 0) {
                    items = alt
                    key = k
                    break
                }
            }
        }

        // Verificar configuração do lote
        const permitirModificacao = permitirEfetivo(group?.lot?.permitir_modificacao_produtos)

        // Se não permite excluir (regra do link definida pelo admin)
        if (permitirModificacao === 'nao_permitir' || permitirModificacao === 'permitir_reduzir_nao_excluir') {
            toast.error('Não é possível apagar pois o adm restringiu.')
            return
        }

        if (group?.lot?.status !== 'aberto') {
            toast.error('Não é possível apagar pois o link já foi fechado pelo adm.')
            return
        }

        const idx = String(itemId).indexOf('__')
        const productId = idx >= 0 ? itemId.slice(0, idx) : itemId
        const variacaoPart = idx >= 0 ? itemId.slice(idx + 2) : ''
        items = items.filter(item => !(norm(item.id) === norm(productId) && norm(item.variacao ?? '') === norm(variacaoPart)))

        if (items.length === 0) {
            localStorage.removeItem(key)
            setGroupedItems(prev => {
                const next = { ...prev }
                delete next[lotId]
                return next
            })
            setCartItems(prev => prev.filter(i => norm(i.lot_id) !== norm(lotId)))
        } else {
            localStorage.setItem(key, JSON.stringify(items))
            const newTotal = items.reduce((s, i) => s + i.preco * i.quantity, 0)
            setGroupedItems(prev => ({
                ...prev,
                [lotId]: { ...group, items, total: newTotal }
            }))
            setCartItems(prev => {
                const rest = prev.filter(i => norm(i.lot_id) !== norm(lotId))
                return [...rest, ...items]
            })
        }
        scheduleSync(lotId)
    }

    if (loading) return (
        <div className="cart-page">
            <div className="text-center py-16 text-slate-500">Carregando carrinho...</div>
        </div>
    )

    return (
        <div className="cart-page">
            <div className="cart-header">
                <h1>Seu Carrinho</h1>
                <p>Suas alterações são salvas automaticamente. O romaneio (PDF) será gerado quando o administrador fechar o catálogo.</p>
            </div>

            {Object.keys(groupedItems).length === 0 ? (
                <div className="cart-empty">
                    <ShoppingCart size={48} className="cart-empty-icon" />
                    <h3>Seu carrinho está vazio</h3>
                    <p>Visite os grupos abertos para adicionar produtos.</p>
                    <button onClick={() => navigate('/app')} className="btn btn-primary">
                        Ver Grupos Disponíveis <ArrowRight size={16} />
                    </button>
                </div>
            ) : (
                <div className="cart-groups">
                    {Object.entries(groupedItems).map(([lotId, group]) => (
                        <div key={lotId} className="cart-group-card">
                            {/* Header do Grupo */}
                            <div className="cart-group-header">
                                <div>
                                    <h2 className="cart-group-title">{group.lot.nome}</h2>
                                    <span className={`cart-group-status ${group.lot.status === 'aberto' ? 'open' : 'closed'}`}>
                                        {group.lot.status === 'aberto' ? 'Aberto para Compras' : 'Fechado'}
                                    </span>
                                    {/* Sempre exibir a regra do grupo (pode ou não diminuir/remover itens) */}
                                    {(() => {
                                        const p = permitirEfetivo(group.lot.permitir_modificacao_produtos)
                                        if (p === 'nao_permitir') return <p className="cart-group-rule-hint">Não é permitido alterar nem remover itens neste catálogo.</p>
                                        if (p === 'permitir_reduzir_nao_excluir') return <p className="cart-group-rule-hint">Você pode alterar quantidades, mas não remover itens.</p>
                                        if (p === 'permitir_reduzir_excluir') return <p className="cart-group-rule-hint">Você pode alterar quantidades e remover itens.</p>
                                        return null
                                    })()}
                                </div>
                            </div>

                            {/* Lista de Itens */}
                            <div className="cart-items-list">
                                {group.items.map(item => {
                                    const lineKey = `${item.id}__${item.variacao ?? ''}`
                                    return (
                                    <div key={lineKey} className="cart-item">
                                        <div className="cart-item-image">
                                            {item.imagem1 ? (
                                                <img src={item.imagem1} alt={item.nome} loading="lazy" />
                                            ) : (
                                                <div className="cart-item-image-placeholder">
                                                    <ShoppingCart size={24} />
                                                </div>
                                            )}
                                        </div>

                                        <div className="cart-item-info">
                                            <h3 className="cart-item-name">{item.nome}{item.variacao ? ` — ${item.variacao}` : ''}</h3>
                                            <p className="cart-item-price-unit">R$ {parseFloat(item.preco).toFixed(2)} un.</p>
                                        </div>

                                        <div className="cart-item-controls">
                                            {(() => {
                                                const permitir = permitirEfetivo(group?.lot?.permitir_modificacao_produtos)
                                                const podeAlterarQtd = permitir !== 'nao_permitir'
                                                const podeExcluir = permitir === 'permitir_reduzir_excluir'
                                                const lotAberto = group.lot.status === 'aberto'
                                                const currentTotalForProduct = group.items
                                                    .filter(i => norm(i.id) === norm(item.id))
                                                    .reduce((s, i) => s + (i.quantity || 0), 0)
                                                const available = getAvailable(lotId, item.id, currentTotalForProduct)
                                                const esgotado = available !== null && available <= 0
                                                return (
                                                    <>
                                                        <div className="cart-quantity-control">
                                                            <button
                                                                onClick={() => updateQuantity(lotId, lineKey, -1)}
                                                                className={`cart-quantity-btn ${!lotAberto || !podeAlterarQtd ? 'opacity-50' : ''}`}
                                                                title={!podeAlterarQtd ? 'Este catálogo não permite alterar quantidades' : 'Diminuir quantidade'}
                                                            >
                                                                <Minus size={16} />
                                                            </button>
                                                            <span className="cart-quantity-value">{item.quantity}</span>
                                                            <button
                                                                onClick={() => updateQuantity(lotId, lineKey, 1)}
                                                                className={`cart-quantity-btn ${!lotAberto || !podeAlterarQtd || esgotado ? 'opacity-50' : ''}`}
                                                                title={esgotado ? 'Produto esgotado neste catálogo' : !podeAlterarQtd ? 'Este catálogo não permite alterar quantidades' : 'Aumentar quantidade'}
                                                            >
                                                                <Plus size={16} />
                                                            </button>
                                                        </div>
                                                        <span className="cart-item-total">
                                                            R$ {(item.preco * item.quantity).toFixed(2)}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                              e.stopPropagation()
                                                              removeItem(lotId, lineKey)
                                                            }}
                                                            className={`cart-item-remove ${!lotAberto || !podeExcluir ? 'disabled' : ''}`}
                                                            title={!podeExcluir ? 'A regra deste catálogo não permite remover itens do carrinho' : 'Remover item'}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                    )
                                })}
                            </div>

                            {/* Footer Totais: subtotal, taxa de separação e total */}
                            <div className="cart-group-footer">
                                <div className="cart-footer-lines">
                                    <div className="cart-footer-line">
                                        <span className="cart-group-total-label">Subtotal (produtos):</span>
                                        <span className="cart-footer-value">R$ {group.total.toFixed(2)}</span>
                                    </div>
                                    <div className="cart-footer-line">
                                        <span className="cart-group-total-label">Taxa de separação:</span>
                                        <span className="cart-footer-value">R$ {(getTaxaSeparacao(group.total)).toFixed(2)}</span>
                                    </div>
                                    <p className="cart-taxa-obs">Até R$ 80,00 a taxa é R$ 15,00. Acima de R$ 80,00 a taxa é R$ 25,00.</p>
                                </div>
                                <div className="cart-footer-total">
                                    <span className="cart-group-total-label">Total do pedido:</span>
                                    <span className="cart-group-total-value">R$ {(group.total + getTaxaSeparacao(group.total)).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
