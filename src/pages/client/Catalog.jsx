import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Package, ShoppingCart, ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { calcularFrete } from '../../services/correios'
import './Catalog.css'

export default function Catalog() {
  const { lotId } = useParams()
  const { client } = useAuth()
  const [lots, setLots] = useState([])
  const [selectedLot, setSelectedLot] = useState(null)
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCart, setShowCart] = useState(false)

  useEffect(() => {
    fetchLots()
  }, [])

  useEffect(() => {
    if (lotId) {
      fetchLotProducts(lotId)
    }
  }, [lotId])

  const fetchLots = async () => {
    try {
      const { data } = await supabase
        .from('lots')
        .select('*')
        .eq('status', 'aberto')
        .order('created_at', { ascending: false })

      setLots(data || [])
    } catch (error) {
      console.error('Erro ao carregar lotes:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLotProducts = async (id) => {
    try {
      const { data: lot } = await supabase
        .from('lots')
        .select('*')
        .eq('id', id)
        .single()

      setSelectedLot(lot)

      const { data: lotProducts } = await supabase
        .from('lot_products')
        .select(`
          *,
          product:products(*)
        `)
        .eq('lot_id', id)

      setProducts(lotProducts?.map(lp => lp.product) || [])
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    }
  }

  const addToCart = (product) => {
    const existing = cart.find(item => item.productId === product.id)
    if (existing) {
      setCart(cart.map(item => 
        item.productId === product.id 
          ? { ...item, quantidade: item.quantidade + 1 }
          : item
      ))
    } else {
      setCart([...cart, { 
        productId: product.id, 
        product, 
        quantidade: 1,
        valorUnitario: product.preco
      }])
    }
  }

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.productId !== productId))
  }

  const updateQuantity = (productId, quantidade) => {
    if (quantidade < 1) {
      removeFromCart(productId)
      return
    }
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, quantidade }
        : item
    ))
  }

  const cartTotal = cart.reduce((sum, item) => sum + (item.valorUnitario * item.quantidade), 0)

  const handleCheckout = async () => {
    if (!client?.approved) {
      alert('Seu cadastro ainda não foi aprovado. Entre em contato com a administração.')
      return
    }

    try {
      // Criar pedidos para cada item do carrinho
      const orders = cart.map(item => ({
        client_id: client.id,
        lot_id: selectedLot?.id,
        product_id: item.productId,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
        valor_total: item.valorUnitario * item.quantidade,
        status: 'pendente'
      }))

      const { error } = await supabase.from('orders').insert(orders)

      if (error) throw error

      alert('Pedido realizado com sucesso! Aguarde instruções de pagamento.')
      setCart([])
      setShowCart(false)
    } catch (error) {
      console.error('Erro ao finalizar pedido:', error)
      alert('Erro ao finalizar pedido. Tente novamente.')
    }
  }

  // Se não selecionou lote, mostra lista de lotes
  if (!lotId) {
    return (
      <div className="catalog-page">
        <h1>📦 Lotes Disponíveis</h1>

        {loading ? (
          <div className="text-center p-lg">
            <div className="loading-spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : lots.length === 0 ? (
          <div className="empty-state">
            <Package size={48} className="text-muted" />
            <p>Nenhum lote disponível no momento</p>
          </div>
        ) : (
          <div className="lots-grid">
            {lots.map(lot => (
              <Link key={lot.id} to={`/cliente/catalogo/${lot.id}`} className="lot-card-client">
                <h3>{lot.nome}</h3>
                <p>{lot.descricao}</p>
                <span className="lot-card-cta">Ver produtos →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <Link to="/cliente/catalogo" className="btn btn-outline btn-sm">
          <ChevronLeft size={16} /> Voltar
        </Link>
        <h1>{selectedLot?.nome || 'Catálogo'}</h1>
        <button 
          className="btn btn-primary cart-button"
          onClick={() => setShowCart(true)}
        >
          <ShoppingCart size={18} />
          {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
        </button>
      </div>

      {/* Products Grid */}
      <div className="catalog-grid">
        {products.map(product => (
          <div key={product.id} className="catalog-product-card">
            <div className="catalog-product-image">
              {product.imagem1 ? (
                <img src={product.imagem1} alt={product.nome} />
              ) : (
                <Package size={48} />
              )}
            </div>
            <div className="catalog-product-info">
              <h3>{product.nome}</h3>
              <p>{product.descricao}</p>
              <span className="catalog-product-price">
                R$ {product.preco?.toFixed(2)}
              </span>
            </div>
            <button 
              className="btn btn-success w-full"
              onClick={() => addToCart(product)}
            >
              Adicionar ao carrinho
            </button>
          </div>
        ))}
      </div>

      {/* Cart Sidebar */}
      {showCart && (
        <>
          <div className="cart-overlay" onClick={() => setShowCart(false)} />
          <div className="cart-sidebar">
            <div className="cart-header">
              <h2>🛒 Carrinho</h2>
              <button onClick={() => setShowCart(false)}>&times;</button>
            </div>

            {cart.length === 0 ? (
              <p className="text-muted text-center p-lg">Carrinho vazio</p>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map(item => (
                    <div key={item.productId} className="cart-item">
                      <div className="cart-item-info">
                        <strong>{item.product.nome}</strong>
                        <span>R$ {item.valorUnitario.toFixed(2)}</span>
                      </div>
                      <div className="cart-item-qty">
                        <button onClick={() => updateQuantity(item.productId, item.quantidade - 1)}>-</button>
                        <span>{item.quantidade}</span>
                        <button onClick={() => updateQuantity(item.productId, item.quantidade + 1)}>+</button>
                      </div>
                      <button 
                        className="cart-item-remove"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="cart-footer">
                  <div className="cart-total">
                    <span>Total:</span>
                    <strong>R$ {cartTotal.toFixed(2)}</strong>
                  </div>
                  <button 
                    className="btn btn-success btn-lg w-full"
                    onClick={handleCheckout}
                  >
                    Finalizar Pedido
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
