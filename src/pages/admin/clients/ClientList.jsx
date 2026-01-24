
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Plus, 
  Search, 
  Users,
  ChevronDown,
  BarChart3,
  Edit2,
  Calendar,
  DollarSign,
  CreditCard,
  X,
  AlertTriangle,
  MessageCircle,
  Trash2 
} from 'lucide-react'
import WhatsAppIcon from '../../../components/icons/WhatsAppIcon'
import { supabase } from '../../../lib/supabase'
import './ClientList.css'

export default function ClientList() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [modalMode, setModalMode] = useState('') // 'saldo', 'credito', 'ultima_compra'
  const [modalValue, setModalValue] = useState('')
  const [saving, setSaving] = useState(false)

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

  const handleDelete = async (client) => {
    if (!window.confirm(`Tem certeza que deseja excluir o cliente "${client.nome}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id)

      if (error) throw error
      
      // Update local state directly to avoid refetch flicker
      setClients(clients.filter(c => c.id !== client.id))
      // fetchClients() // Optional: refetch to be sure
    } catch (error) {
      console.error('Erro ao excluir cliente:', error)
      alert('Erro ao excluir cliente: ' + error.message)
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

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.telefone?.includes(searchTerm)
    // Filter status logic can be refined if needed
    return matchesSearch
  })

  // Modal Handlers
  const openModal = (client, mode) => {
      // Data agora é automática, apenas info
      if (mode === 'ultima_compra') return 

      setEditingClient(client)
      setModalMode(mode)
      
      if (mode === 'saldo') setModalValue(client.saldo_devedor || 0)
      if (mode === 'credito') setModalValue(client.credito_disponivel || 0)
      
      setIsModalOpen(true)
  }

  const handleSave = async () => {
      if (!editingClient) return
      setSaving(true)
      try {
          const updates = {}
          if (modalMode === 'saldo') updates.saldo_devedor = parseFloat(modalValue)
          if (modalMode === 'credito') updates.credito_disponivel = parseFloat(modalValue)
          if (modalMode === 'ultima_compra') updates.ultima_compra = modalValue ? new Date(modalValue).toISOString() : null

          const { error } = await supabase
              .from('clients')
              .update(updates)
              .eq('id', editingClient.id)

          if (error) throw error
          
          // Update local state
          setClients(clients.map(c => c.id === editingClient.id ? { ...c, ...updates } : c))
          setIsModalOpen(false)
      } catch (error) {
          console.error('Erro ao salvar:', error)
          alert('Erro ao salvar alterações.')
      } finally {
          setSaving(false)
      }
  }

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

      {/* Clients Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Contato</th>
                <th>Financeiro</th>
                <th>Última Compra</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center">
                    <div className="loading-spinner" />
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted">
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
                        {client.telefone}
                        <WhatsAppIcon size={14} className="text-muted" />
                      </div>
                    </td>
                    <td>
                      <div className="financial-cell">
                        <div className="financial-row text-danger" onClick={() => openModal(client, 'saldo')} title="Editar Saldo Devedor" style={{cursor: 'pointer'}}>
                            <DollarSign size={14} /> Devedor: R$ {(client.saldo_devedor || 0).toFixed(2)} <Edit2 size={10} />
                        </div>
                        <div className="financial-row text-success" onClick={() => openModal(client, 'credito')} title="Editar Crédito" style={{cursor: 'pointer'}}>
                            <CreditCard size={14} /> Crédito: R$ {(client.credito_disponivel || 0).toFixed(2)} <Edit2 size={10} />
                        </div>
                      </div>
                    </td>
                    <td>
                        <div className="date-cell" title="Atualizado via Romaneios">
                            {client.ultima_compra ? new Date(client.ultima_compra).toLocaleDateString('pt-BR') : '-'}
                        </div>
                    </td>
                    <td>
                        {getStatusBadge(client)}
                    </td>
                    <td>
                      {/* Se cadastro incompleto, força edição */}
                      {client.cadastro_status === 'incompleto' ? (
                          <button 
                            className="btn btn-sm btn-warning"
                            onClick={() => navigate(`/admin/clientes/${client.id}`)}
                            title="Completar dados cadastrais"
                          >
                            <AlertTriangle size={12} style={{marginRight: 4}}/> Atualizar
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
                        className="btn btn-sm btn-outline-danger ml-2"
                        onClick={() => handleDelete(client)}
                        title="Excluir Cliente"
                        style={{marginLeft: '8px'}}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
          <div className="modal-overlay">
              <div className="modal-content">
                  <div className="modal-header">
                      <h3>
                          {modalMode === 'saldo' && 'Gerenciar Saldo Devedor'}
                          {modalMode === 'credito' && 'Gerenciar Crédito'}
                          {modalMode === 'ultima_compra' && 'Data Última Compra'}
                      </h3>
                      <button className="btn-close" onClick={() => setIsModalOpen(false)}>
                          <X size={20} />
                      </button>
                  </div>
                  <div className="modal-body">
                      <p>Cliente: <strong>{editingClient?.nome}</strong></p>
                      
                      <div className="form-group">
                          <label>
                              {modalMode === 'saldo' && 'Valor Devido (R$)'}
                              {modalMode === 'credito' && 'Crédito Disponível (R$)'}
                          </label>
                          <input 
                              type="number"
                              step="0.01"
                              className="form-control"
                              value={modalValue}
                              onChange={e => setModalValue(e.target.value)}
                          />
                      </div>
                  </div>
                  <div className="modal-footer">
                      <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                          {saving ? 'Salvando...' : 'Salvar'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}
