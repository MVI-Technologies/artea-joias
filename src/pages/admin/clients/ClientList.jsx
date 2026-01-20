import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Plus, 
  Search, 
  Users,
  Phone,
  Star,
  ChevronDown,
  BarChart3
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './ClientList.css'

export default function ClientList() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

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

  const toggleApproval = async (client) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ approved: !client.approved })
        .eq('id', client.id)

      if (error) throw error
      fetchClients()
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error)
    }
  }

  const getStatusBadge = (client) => {
    if (client.cadastro_status === 'pendente') {
      return <span className="badge badge-pendente">Pendente</span>
    }
    if (client.cadastro_status === 'incompleto') {
      return <span className="badge badge-incompleto">Cadastro Incompleto</span>
    }
    return <span className="badge badge-completo">Cadastro Completo</span>
  }

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.telefone?.includes(searchTerm)
    const matchesStatus = !filterStatus || client.cadastro_status === filterStatus
    return matchesSearch && matchesStatus
  })

  const renderStars = (count) => {
    return (
      <div className="stars">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            size={14} 
            fill={i < count ? '#ffc107' : 'none'}
            color={i < count ? '#ffc107' : '#ddd'}
          />
        ))}
      </div>
    )
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
            Cliente
          </Link>
          <div className="dropdown">
            <button className="btn btn-secondary">
              <BarChart3 size={18} />
              Relatórios <ChevronDown size={14} />
            </button>
          </div>
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
                <th>WhatsApp</th>
                <th>Saldo Devedor</th>
                <th>Crédito Disponível</th>
                <th>Última Compra</th>
                <th></th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center">
                    <div className="loading-spinner" />
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : (
                filteredClients.map(client => (
                  <tr key={client.id}>
                    <td>
                      <div className="client-name-cell">
                        <span className="client-group-badge">Grupo Compras</span>
                        <span className="client-name">{client.nome}</span>
                        {getStatusBadge(client)}
                      </div>
                    </td>
                    <td>
                      <div className="client-phone">
                        {client.telefone}
                        <Phone size={14} className="text-muted" />
                      </div>
                    </td>
                    <td>
                      <a href="#" className="text-danger">
                        R$ {(client.saldo_devedor || 0).toFixed(2)}
                      </a>
                      {' '}
                      <a href="#" className="text-primary">Pagamentos</a>
                    </td>
                    <td>
                      <a href="#" className="text-primary">
                        R$ {(client.credito_disponivel || 0).toFixed(2)}
                      </a>
                      {' '}
                      <a href="#" className="text-primary">Gerenciar</a>
                    </td>
                    <td>
                      <a href="#" className="text-primary">Gerenciar</a>
                    </td>
                    <td>
                      {renderStars(client.estrelinhas || 0)}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm">
                        Ações
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="table-footer">
          <span className="text-muted">
            Página 1 / 1 - {filteredClients.length} resultados
          </span>
        </div>
      </div>
    </div>
  )
}
