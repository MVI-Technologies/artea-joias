import { useState, useEffect } from 'react'
import { Plus, Search } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './CategoryList.css'

export default function CategoryList() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [search, setSearch] = useState('')
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    codigo: '',
    comissao_pct: 0,
    desconto_pct: 0,
    ativo: true
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('nome')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateCode = (nome) => {
    // Gera código de 2-3 letras do nome
    if (!nome) return ''
    const words = nome.split(' ')
    if (words.length > 1) {
      return words.map(w => w[0]).join('').toUpperCase().slice(0, 3)
    }
    return nome.slice(0, 3).toUpperCase()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        codigo: formData.codigo || generateCode(formData.nome)
      }

      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', editingCategory.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([payload])
        if (error) throw error
      }

      setShowModal(false)
      setEditingCategory(null)
      setFormData({ nome: '', descricao: '', codigo: '', comissao_pct: 0, desconto_pct: 0, ativo: true })
      fetchCategories()
    } catch (error) {
      alert('Erro: ' + error.message)
    }
  }

  const handleEdit = (category) => {
    setEditingCategory(category)
    setFormData({
      nome: category.nome,
      descricao: category.descricao || '',
      codigo: category.codigo || generateCode(category.nome),
      comissao_pct: category.comissao_pct || 0,
      desconto_pct: category.desconto_pct || 0,
      ativo: category.ativo
    })
    setShowModal(true)
  }

  const filteredCategories = categories.filter(cat =>
    cat.nome.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="page-container"><div className="loading-spinner" style={{ margin: '40px auto' }} /></div>
  }

  return (
    <div className="page-container categories-page">
      {/* Search */}
      <div className="categories-toolbar">
        <div className="search-box">
          <input 
            type="text" 
            placeholder="Buscar nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search size={18} className="search-icon" />
        </div>
      </div>

      {/* Add button */}
      <div className="categories-actions">
        <button className="btn btn-primary" onClick={() => {
          setEditingCategory(null)
          setFormData({ nome: '', descricao: '', codigo: '', comissao_pct: 0, desconto_pct: 0, ativo: true })
          setShowModal(true)
        }}>
          <Plus size={16} /> Categoria
        </button>
      </div>

      {/* Table */}
      <div className="categories-table-container">
        <table className="categories-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Comissão %</th>
              <th>Desconto %</th>
            </tr>
          </thead>
          <tbody>
            {filteredCategories.length === 0 ? (
              <tr>
                <td colSpan="4" className="empty-message">Nenhuma categoria encontrada</td>
              </tr>
            ) : (
              filteredCategories.map((category) => (
                <tr key={category.id} className="category-row">
                  <td className="id-cell">
                    <span className="id-code">{category.codigo || generateCode(category.nome)}</span>
                    <a href="#" className="edit-link" onClick={(e) => { e.preventDefault(); handleEdit(category) }}>
                      Editar
                    </a>
                  </td>
                  <td>{category.nome}</td>
                  <td>{category.comissao_pct || '-'}</td>
                  <td>{category.desconto_pct || '0'}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="categories-pagination">
        Página 1 / 1 - {filteredCategories.length} resultados
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Código (ID)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                      placeholder="Ex: AL, AN, BR"
                      maxLength={4}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">Nome *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Comissão %</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.comissao_pct}
                      onChange={(e) => setFormData({ ...formData, comissao_pct: parseFloat(e.target.value) || 0 })}
                      step="0.1"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Desconto %</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.desconto_pct}
                      onChange={(e) => setFormData({ ...formData, desconto_pct: parseFloat(e.target.value) || 0 })}
                      step="0.1"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    />
                    <span>Ativa</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingCategory ? 'Atualizar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
