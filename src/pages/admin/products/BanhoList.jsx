import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Palette } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

export default function BanhoList() {
  const [banhos, setBanhos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    cor_hex: '#FFD700',
    ativo: true
  })

  useEffect(() => {
    fetchBanhos()
  }, [])

  const fetchBanhos = async () => {
    try {
      const { data, error } = await supabase
        .from('banhos')
        .select('*')
        .order('nome')

      if (error) throw error
      setBanhos(data || [])
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao carregar banhos')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      if (editing) {
        const { error } = await supabase
          .from('banhos')
          .update(formData)
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('banhos')
          .insert([formData])
        if (error) throw error
      }

      setShowModal(false)
      setEditing(null)
      setFormData({ nome: '', descricao: '', cor_hex: '#FFD700', ativo: true })
      fetchBanhos()
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao salvar: ' + error.message)
    }
  }

  const handleEdit = (banho) => {
    setEditing(banho)
    setFormData({
      nome: banho.nome,
      descricao: banho.descricao || '',
      cor_hex: banho.cor_hex || '#FFD700',
      ativo: banho.ativo
    })
    setShowModal(true)
  }

  const handleDelete = async (id, nome) => {
    if (!confirm(`Excluir "${nome}"?`)) return
    try {
      const { error } = await supabase.from('banhos').delete().eq('id', id)
      if (error) throw error
      fetchBanhos()
    } catch (error) {
      alert('Erro: Verifique se não há produtos vinculados')
    }
  }

  if (loading) {
    return <div className="page-container"><div className="loading-spinner" style={{ margin: '40px auto' }} /></div>
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Tipos de Banho</h1>
          <p className="page-subtitle">Gerencie os acabamentos dos produtos</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setEditing(null)
          setFormData({ nome: '', descricao: '', cor_hex: '#FFD700', ativo: true })
          setShowModal(true)
        }}>
          <Plus size={18} /> Novo Banho
        </button>
      </div>

      <div className="card">
        <div className="banho-grid">
          {banhos.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Nenhum banho cadastrado
            </p>
          ) : (
            banhos.map((banho) => (
              <div key={banho.id} className={`banho-card ${!banho.ativo ? 'inactive' : ''}`}>
                <div 
                  className="banho-color" 
                  style={{ backgroundColor: banho.cor_hex || '#ccc' }}
                />
                <div className="banho-info">
                  <h3>{banho.nome}</h3>
                  <p>{banho.descricao || 'Sem descrição'}</p>
                  <span className={`badge badge-${banho.ativo ? 'success' : 'secondary'}`}>
                    {banho.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="banho-actions">
                  <button className="btn-icon" onClick={() => handleEdit(banho)}><Edit size={16} /></button>
                  <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(banho.id, banho.nome)}><Trash2 size={16} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Editar Banho' : 'Novo Banho'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Ouro 18k"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descrição</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Descrição do tipo de banho"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cor de Exibição</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={formData.cor_hex}
                      onChange={(e) => setFormData({ ...formData, cor_hex: e.target.value })}
                      style={{ width: '60px', height: '40px', border: 'none', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      value={formData.cor_hex}
                      onChange={(e) => setFormData({ ...formData, cor_hex: e.target.value })}
                      style={{ flex: 1 }}
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
                    <span>Ativo</span>
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

      <style>{`
        .banho-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          padding: 16px;
        }
        .banho-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 8px;
          transition: all 0.2s;
        }
        .banho-card:hover {
          border-color: var(--primary);
        }
        .banho-card.inactive {
          opacity: 0.6;
        }
        .banho-color {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 2px solid var(--border);
        }
        .banho-info {
          flex: 1;
        }
        .banho-info h3 {
          margin: 0 0 4px;
          font-size: 16px;
        }
        .banho-info p {
          margin: 0 0 8px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .banho-actions {
          display: flex;
          gap: 8px;
        }
      `}</style>
    </div>
  )
}
