
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Plus,
  Search,
  Users,
  Edit,
  AlertTriangle,
  Trash2
} from 'lucide-react'
import WhatsAppIcon from '../../../components/icons/WhatsAppIcon'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/common/Toast'
import './ClientList.css'
import ConfirmationModal from '../../../components/common/ConfirmationModal'
import CenteredLoader from '../../../components/common/CenteredLoader'

export default function ClientList() {
  const navigate = useNavigate()
  const toast = useToast()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  
  // Deletion Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    client: null,
    loading: false
  })

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('role', 'cliente')
        .order('created_at', { ascending: false })

      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (client) => {
    setDeleteConfirmModal({
      isOpen: true,
      client,
      loading: false
    })
  }

  const confirmDelete = async () => {
    const { client } = deleteConfirmModal
    if (!client) return

    setDeleteConfirmModal(prev => ({ ...prev, loading: true }))
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id)

      if (error) {
        if (error.code === '23503') {
          throw new Error('Não é possível excluir este cliente porque existem registros vinculados a ele (logs de romaneio, etc).')
        }
        throw error
      }

      setClients(clients.filter(c => c.id !== client.id))
      toast.success('Cliente removido com sucesso!')
      setDeleteConfirmModal({ isOpen: false, client: null, loading: false })
    } catch (error) {
      console.error('Erro ao excluir cliente:', error)
      toast.error('Erro ao excluir cliente: ' + error.message)
      setDeleteConfirmModal(prev => ({ ...prev, loading: false }))
    }
  }

  const toggleApproval = async (client) => {
    try {
      // Se estiver aprovando, também marca cadastro como completo se estiver pendente
      const updates = { approved: !client.approved }
      if (!client.approved && client.cadastro_status === 'pendente') {
        updates.cadastro_status = 'completo'
      }

      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', client.id)

      if (error) throw error
      fetchClients()
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error)
    }
  }

  const getStatusBadge = (client) => {
    if (client.approved) {
      return <span className="badge badge-completo">Aprovado</span>
    }
    if (client.cadastro_status === 'pendente') {
      return <span className="badge badge-pendente">Pendente</span>
    }
    if (client.cadastro_status === 'incompleto') {
      return <span className="badge badge-incompleto">Incompleto</span>
    }
    return <span className="badge badge-pendente">Aguardando</span>
  }

  const formatTelefone = (value) => {
    if (!value) return '-'
    if (value.startsWith('+')) {
      return '+' + value.substring(1).replace(/[^\d\s\-\(\)]/g, '')
    }
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.telefone?.includes(searchTerm)
    // Filter status logic can be refined if needed
    return matchesSearch
  })


  return (
    <div className="client-list-page">
      <div className="page-header">
        <h1><Users size={24} /> Clientes</h1>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <Link to="/admin/clientes/novo" className="btn btn-success">
            <Plus size={18} />
            Novo Cliente
          </Link>
        </div>

        <div className="toolbar-right">
          <div className="search-bar">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Desktop: Clients Table */}
      <div className="card hide-mobile">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Contato</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4">
                    <CenteredLoader />
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : (
                filteredClients.map(client => (
                  <tr key={client.id}>
                    <td>
                      <div className="client-name-cell">
                        <span className="client-name">{client.nome}</span>
                        <span className="text-muted text-sm">{client.grupo}</span>
                      </div>
                    </td>
                    <td>
                      <div className="client-phone">
                        {formatTelefone(client.telefone)}
                        <WhatsAppIcon size={14} className="text-muted" />
                      </div>
                    </td>
                    <td>
                      {getStatusBadge(client)}
                    </td>
                    <td className="text-right">
                      <div className="actions-cell">
                        {/* Se cadastro incompleto, força edição */}
                        {client.cadastro_status === 'incompleto' ? (
                          <button
                            className="btn btn-sm btn-warning"
                            onClick={() => navigate(`/admin/clientes/${client.id}`)}
                            title="Completar dados cadastrais"
                          >
                            <AlertTriangle size={12} style={{ marginRight: 4 }} /> Atualizar
                          </button>
                        ) : (
                          <button
                            className={`btn btn-sm ${!client.approved ? 'btn-success' : 'btn-outline-danger'}`}
                            onClick={() => toggleApproval(client)}
                            title={client.approved ? "Bloquear Cadastro" : "Aprovar Cadastro"}
                          >
                            {client.approved ? "Bloquear" : "Aprovar"}
                          </button>
                        )}

                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => navigate(`/admin/clientes/${client.id}`)}
                          title="Editar Cliente"
                        >
                          <Edit size={16} />
                        </button>

                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(client)}
                          title="Excluir Cliente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: Client Cards */}
      <div className="show-mobile">
        {filteredClients.map(client => (
          <div key={client.id} className="mobile-card">
            <div className="mobile-card-header">
              <span className="mobile-card-title">{client.nome}</span>
              {getStatusBadge(client)}
            </div>
            <div className="mobile-card-body">
              <div className="mobile-card-row">
                <span className="mobile-card-label">Contato:</span>
                <span className="mobile-card-value">{formatTelefone(client.telefone)}</span>
              </div>
            </div>
            <div className="mobile-card-actions">
              {client.cadastro_status !== 'incompleto' && (
                <button
                  className={`btn btn-sm ${!client.approved ? 'btn-success' : 'btn-outline-danger'}`}
                  onClick={() => toggleApproval(client)}
                >
                  {client.approved ? "Bloquear" : "Aprovar"}
                </button>
              )}
              <Link to={`/admin/clientes/${client.id}`} className="btn btn-sm btn-primary">
                <Edit size={14} />{client.cadastro_status === 'incompleto' ? 'Completar' : 'Editar'}
              </Link>
              <button onClick={() => handleDelete(client)} className="btn btn-sm btn-danger">
                <Trash2 size={14} />Excluir
              </button>
            </div>
          </div>
        ))}
        {filteredClients.length === 0 && (
          <div className="mobile-empty-state">
            <p>Nenhum cliente encontrado</p>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmationModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => !deleteConfirmModal.loading && setDeleteConfirmModal({ isOpen: false, client: null, loading: false })}
        onConfirm={confirmDelete}
        isLoading={deleteConfirmModal.loading}
        title="Excluir Cliente"
        message={`Tem certeza que deseja excluir o cliente "${deleteConfirmModal.client?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="danger"
      />
    </div>
  )
}
