import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Trash2, ArrowRight, Plus, Minus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/common/Toast'
import './Cart.css'

const SYNC_DEBOUNCE_MS = 800

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

            // Buscar infos dos lotes para mostrar nomes
            const lotIds = [...new Set(allItems.map(i => i.lot_id))]
            let lotsMap = {}

            if (lotIds.length > 0) {
                const { data: lots } = await supabase
                    .from('lots')
                    .select('id, nome, status, data_fim, permitir_modificacao_produtos, exigir_dados_galvanica')
                    .in('id', lotIds)

                lots?.forEach(l => lotsMap[l.id] = l)
            }

            allItems.forEach(item => {
                if (!grouped[item.lot_id]) {
                    grouped[item.lot_id] = {
                        lot: lotsMap[item.lot_id] || { nome: 'Link Indisponível', status: 'fechado' },
                        items: [],
                        total: 0
                    }
                }
                grouped[item.lot_id].items.push(item)
                grouped[item.lot_id].total += item.preco * item.quantity
            })

            setGroupedItems(grouped)
            setCartItems(allItems)
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

        try {
            if (items.length === 0) {
                await supabase.rpc('clear_draft_romaneio', { p_lot_id: lotId })
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
                p_lot_id: lotId,
                p_items: itemsPayload,
                p_client_snapshot: clientSnapshot
            })
            if (error && !error.message?.includes('não está aberto')) {
                console.warn('Sync carrinho:', error.message)
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
        const permitirModificacao = group?.lot?.permitir_modificacao_produtos || 'permitir_reduzir_excluir'

        // Se não permite modificação, bloquear
        if (permitirModificacao === 'nao_permitir') {
            toast.error('Este catálogo não permite modificar quantidades. Entre em contato com o administrador.')
            return
        }

        const idx = String(itemId).indexOf('__')
        const productId = idx >= 0 ? itemId.slice(0, idx) : itemId
        const variacaoPart = idx >= 0 ? itemId.slice(idx + 2) : ''
        items = items.map(item => {
            const match = item.id === productId && (item.variacao ?? '') === variacaoPart
            if (match) {
                return { ...item, quantity: Math.max(1, item.quantity + delta) }
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
        const permitirModificacao = group?.lot?.permitir_modificacao_produtos || 'permitir_reduzir_excluir'

        // Se não permite excluir
        if (permitirModificacao === 'nao_permitir' || permitirModificacao === 'permitir_reduzir_nao_excluir') {
            toast.error('Este catálogo não permite remover produtos. Entre em contato com o administrador.')
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
                                                const permitir = group?.lot?.permitir_modificacao_produtos || 'permitir_reduzir_excluir'
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
                                                            title={!podeExcluir ? 'Este catálogo não permite remover produtos' : 'Remover item'}
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

                            {/* Footer Totais */}
                            <div className="cart-group-footer">
                                <div className="cart-footer-total">
                                    <span className="cart-group-total-label">Total do Grupo:</span>
                                    <span className="cart-group-total-value">R$ {group.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
