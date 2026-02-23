import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Trash2, ArrowRight, Plus, Minus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/common/Toast'
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

export default function Cart() {
    const navigate = useNavigate()
    const { user, client } = useAuth()
    const toast = useToast()
    const [cartItems, setCartItems] = useState([])
    const [groupedItems, setGroupedItems] = useState({})
    const [loading, setLoading] = useState(true)
    const syncTimeoutRef = useRef({})

    useEffect(() => {
        loadCart()
    }, [])

    const loadCart = async () => {
        setLoading(true)
        try {
            // Ler de todas as chaves cart_lotID do localStorage
            const allItems = []
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key.startsWith('cart_')) {
                    const items = JSON.parse(localStorage.getItem(key))
                    if (Array.isArray(items)) {
                        allItems.push(...items)
                    }
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

            // Remover do carrinho (localStorage e exibição) os grupos cujo link já foi fechado (romaneio gerado)
            for (const lotId of Object.keys(grouped)) {
                if (grouped[lotId].lot.status !== 'aberto') {
                    localStorage.removeItem(`cart_${lotId}`)
                    delete grouped[lotId]
                }
            }

            const remainingItems = Object.values(grouped).flatMap(g => g.items)
            setGroupedItems(grouped)
            setCartItems(remainingItems)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const syncCartToServer = async (lotId) => {
        if (!user || !client?.auth_id) return
        const key = `cart_${lotId}`
        const items = JSON.parse(localStorage.getItem(key) || '[]')
        let lotUuid = lotId
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)
        if (!isUuid) {
            const { data } = await supabase.from('lots').select('id').eq('link_compra', lotId).single()
            lotUuid = data?.id ?? lotId
        }

        try {
            if (items.length === 0) {
                await supabase.rpc('clear_draft_romaneio', { p_lot_id: lotUuid })
                window.dispatchEvent(new CustomEvent('cart-synced', { detail: { lotId: lotUuid } }))
                return
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
            if (error && !error.message?.includes('não está aberto')) {
                console.warn('Sync carrinho:', error.message)
            } else {
                window.dispatchEvent(new CustomEvent('cart-synced', { detail: { lotId: lotUuid } }))
            }
        } catch (e) {
            console.warn('Sync carrinho:', e)
        }
    }

    const scheduleSync = (lotId) => {
        if (syncTimeoutRef.current[lotId]) clearTimeout(syncTimeoutRef.current[lotId])
        syncTimeoutRef.current[lotId] = setTimeout(() => {
            syncCartToServer(lotId)
            delete syncTimeoutRef.current[lotId]
        }, SYNC_DEBOUNCE_MS)
    }

    const updateQuantity = (lotId, itemId, delta) => {
        const key = `cart_${lotId}`
        let items = JSON.parse(localStorage.getItem(key) || '[]')

        // Verificar configuração do lote
        const group = groupedItems[lotId]
        const permitirModificacao = permitirEfetivo(group?.lot?.permitir_modificacao_produtos)

        // Se não permite modificação, bloquear
        if (permitirModificacao === 'nao_permitir') {
            toast.error('Este catálogo não permite modificar quantidades. Entre em contato com o administrador.')
            return
        }

        const idx = String(itemId).indexOf('__')
        const productId = idx >= 0 ? itemId.slice(0, idx) : itemId
        const variacaoPart = idx >= 0 ? itemId.slice(idx + 2) : ''

        // Respeitar quantidade mínima por cliente configurada no produto
        const targetItem = items.find(item =>
            item.id === productId && (item.variacao ?? '') === variacaoPart
        )
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
        }

        items = items.map(item => {
            const match = item.id === productId && (item.variacao ?? '') === variacaoPart
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
        loadCart()
        scheduleSync(lotId)
    }

    const removeItem = (lotId, itemId) => {
        const key = `cart_${lotId}`
        let items = JSON.parse(localStorage.getItem(key) || '[]')

        // Verificar configuração do lote
        const group = groupedItems[lotId]
        const permitirModificacao = permitirEfetivo(group?.lot?.permitir_modificacao_produtos)

        // Se não permite excluir (regra do link definida pelo admin)
        if (permitirModificacao === 'nao_permitir' || permitirModificacao === 'permitir_reduzir_nao_excluir') {
            toast.error('Não é possível remover: a regra deste catálogo não permite excluir itens do carrinho.')
            return
        }

        const idx = String(itemId).indexOf('__')
        const productId = idx >= 0 ? itemId.slice(0, idx) : itemId
        const variacaoPart = idx >= 0 ? itemId.slice(idx + 2) : ''
        items = items.filter(item => !(item.id === productId && (item.variacao ?? '') === variacaoPart))

        if (items.length === 0) {
            localStorage.removeItem(key)
        } else {
            localStorage.setItem(key, JSON.stringify(items))
        }
        loadCart()
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
                                    {group.lot.status === 'aberto' && (() => {
                                        const p = permitirEfetivo(group.lot.permitir_modificacao_produtos)
                                        if (p === 'nao_permitir') return <p className="cart-group-rule-hint">Não é permitido alterar nem remover itens neste catálogo.</p>
                                        if (p === 'permitir_reduzir_nao_excluir') return <p className="cart-group-rule-hint">Você pode alterar quantidades, mas não remover itens.</p>
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
                                                <img src={item.imagem1} alt={item.nome} />
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
                                                return (
                                                    <>
                                                        <div className="cart-quantity-control">
                                                            <button
                                                                onClick={() => updateQuantity(lotId, lineKey, -1)}
                                                                className="cart-quantity-btn"
                                                                disabled={!lotAberto || !podeAlterarQtd}
                                                                title={!podeAlterarQtd ? 'Este catálogo não permite alterar quantidades' : 'Diminuir quantidade'}
                                                            >
                                                                <Minus size={16} />
                                                            </button>
                                                            <span className="cart-quantity-value">{item.quantity}</span>
                                                            <button
                                                                onClick={() => updateQuantity(lotId, lineKey, 1)}
                                                                className="cart-quantity-btn"
                                                                disabled={!lotAberto || !podeAlterarQtd}
                                                                title={!podeAlterarQtd ? 'Este catálogo não permite alterar quantidades' : 'Aumentar quantidade'}
                                                            >
                                                                <Plus size={16} />
                                                            </button>
                                                        </div>
                                                        <span className="cart-item-total">
                                                            R$ {(item.preco * item.quantity).toFixed(2)}
                                                        </span>
                                                        <button
                                                            onClick={() => removeItem(lotId, lineKey)}
                                                            className="cart-item-remove"
                                                            disabled={!lotAberto || !podeExcluir}
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
