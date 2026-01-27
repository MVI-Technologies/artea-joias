import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Users } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

export default function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    instagram: '',
    cpf: '',
    aniversario: '',
    grupo: 'Grupo Compras',
    approved: false,
    cadastro_status: 'pendente',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: ''
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (id) {
      fetchClient()
    }
  }, [id])

  const fetchClient = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      const endereco = data.enderecos?.[0] || {}
      setFormData({
        nome: data.nome || '',
        telefone: data.telefone ? formatTelefone(data.telefone) : '',
        email: data.email || '',
        instagram: data.instagram || '',
        cpf: data.cpf ? formatCpfCnpj(data.cpf) : '',
        aniversario: data.aniversario || '',
        grupo: data.grupo || 'Grupo Compras',
        approved: data.approved || false,
        cadastro_status: data.cadastro_status || 'pendente',
        endereco: endereco.logradouro || '',
        numero: endereco.numero || '',
        complemento: endereco.complemento || '',
        bairro: endereco.bairro || '',
        cidade: endereco.cidade || '',
        estado: endereco.estado || '',
        cep: endereco.cep || ''
      })
    } catch (error) {
      console.error('Erro ao carregar cliente:', error)
    } finally {
      setLoading(false)
    }
  }

  // Função para formatar CPF/CNPJ
  const formatCpfCnpj = (value) => {
    const numbers = value.replace(/\D/g, '')

    if (numbers.length <= 11) {
      // CPF: 000.000.000-00
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    } else {
      // CNPJ: 00.000.000/0000-00
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
    }
  }

  // Função para formatar telefone
  const formatTelefone = (value) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  // Função para detectar tipo de pessoa
  const getTipoPessoa = () => {
    const numbers = formData.cpf.replace(/\D/g, '')
    if (!numbers) return ''
    return numbers.length <= 11 ? 'Pessoa Física' : 'Pessoa Jurídica'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const clientData = {
        nome: formData.nome,
        telefone: formData.telefone.replace(/\D/g, ''), // Remove formatação
        email: formData.email,
        instagram: formData.instagram,
        cpf: formData.cpf.replace(/\D/g, ''), // Remove formatação
        aniversario: formData.aniversario || null,
        grupo: formData.grupo,
        approved: formData.approved,
        cadastro_status: formData.cadastro_status,
        enderecos: [{
          logradouro: formData.endereco,
          numero: formData.numero,
          complemento: formData.complemento,
          bairro: formData.bairro,
          cidade: formData.cidade,
          estado: formData.estado,
          cep: formData.cep
        }]
      }

      if (isEditing) {
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('clients')
          .insert({ ...clientData, role: 'cliente' })

        if (error) throw error
      }

      navigate('/admin/clientes')
    } catch (error) {
      console.error('Erro ao salvar cliente:', error)
      alert('Erro ao salvar cliente')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center p-lg">
        <div className="loading-spinner" style={{ width: 40, height: 40 }} />
      </div>
    )
  }

  return (
    <div className="client-form-page">
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
        <Link to="/admin/clientes" className="btn btn-outline btn-sm">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <h1><Users size={24} /> {isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="card-body">
            <h3 className="mb-md">Dados Pessoais</h3>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Nome Completo *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Telefone/WhatsApp *</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="(00) 00000-0000"
                  value={formData.telefone}
                  onChange={e => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })}
                  maxLength={15}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Instagram</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="@usuario"
                  value={formData.instagram}
                  onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">CPF/CNPJ</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  value={formData.cpf}
                  onChange={e => setFormData({ ...formData, cpf: formatCpfCnpj(e.target.value) })}
                  maxLength={18}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Pessoa</label>
                <input
                  type="text"
                  className="form-input"
                  value={getTipoPessoa()}
                  disabled
                  style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Data de Nascimento</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.aniversario}
                  onChange={e => setFormData({ ...formData, aniversario: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Grupo</label>
                <select
                  className="form-select"
                  value={formData.grupo}
                  onChange={e => setFormData({ ...formData, grupo: e.target.value })}
                >
                  <option value="Grupo Compras">Grupo Compras</option>
                  <option value="Atacado">Atacado</option>
                  <option value="Varejo">Varejo</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Status do Cadastro</label>
                <select
                  className="form-select"
                  value={formData.cadastro_status}
                  onChange={e => setFormData({ ...formData, cadastro_status: e.target.value })}
                >
                  <option value="pendente">Pendente</option>
                  <option value="incompleto">Incompleto</option>
                  <option value="completo">Completo</option>
                </select>
              </div>
            </div>

            <h3 className="mb-md mt-lg">Endereço</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Endereço</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.endereco}
                  onChange={e => setFormData({ ...formData, endereco: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Número</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.numero}
                  onChange={e => setFormData({ ...formData, numero: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Complemento</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.complemento}
                  onChange={e => setFormData({ ...formData, complemento: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Bairro</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.bairro}
                  onChange={e => setFormData({ ...formData, bairro: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cidade</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.cidade}
                  onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Estado</label>
                <select
                  className="form-select"
                  value={formData.estado}
                  onChange={e => setFormData({ ...formData, estado: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  <option value="AC">Acre</option>
                  <option value="AL">Alagoas</option>
                  <option value="AP">Amapá</option>
                  <option value="AM">Amazonas</option>
                  <option value="BA">Bahia</option>
                  <option value="CE">Ceará</option>
                  <option value="DF">Distrito Federal</option>
                  <option value="ES">Espírito Santo</option>
                  <option value="GO">Goiás</option>
                  <option value="MA">Maranhão</option>
                  <option value="MT">Mato Grosso</option>
                  <option value="MS">Mato Grosso do Sul</option>
                  <option value="MG">Minas Gerais</option>
                  <option value="PA">Pará</option>
                  <option value="PB">Paraíba</option>
                  <option value="PR">Paraná</option>
                  <option value="PE">Pernambuco</option>
                  <option value="PI">Piauí</option>
                  <option value="RJ">Rio de Janeiro</option>
                  <option value="RN">Rio Grande do Norte</option>
                  <option value="RS">Rio Grande do Sul</option>
                  <option value="RO">Rondônia</option>
                  <option value="RR">Roraima</option>
                  <option value="SC">Santa Catarina</option>
                  <option value="SP">São Paulo</option>
                  <option value="SE">Sergipe</option>
                  <option value="TO">Tocantins</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">CEP</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.cep}
                  onChange={e => setFormData({ ...formData, cep: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group mt-md">
              <label className="checkbox-label-list">
                <input
                  type="checkbox"
                  checked={formData.approved}
                  onChange={e => setFormData({ ...formData, approved: e.target.checked })}
                />
                <span>Cliente aprovado para compras</span>
              </label>
            </div>
          </div>

          <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/clientes')}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
