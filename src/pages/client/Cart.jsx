import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Trash2, ArrowRight, AlertTriangle, CheckCircle, Plus, Minus, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/common/Toast'
import './Cart.css'

export default function Cart() {
  const navigate = useNavigate()
  const { user, client } = useAuth()
  const toast = useToast()
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

  const generateRomaneioNumber = () => {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `ROM-${dateStr}-${random}`
  }

  const handleDownloadRomaneioPDF = async (romaneioId, fileName, items) => {
    if (!romaneioId) {
      throw new Error('ID do romaneio não fornecido')
    }

    console.log('Gerando PDF para romaneio:', romaneioId)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Sessão não encontrada. Faça login novamente.')
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-romaneio-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ romaneioId, items })
      })
      
      if (!response.ok) {
        let errorMessage = 'Falha ao gerar PDF'
        try {
          const err = await response.json()
          errorMessage = err.error || errorMessage
          console.error('Erro da função:', err)
        } catch {
          const text = await response.text()
          console.error('Resposta de erro (texto):', text)
          errorMessage = `Erro ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }
      
      const blob = await response.blob()
      
      if (blob.type === 'application/json') {
        // Se retornou JSON em vez de PDF, é um erro
        const errorData = await blob.text()
        const parsed = JSON.parse(errorData)
        throw new Error(parsed.error || 'Erro ao gerar PDF')
      }
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || `Romaneio-${romaneioId.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      return true
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      throw error
    }
  }

  const handleCheckout = async (lotId) => {
    setCheckoutLoading(true)
    try {
        const group = groupedItems[lotId]
        
        if (!user || !client) {
            toast.error('Erro de autenticação. Recarregue a página.')
            return
        }

        // 1. Preparar Payload para RPC
        const itemsPayload = group.items.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            valor_unitario: item.preco
        }))

        const clientSnapshot = {
            nome: client.nome,
            telefone: client.telefone,
            endereco: client.enderecos?.[0] || null
        }

        // 2. Chamar RPC Transacional
        console.log('Chamando checkout_romaneio RPC...')
        const { data: romaneio, error: rpcError } = await supabase.rpc('checkout_romaneio', {
            p_lot_id: lotId,
            p_items: itemsPayload,
            p_client_snapshot: clientSnapshot
        })

        if (rpcError) {
            console.error('Erro RPC:', rpcError)
            throw new Error(rpcError.message)
        }

        if (!romaneio || !romaneio.id) {
            throw new Error('Erro: Romaneio não retornado pelo servidor.')
        }

        console.log('Romaneio criado/atualizado com sucesso:', romaneio.id)

        // 3. Preparar itens para PDF (Snapshots visuais)
        const itemsForPDF = group.items.map(item => ({
          quantidade: item.quantity,
          valor_unitario: item.preco,
          valor_total: item.preco * item.quantity,
          product: {
            nome: item.nome,
            descricao: item.descricao,
            codigo_sku: item.codigo_sku,
            category: item.category || item.categoria || (item.categoria_nome ? { nome: item.categoria_nome } : null)
          }
        }))

        // 4. Gerar e baixar PDF
        await handleDownloadRomaneioPDF(romaneio.id, `Romaneio-${group.lot.nome}.pdf`, itemsForPDF)

        // 5. Limpar Carrinho Local
        localStorage.removeItem(`cart_${lotId}`)
        
        // 6. Sucesso
        toast.success('Pedido realizado com sucesso! Romaneio gerado.')
        navigate('/app/historico')

    } catch (error) {
        console.error('Erro no checkout:', error)
        toast.error('Erro ao finalizar pedido: ' + (error.message || 'Tente novamente.'))
    } finally {
        setCheckoutLoading(false)
    }
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
        <p>Revise seus itens antes de confirmar.</p>
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
                        {group.items.map(item => (
                            <div key={item.id} className="cart-item">
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
                                    <h3 className="cart-item-name">{item.nome}</h3>
                                    <p className="cart-item-price-unit">R$ {parseFloat(item.preco).toFixed(2)} un.</p>
                                </div>

                                <div className="cart-item-controls">
                                    <div className="cart-quantity-control">
                                        <button 
                                            onClick={() => updateQuantity(lotId, item.id, -1)}
                                            className="cart-quantity-btn"
                                            disabled={group.lot.status !== 'aberto'}
                                            title="Diminuir quantidade"
                                        >
                                            <Minus size={16} />
                                        </button>
                                        <span className="cart-quantity-value">{item.quantity}</span>
                                        <button 
                                            onClick={() => updateQuantity(lotId, item.id, 1)}
                                            className="cart-quantity-btn"
                                            disabled={group.lot.status !== 'aberto'}
                                            title="Aumentar quantidade"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                    <span className="cart-item-total">
                                        R$ {(item.preco * item.quantity).toFixed(2)}
                                    </span>
                                    <button 
                                        onClick={() => removeItem(lotId, item.id)}
                                        className="cart-item-remove"
                                        title="Remover item"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {/* Footer Totais e Botão */}
                    <div className="cart-group-footer">
                        <div className="cart-footer-total">
                            <span className="cart-group-total-label">Total do Grupo:</span>
                            <span className="cart-group-total-value">R$ {group.total.toFixed(2)}</span>
                        </div>
                        {group.lot.status === 'aberto' && (
                            <button 
                                onClick={() => handleCheckout(lotId)}
                                disabled={checkoutLoading}
                                className="btn-checkout"
                            >
                                {checkoutLoading ? (
                                    <>
                                        <FileText size={16} className="spin" /> Gerando Romaneio...
                                    </>
                                ) : (
                                    <>
                                        Fechar Compra e Gerar Romaneio <FileText size={16} />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  )
}
