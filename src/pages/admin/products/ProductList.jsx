import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Package,
  Upload,
  Eye
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './ProductList.css'

export default function ProductList() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categoria:categories(nome)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('nome')

      setCategories(data || [])
    } catch (error) {
      console.error('Erro ao carregar categorias:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error
      setProducts(products.filter(p => p.id !== id))
    } catch (error) {
      console.error('Erro ao excluir produto:', error)
      alert('Erro ao excluir produto')
    }
  }

  const openEditModal = (product) => {
    setEditingProduct(product || null)
    setShowModal(true)
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !selectedCategory || product.categoria_id === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="product-list-page">
      <div className="page-header">
        <h1><Package size={24} /> Produtos</h1>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn btn-success" onClick={() => openEditModal(null)}>
            <Plus size={18} />
            Adicionar Produto
          </button>
        </div>

        <div className="toolbar-right">
          <div className="search-bar">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar por descrição"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            style={{ width: 180 }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Todas as Categorias</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="text-center p-lg">
          <div className="loading-spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card">
          <div className="card-body text-center">
            <Package size={48} className="text-muted" style={{ marginBottom: 16 }} />
            <h3>Nenhum produto encontrado</h3>
            <p className="text-muted">Clique em "Adicionar Produto" para começar.</p>
          </div>
        </div>
      ) : (
        <div className="product-grid">
          {filteredProducts.map(product => (
            <div key={product.id} className="product-card">
              <div className="product-card-image">
                {product.imagem1 ? (
                  <img src={product.imagem1} alt={product.nome} />
                ) : (
                  <div className="product-card-placeholder">
                    <Package size={48} />
                  </div>
                )}
                <button 
                  className="product-card-delete"
                  onClick={() => handleDelete(product.id)}
                >
                  <Trash2 size={14} />
                </button>
                <button 
                  className="product-card-edit"
                  onClick={() => openEditModal(product)}
                >
                  Editar
                </button>
                <span className="product-card-id">ID {product.id?.slice(-4)}</span>
              </div>
              <div className="product-card-body">
                <p className="product-card-info">
                  <strong>Qtde Pedidos:</strong> 0
                </p>
                <p className="product-card-info">
                  <strong>Qtde Clientes:</strong> 0
                </p>
                <p className="product-card-info">
                  <strong>Categoria:</strong> {product.categoria?.nome || '-'}
                </p>
                <p className="product-card-info">
                  <strong>Obs/Descrição:</strong> {product.descricao || product.nome}
                </p>
                <p className="product-card-info">
                  <strong>Valor Unitário:</strong> R$ {product.preco?.toFixed(2)}
                </p>
              </div>
              <div className="product-card-actions">
                <button><Eye size={16} /> Pedidos</button>
                <button>WhatsApp</button>
                <button>Foto</button>
                <button>Link</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={() => {
            setShowModal(false)
            setEditingProduct(null)
          }}
          onSave={() => {
            fetchProducts()
            setShowModal(false)
            setEditingProduct(null)
          }}
        />
      )}
    </div>
  )
}

function ProductModal({ product, categories, onClose, onSave }) {
  const [formData, setFormData] = useState({
    nome: product?.nome || '',
    descricao: product?.descricao || '',
    categoria_id: product?.categoria_id || '',
    custo: product?.custo || '',
    margem_pct: product?.margem_pct || 10,
    quantidade_minima: product?.quantidade_minima || 1,
    imagem1: product?.imagem1 || '',
    imagem2: product?.imagem2 || ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        ...formData,
        custo: parseFloat(formData.custo),
        margem_pct: parseFloat(formData.margem_pct),
        quantidade_minima: parseInt(formData.quantidade_minima)
      }

      if (product) {
        const { error } = await supabase
          .from('products')
          .update(data)
          .eq('id', product.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('products')
          .insert(data)

        if (error) throw error
      }

      onSave()
    } catch (error) {
      console.error('Erro ao salvar produto:', error)
      alert('Erro ao salvar produto')
    } finally {
      setLoading(false)
    }
  }

  const preco = formData.custo ? (parseFloat(formData.custo) * (1 + parseFloat(formData.margem_pct) / 100)).toFixed(2) : '0.00'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{product ? 'Editar Produto' : 'Novo Produto'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nome}
                  onChange={e => setFormData({...formData, nome: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select
                  className="form-select"
                  value={formData.categoria_id}
                  onChange={e => setFormData({...formData, categoria_id: e.target.value})}
                >
                  <option value="">Selecione...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nome}</option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label className="form-label">Descrição</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.descricao}
                  onChange={e => setFormData({...formData, descricao: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Custo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.custo}
                  onChange={e => setFormData({...formData, custo: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Margem (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.margem_pct}
                  onChange={e => setFormData({...formData, margem_pct: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preço Final</label>
                <input
                  type="text"
                  className="form-input"
                  value={`R$ ${preco}`}
                  disabled
                />
              </div>

              <div className="form-group">
                <label className="form-label">Qtd. Mínima</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.quantidade_minima}
                  onChange={e => setFormData({...formData, quantidade_minima: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">URL Imagem 1</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.imagem1}
                  onChange={e => setFormData({...formData, imagem1: e.target.value})}
                  placeholder="https://..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">URL Imagem 2</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.imagem2}
                  onChange={e => setFormData({...formData, imagem2: e.target.value})}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
