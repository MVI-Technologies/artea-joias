import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Edit, Trash2, Shield, User, Mail, CheckCircle, XCircle, Lock } from 'lucide-react'
import WhatsAppIcon from '../../../components/icons/WhatsAppIcon'
import { supabase } from '../../../lib/supabase'
import PasswordInput from '../../../components/ui/PasswordInput'
import './UserList.css'

export default function UserList() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalMode, setModalMode] = useState('') // 'create', 'edit'
  const [selectedUser, setSelectedUser] = useState(null)
  const [passwordResetModalOpen, setPasswordResetModalOpen] = useState(false)
  const [resetPasswordData, setResetPasswordData] = useState({ newPassword: '', confirmPassword: '' })
  const [resettingPassword, setResettingPassword] = useState(false)
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    telefone: '',
    role: 'cliente',
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





  const ensureUserAuth = async (user) => {
    if (user.auth_id) return user.auth_id

    // Se não tem auth_id, criar usuário no Auth
    console.log('Usuário sem auth_id, criando...')
    const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
            email: user.email,
            password: 'tempPassword123!', // Senha temporária, será alterada logo em seguida ou o usuário resetará
            nome: user.nome,
            telefone: user.telefone,
            role: user.role
        }
    })

    if (error) throw error
    if (data.error) throw new Error(data.error)

    // Atualizar o cliente localmente e no banco com o novo auth_id
    // Nota: A função create-user já deve atualizar o auth_id na tabela clients, mas vamos garantir
    // Recarregar o usuário para pegar o auth_id novo
    const { data: updatedUser, error: fetchError } = await supabase
        .from('clients')
        .select('auth_id')
        .eq('id', user.id)
        .single()
    
    if (fetchError || !updatedUser?.auth_id) {
        throw new Error('Erro ao recuperar auth_id após criação')
    }

    return updatedUser.auth_id
  }

  const handleSave = async () => {
    if (!formData.nome || !formData.email) {
      alert('Nome e Email são obrigatórios')
      return
    }

    if (modalMode === 'create' && !formData.password) {
      alert('Senha é obrigatória para novos usuários')
      return
    }

    setSaving(true)
    try {
      if (modalMode === 'edit') {
        // Antes de atualizar, verificar se tem auth_id (caso esteja tentando mudar algo crítico ou apenas para garantir consistência)
        // Se a edição envolver coisas que dependem do Auth (como role syncing), seria bom ter o auth_id.
        // Mas o requisito principal é na alteração de senha. Vamos adicionar a verificação aqui também se desejado,
        // mas para edição simples de dados (nome, telefone), talvez não seja estritamente necessário bloquear.
        // O usuário pediu "o mesmo para o caso de edição". Então vamos garantir auth_id na edição.
        
        await ensureUserAuth({ ...selectedUser, ...formData })

        const { error } = await supabase
          .from('clients')
          .update(formData)
          .eq('id', selectedUser.id)
        if (error) throw error
      } else {
        // Create user via Edge Function to ensure Auth + Client sync
        const { error } = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email,
            password: formData.password,
            nome: formData.nome,
            telefone: formData.telefone,
            role: formData.role
          }
        })
        
        if (error) throw error
      }
      setModalMode('')
      fetchUsers()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      alert('Erro ao salvar usuário: ' + (error.message || 'Erro desconhecido'))
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = users.filter(u => 
    u.nome?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const openEdit = (user) => {
    setSelectedUser(user)
    setFormData({
      nome: user.nome,
      email: user.email,
      password: '', // Don't show existing hash
      telefone: user.telefone,
      role: user.role,
      cadastro_status: user.cadastro_status || 'completo'
    })
    setModalMode('edit')
  }

  const handlePasswordUpdate = async () => {
    if (!selectedUser) return;
    
    if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
        alert('As senhas não coincidem.');
        return;
    }

    if (resetPasswordData.newPassword.length < 6) {
        alert('A senha deve ter no mínimo 6 caracteres.');
        return;
    }

    setResettingPassword(true);
    try {
        // Garantir que o usuário tenha auth_id antes de tentar trocar a senha
        const authId = await ensureUserAuth(selectedUser)

        const { data, error } = await supabase.functions.invoke('admin-update-password', {
            body: {
                userId: authId,
                newPassword: resetPasswordData.newPassword
            }
        });

        if (error) {
            throw error;
        }

        if (data && data.error) {
            throw new Error(data.error);
        }

        alert('Senha atualizada com sucesso!');
        setPasswordResetModalOpen(false);
        setResetPasswordData({ newPassword: '', confirmPassword: '' });
        
        // Atualizar lista para garantir que auth_id esteja sincronizado localmente se foi criado agora
        fetchUsers()
    } catch (error) {
        console.error('Erro ao atualizar senha:', error);
        alert('Erro ao atualizar senha: ' + error.message);
    } finally {
        setResettingPassword(false);
    }
  }

  const openPasswordResetModal = (user) => {
    setSelectedUser(user);
    setResetPasswordData({ newPassword: '', confirmPassword: '' });
    setPasswordResetModalOpen(true);
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Gerenciar Usuários</h1>
        <button className="btn btn-primary" onClick={() => { setSelectedUser(null); setFormData({ nome: '', email: '', password: '', telefone: '', role: 'cliente', cadastro_status: 'completo' }); setModalMode('create') }}>
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

      {/* Desktop: Users Table */}
      <div className="users-table-container hide-mobile">
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
                    <span><WhatsAppIcon size={12} /> {user.telefone}</span>
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${user.role}`}>
                    {user.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                    {user.role}
                  </span>
                </td>
                <td>
                  {user.approved ? (
                    <span className="status-active"><CheckCircle size={14} /> Ativo</span>
                  ) : (
                    <span className="status-pending"><XCircle size={14} /> Pendente</span>
                  )}
                </td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => openEdit(user)}>
                      <Edit size={14} />
                    </button>

                    <button
                      className="btn btn-sm btn-outline-warning"
                      onClick={() => openPasswordResetModal(user)}
                      title="Alterar Senha"
                      style={{ marginLeft: '8px' }}
                    >
                      <Lock size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: User Cards */}
      <div className="show-mobile">
        {loading ? (
          <div className="mobile-empty-state">
            <p>Carregando...</p>
          </div>
        ) : filteredUsers.map(user => (
          <div key={user.id} className="mobile-card">
            <div className="mobile-card-header">
              <span className="mobile-card-title">{user.nome}</span>
              <span className={`role-badge ${user.role}`}>
                {user.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                {user.role}
              </span>
            </div>
            <div className="mobile-card-body">
              <div className="mobile-card-row">
                <span className="mobile-card-label">Email:</span>
                <span className="mobile-card-value">{user.email}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Telefone:</span>
                <span className="mobile-card-value">{user.telefone || 'N/A'}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Status:</span>
                <span className="mobile-card-value">
                  {user.approved ? (
                    <span className="status-active"><CheckCircle size={14} /> Ativo</span>
                  ) : (
                    <span className="status-pending"><XCircle size={14} /> Pendente</span>
                  )}
                </span>
              </div>
            </div>
            <div className="mobile-card-actions">
              <button className="btn btn-sm btn-primary" onClick={() => openEdit(user)}>
                <Edit size={14} /> Editar
              </button>
              <button onClick={() => openPasswordResetModal(user)} className="btn btn-sm btn-outline-warning">
                <Lock size={14} /> Senha
              </button>
            </div>
          </div>
        ))}
        {filteredUsers.length === 0 && !loading && (
          <div className="mobile-empty-state">
            <p>Nenhum usuário encontrado</p>
          </div>
        )}
      </div>

      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="modal-overlay" onClick={() => setModalMode('')}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'edit' ? 'Editar Usuário' : 'Novo Usuário'}</h2>
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

              {modalMode === 'create' && (
                <div className="form-group">
                  <label>Senha</label>
                  <PasswordInput
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="form-control"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}
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
              <button className="btn btn-outline" onClick={() => setModalMode('')}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>Salvar</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Reset de Senha */}
      {passwordResetModalOpen && (
        <div className="modal-overlay" onClick={() => setPasswordResetModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Alterar Senha - {selectedUser?.nome}</h3>
              <button className="btn-close" onClick={() => setPasswordResetModalOpen(false)}>
                <XCircle size={24} />
              </button>
            </div>
            <div className="modal-body">
                <div className="form-group">
                  <label>Nova Senha</label>
                  <PasswordInput
                    value={resetPasswordData.newPassword}
                    onChange={e => setResetPasswordData({ ...resetPasswordData, newPassword: e.target.value })}
                    className="form-control"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="form-group">
                  <label>Confirmar Nova Senha</label>
                  <PasswordInput
                    value={resetPasswordData.confirmPassword}
                    onChange={e => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                    className="form-control"
                    placeholder="Confirme a nova senha"
                  />
                </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPasswordResetModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handlePasswordUpdate} disabled={resettingPassword}>
                {resettingPassword ? 'Salvando...' : 'Salvar Nova Senha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
