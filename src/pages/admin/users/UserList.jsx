import { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Shield, User, Mail, Phone, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './UserList.css'

export default function UserList() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    role: 'admin', // admin ou cliente (mas aqui focamos em gestão)
    role: 'admin',
    cadastro_status: 'completo'
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      // Buscar clientes que são admins ou staff (se houver essa distinção)
      // Por enquanto, listar todos, mas destacar admins
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('nome')

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Erro ao buscar usuários:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.nome || !formData.email) {
      alert('Nome e Email são obrigatórios')
      return
    }

    setSaving(true)
    try {
      if (editingUser) {
        const { error } = await supabase
          .from('clients')
          .update(formData)
          .eq('id', editingUser.id)
        if (error) throw error
      } else {
        // Criar usuário (Nota: criar Auth seria ideal via Edge Function, 
        // mas aqui vamos criar o registro client apenas para visualização/gestão)
        const { error } = await supabase
          .from('clients')
          .insert(formData)
        if (error) throw error
      }
      setShowModal(false)
      fetchUsers()
    } catch (error) {
      alert('Erro ao salvar usuário')
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = users.filter(u => 
    u.nome?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const openEdit = (user) => {
    setEditingUser(user)
    setFormData({
      nome: user.nome,
      email: user.email,
      telefone: user.telefone,
      role: user.role,
      cadastro_status: user.cadastro_status || 'completo'
    })
    setShowModal(true)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Gerenciar Usuários</h1>
        <button className="btn btn-primary" onClick={() => { setEditingUser(null); setShowModal(true) }}>
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      <div className="search-bar">
        <input 
          type="text" 
          placeholder="Buscar por nome ou email..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Search size={18} className="search-icon" />
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contato</th>
              <th>Função</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center p-4">Carregando...</td></tr>
            ) : filteredUsers.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar">
                      <User size={16} />
                    </div>
                    <div>
                      <span className="user-name">{user.nome}</span>
                      <small className="user-email">{user.email}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="contact-cell">
                    <span><Phone size={12} /> {user.telefone}</span>
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${user.role}`}>
                    {user.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                    {user.role}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${user.approved ? 'active' : 'pending'}`}>
                    {user.approved ? 'Aprovado' : 'Pendente'}
                  </span>
                </td>
                <td>
                  <button className="btn-icon" onClick={() => openEdit(user)}>
                    <Edit size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nome</label>
                <input 
                  value={formData.nome} 
                  onChange={e => setFormData({...formData, nome: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <label>Telefone</label>
                <input 
                  value={formData.telefone} 
                  onChange={e => setFormData({...formData, telefone: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <label>Função</label>
                <select 
                  value={formData.role} 
                  onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  <option value="cliente">Cliente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
