import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Search, Filter } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import './Catalog.css'

export default function Catalog() {
  const { linkUrl } = useParams() 
  const { lotId } = useParams()
  const id = lotId || linkUrl 

  const navigate = useNavigate()
  const [lot, setLot] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState(null)

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
    } finally {
      setLoading(false)
    }
  }

  const addToCart = async (product) => {
    setAddingToCart(product.id)
    try {
        const cartKey = `cart_${id}`
        const currentCart = JSON.parse(localStorage.getItem(cartKey) || '[]')
        
        const existingInfo = currentCart.find(item => item.id === product.id)
        let newCart;
        
        if (existingInfo) {
            newCart = currentCart.map(item => 
                item.id === product.id 
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
        } else {
            newCart = [...currentCart, { ...product, quantity: 1, lot_id: id }]
        }
        
        localStorage.setItem(cartKey, JSON.stringify(newCart))
        
        // Pequeno feedback visual
        await new Promise(r => setTimeout(r, 300))
        
        // Navegar para o carrinho após adicionar
        navigate('/app/carrinho')
        
    } catch (e) {
        console.error(e)
    } finally {
        setAddingToCart(null)
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando catálogo...</div>
  if (!lot) return <div className="p-8 text-center text-slate-500">Grupo não encontrado.</div>

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
            {/* Carrinho Flutuante poderia ser aqui */}
        </div>
      </header>

      {/* Grid de Produtos */}
      <div className="products-grid">
        {products.map(product => (
            <div 
              key={product.id} 
              className={`product-card ${addingToCart === product.id ? 'adding' : ''}`}
              onClick={() => addToCart(product)}
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
                        
                        <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              addToCart(product)
                            }}
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
