import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Plus, Minus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/common/Toast'
import './Catalog.css'

export default function Catalog() {
  const { linkUrl } = useParams() 
  const { lotId } = useParams()
  const id = lotId || linkUrl 

  const navigate = useNavigate()
  const toast = useToast()
  const [lot, setLot] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState(null)
  const [quantities, setQuantities] = useState({})

  useEffect(() => {
    if (id) loadCatalog()
  }, [id])

  const loadCatalog = async () => {
    try {
      // 1. Carregar Lote
      const { data: lotData, error: lotError } = await supabase
        .from('lots')
        .select('*')
        .eq('id', id)
        .single()

      if (lotError) throw lotError
      setLot(lotData)

      // 2. Carregar Produtos do Lote
      const { data: prodData, error: prodError } = await supabase
        .from('lot_products')
        .select(`
            *,
            product:products (*)
        `)
        .eq('lot_id', id)
      
      if (prodError) throw prodError
      
      const mapped = prodData.map(lp => ({
          ...lp.product,
          lp_id: lp.id,
      }))

      setProducts(mapped)

    } catch (error) {
      console.error('Erro ao carregar catalogo:', error)
      toast.error('Erro ao carregar catálogo. Tente novamente.')
    } finally {
      setLoading(false)
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

  const addToCart = async (product) => {
    const qty = getQuantity(product.id)
    setAddingToCart(product.id)
    try {
        const cartKey = `cart_${id}`
        const currentCart = JSON.parse(localStorage.getItem(cartKey) || '[]')
        
        const existingInfo = currentCart.find(item => item.id === product.id)
        let newCart;
        
        if (existingInfo) {
            newCart = currentCart.map(item => 
                item.id === product.id 
                ? { ...item, quantity: item.quantity + qty }
                : item
            )
        } else {
            newCart = [...currentCart, { ...product, quantity: qty, lot_id: id }]
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

      {/* Grid de Produtos */}
      <div className="products-grid">
        {products.map(product => (
            <div 
              key={product.id} 
              className={`product-card ${addingToCart === product.id ? 'adding' : ''}`}
            >
                <div className="product-image-area">
                    {product.imagem1 ? (
                        <img src={product.imagem1} alt={product.nome} className="product-img" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                            Sem foto
                        </div>
                    )}
                </div>
                
                <div className="product-info">
                    <h3 className="product-name">{product.nome}</h3>
                    <p className="product-sku">{product.codigo_sku || 'SKU N/A'}</p>
                    
                    <div className="product-footer">
                        <div className="product-price">
                            R$ {parseFloat(product.preco).toFixed(2)}
                        </div>
                        
                        <div className="quantity-controls">
                            <button 
                                onClick={() => decrementQuantity(product.id)}
                                className="qty-btn"
                                disabled={getQuantity(product.id) <= 1}
                            >
                                <Minus size={14} />
                            </button>
                            <span className="qty-value">{getQuantity(product.id)}</span>
                            <button 
                                onClick={() => incrementQuantity(product.id)}
                                className="qty-btn"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                        
                        <button 
                            onClick={() => addToCart(product)}
                            disabled={addingToCart === product.id}
                            className={`btn-add-cart ${addingToCart === product.id ? 'added' : ''}`}
                        >
                            <ShoppingCart size={18} />
                        </button>
                    </div>
                </div>
            </div>
        ))}
      </div>
    </div>
  )
}
