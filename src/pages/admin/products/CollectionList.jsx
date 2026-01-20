import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Calendar } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

export default function CollectionList() {
  const [colecoes, setColecoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    data_lancamento: '',
    ativo: true
  })

  useEffect(() => {
    fetchColecoes()
  }, [])

  const fetchColecoes = async () => {
    try {
      const { data, error } = await supabase
        .from('colecoes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setColecoes(data || [])
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        data_lancamento: formData.data_lancamento || null
      }
      
      if (editing) {
        const { error } = await supabase.from('colecoes').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('colecoes').insert([payload])
        if (error) throw error
      }
      setShowModal(false)
      setEditing(null)
      setFormData({ nome: '', descricao: '', data_lancamento: '', ativo: true })
      fetchColecoes()
    } catch (error) {
      alert('Erro: ' + error.message)
    }
  }

  const handleEdit = (col) => {
    setEditing(col)
    setFormData({
      nome: col.nome,
      descricao: col.descricao || '',
      data_lancamento: col.data_lancamento || '',
      ativo: col.ativo
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta coleção?')) return
    try {
      const { error } = await supabase.from('colecoes').delete().eq('id', id)
      if (error) throw error
      fetchColecoes()
    } catch (error) {
      alert('Erro ao excluir')
    }
  }

  if (loading) return <div className="page-container"><div className="loading-spinner" style={{ margin: '40px auto' }} /></div>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Coleções</h1>
          <p className="page-subtitle">Organize seus produtos em coleções</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setEditing(null)
          setFormData({ nome: '', descricao: '', data_lancamento: '', ativo: true })
          setShowModal(true)
        }}>
          <Plus size={18} /> Nova Coleção
        </button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Descrição</th>
              <th>Lançamento</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {colecoes.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>Nenhuma coleção</td></tr>
            ) : (
              colecoes.map((col) => (
                <tr key={col.id}>
                  <td className="font-medium">{col.nome}</td>
                  <td>{col.descricao || '-'}</td>
                  <td>{col.data_lancamento ? new Date(col.data_lancamento).toLocaleDateString('pt-BR') : '-'}</td>
                  <td><span className={`badge badge-${col.ativo ? 'success' : 'secondary'}`}>{col.ativo ? 'Ativa' : 'Inativa'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-icon" onClick={() => handleEdit(col)}><Edit size={16} /></button>
                      <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(col.id)}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Editar Coleção' : 'Nova Coleção'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input type="text" className="form-input" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Descrição</label>
                  <textarea className="form-input" rows="2" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Data de Lançamento</label>
                  <input type="date" className="form-input" value={formData.data_lancamento} onChange={(e) => setFormData({ ...formData, data_lancamento: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-checkbox">
                    <input type="checkbox" checked={formData.ativo} onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })} />
                    <span>Ativa</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Atualizar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
