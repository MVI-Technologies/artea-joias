import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Plus, Search, Copy, ChevronDown, X, Edit, MessageCircle, Image, Link as LinkIcon, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './LotDetail.css'

export default function LotDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lot, setLot] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('todas')
  const [categories, setCategories] = useState([])
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      // Buscar lote
      const { data: lotData, error: lotError } = await supabase
        .from('lots')
        .select('*')
        .eq('id', id)
        .single()

      if (lotError) throw lotError
      setLot(lotData)

      // Buscar produtos do lote
      const { data: lotProducts, error: lpError } = await supabase
        .from('lot_products')
        .select(`
          *,
          product:products(*, category:categories(*))
        `)
        .eq('lot_id', id)

      if (lpError) throw lpError
      setProducts(lotProducts || [])

      // Buscar categorias
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('ativo', true)
        .order('nome')

      setCategories(cats || [])
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    const link = `${window.location.origin}/catalogo/${lot?.link_compra || id}`
    navigator.clipboard.writeText(link)
    alert('Link copiado!')
  }

  const removeProduct = async (lpId) => {
    if (!confirm('Remover produto do catálogo?')) return
    try {
      await supabase.from('lot_products').delete().eq('id', lpId)
      fetchData()
    } catch (error) {
      alert('Erro ao remover')
    }
  }

  const filteredProducts = products.filter(lp => {
    const product = lp.product
    if (!product) return false
    const matchSearch = product.nome.toLowerCase().includes(search.toLowerCase())
    const matchCategory = categoryFilter === 'todas' || product.categoria_id === categoryFilter
    return matchSearch && matchCategory
  })

  if (loading) {
    return <div className="page-container"><div className="loading-spinner" style={{ margin: '40px auto' }} /></div>
  }

  if (!lot) {
    return <div className="page-container">Catálogo não encontrado</div>
  }

  return (
    <div className="page-container lot-detail">
      {/* Header */}
      <div className="lot-header">
        <button className="btn-back" onClick={() => navigate('/admin/lotes')}>
          <ArrowLeft size={18} />
        </button>
        <RefreshCw size={18} className="refresh-icon" onClick={fetchData} />
        <h1>{lot.nome}</h1>
      </div>

      {/* Action buttons */}
      <div className="lot-actions">
        <button className="btn btn-primary">
          <Plus size={16} /> Adicionar Produto
        </button>
        <button className="btn btn-primary">
          <Plus size={16} /> Múltiplos Produtos
        </button>
        <button className="btn btn-dark dropdown-btn">
          Ações <ChevronDown size={14} />
        </button>
        <button className="btn btn-dark dropdown-btn">
          Selecionados <ChevronDown size={14} />
        </button>
        <button className="btn btn-dark dropdown-btn">
          Notificações <ChevronDown size={14} />
        </button>
      </div>

      {/* Link info */}
      <div className="lot-link-section">
        <a href="#" className="link-text">Listar todos os produtos</a>
        <div className="link-copy">
          <span className="link-url">
            {window.location.origin}/catalogo/{lot.link_compra || lot.id}
          </span>
          <button className="btn btn-copy" onClick={copyLink}>
            Copiar Link
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="lot-filters">
        <div className="search-box">
          <input 
            type="text" 
            placeholder="Buscar por descrição" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search size={18} className="search-icon" />
        </div>
        <select 
          className="category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="todas">Todas as Categorias</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.nome}</option>
          ))}
        </select>
        <select className="order-filter">
          <option>Ordenação Padrão</option>
          <option>Menor Preço</option>
          <option>Maior Preço</option>
          <option>Nome A-Z</option>
        </select>
      </div>

      {/* Product Grid */}
      <div className="products-grid">
        {filteredProducts.length === 0 ? (
          <div className="empty-products">
            <p>Nenhum produto no catálogo</p>
            <button className="btn btn-primary">
              <Plus size={16} /> Adicionar Produto
            </button>
          </div>
        ) : (
          filteredProducts.map((lp, index) => {
            const product = lp.product
            if (!product) return null
            
            return (
              <div key={lp.id} className="product-card">
                {/* Remove button */}
                <button className="card-remove" onClick={() => removeProduct(lp.id)}>
                  <X size={16} />
                </button>

                {/* Edit button */}
                <button className="card-edit" onClick={() => setEditingProduct(product)}>
                  Editar
                </button>

                {/* Product image */}
                <div className="card-image">
                  {product.imagem1 ? (
                    <img src={product.imagem1} alt={product.nome} />
                  ) : (
                    <div className="no-image">
                      <Image size={40} />
                    </div>
                  )}
                  <span className="card-id">ID {index + 1}</span>
                </div>

                {/* Product info */}
                <div className="card-info">
                  <p className="info-line"><strong>Qtde Pedidos:</strong> {lp.quantidade_pedidos || 0}</p>
                  <p className="info-line"><strong>Qtde Clientes:</strong> {lp.quantidade_clientes || 0}</p>
                  <p className="info-line"><strong>Categoria:</strong> {product.category?.nome || '-'}</p>
                  <p className="info-line"><strong>Obs/Descrição:</strong> {product.descricao || product.nome}</p>
                  <p className="info-line price"><strong>Valor Unitário:</strong> R$ {product.preco?.toFixed(2) || '0,00'}</p>
                </div>

                {/* Card actions */}
                <div className="card-actions">
                  <button className="btn btn-sm btn-outline">Pedidos</button>
                  <button className="btn-icon-sm"><MessageCircle size={16} /></button>
                  <button className="btn-icon-sm"><Image size={16} /></button>
                  <button className="btn-icon-sm"><LinkIcon size={16} /></button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
