import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Trash2, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function Cart() {
  const navigate = useNavigate()
  const { user, client } = useAuth()
  const [cartItems, setCartItems] = useState([])
  const [groupedItems, setGroupedItems] = useState({})
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

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
                .select('id, nome, status, data_fim')
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

  const updateQuantity = (lotId, itemId, delta) => {
    const key = `cart_${lotId}`
    let items = JSON.parse(localStorage.getItem(key) || '[]')
    
    items = items.map(item => {
        if (item.id === itemId) {
            return { ...item, quantity: Math.max(1, item.quantity + delta) }
        }
        return item
    })
    
    localStorage.setItem(key, JSON.stringify(items))
    loadCart() // Reload UI
  }

  const removeItem = (lotId, itemId) => {
    const key = `cart_${lotId}`
    let items = JSON.parse(localStorage.getItem(key) || '[]')
    
    items = items.filter(item => item.id !== itemId)
    
    if (items.length === 0) {
        localStorage.removeItem(key)
    } else {
        localStorage.setItem(key, JSON.stringify(items))
    }
    loadCart()
  }

  const handleCheckout = async (lotId) => {
    setCheckoutLoading(true)
    try {
        const group = groupedItems[lotId]
        
        // 1. Validação final de Status
        if (group.lot.status !== 'aberto') {
            alert('Este grupo de compras já fechou. Não é possível finalizar.')
            return
        }

        // 2. Preparar Inserts
        if (!user || !client) {
            alert('Erro de autenticação. Recarregue a página.')
            return
        }

        const ordersToInsert = group.items.map(item => ({
            lot_id: lotId,
            client_id: client.id, // ID do cliente público
            product_id: item.id,
            quantidade: item.quantity,
            valor_unitario: item.preco,
            valor_total: item.preco * item.quantity,
            status: 'pendente'
        }))

        const { error } = await supabase
            .from('orders')
            .insert(ordersToInsert)

        if (error) throw error

        // 3. Limpar Carrinho Local deste lote
        localStorage.removeItem(`cart_${lotId}`)
        
        // 4. Feedback e Redirecionar
        alert('Pedido realizado com sucesso!')
        navigate('/app/historico')

    } catch (error) {
        console.error('Erro no checkout:', error)
        alert('Erro ao finalizar pedido. Tente novamente.')
    } finally {
        setCheckoutLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando carrinho...</div>

  return (
    <div className="client-page">
      <div className="page-header mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Seu Carrinho</h1>
        <p className="text-slate-500">Revise seus itens antes de confirmar.</p>
      </div>

      {Object.keys(groupedItems).length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
          <ShoppingCart size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">Seu carrinho está vazio</h3>
          <p className="text-slate-500 mb-6">Visite os grupos abertos para adicionar produtos.</p>
          <button onClick={() => navigate('/app')} className="inline-flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-700">
            Ver Grupos Disponíveis <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="space-y-8">
            {Object.entries(groupedItems).map(([lotId, group]) => (
                <div key={lotId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Header do Grupo */}
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <div>
                            <h2 className="font-bold text-slate-800">{group.lot.nome}</h2>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${group.lot.status === 'aberto' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {group.lot.status === 'aberto' ? 'Aberto para Compras' : 'Fechado'}
                            </span>
                        </div>
                        {group.lot.status === 'aberto' && (
                           <button 
                             onClick={() => handleCheckout(lotId)}
                             disabled={checkoutLoading}
                             className="bg-slate-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                           >
                             {checkoutLoading ? 'Processando...' : 'Finalizar Pedido'} <CheckCircle size={16} />
                           </button>
                        )}
                    </div>

                    {/* Lista de Itens */}
                    <div className="divide-y divide-slate-100">
                        {group.items.map(item => (
                            <div key={item.id} className="p-4 flex items-center gap-4">
                                <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                                    {item.imagem1 ? (
                                        <img src={item.imagem1} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-slate-300"><ShoppingCart size={20}/></div>
                                    )}
                                </div>
                                
                                <div className="flex-1">
                                    <h3 className="font-medium text-slate-900">{item.nome}</h3>
                                    <p className="text-sm text-slate-500">R$ {parseFloat(item.preco).toFixed(2)} un.</p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center border border-slate-200 rounded-lg">
                                        <button 
                                            onClick={() => updateQuantity(lotId, item.id, -1)}
                                            className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                                            disabled={group.lot.status !== 'aberto'}
                                        >-</button>
                                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                        <button 
                                            onClick={() => updateQuantity(lotId, item.id, 1)}
                                            className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                                            disabled={group.lot.status !== 'aberto'}
                                        >+</button>
                                    </div>
                                    <span className="font-bold text-slate-900 w-24 text-right">
                                        R$ {(item.preco * item.quantity).toFixed(2)}
                                    </span>
                                    <button 
                                        onClick={() => removeItem(lotId, item.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                        title="Remover"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {/* Footer Totais */}
                    <div className="bg-slate-50 px-6 py-4 flex justify-end items-center gap-4">
                        <span className="text-slate-500">Total do Grupo:</span>
                        <span className="text-xl font-bold text-slate-900">R$ {group.total.toFixed(2)}</span>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  )
}
