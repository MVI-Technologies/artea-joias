import { useState } from 'react'
import { User, Save, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import './ClientProfile.css'

export default function ClientProfile() {
  const { client, refreshProfile } = useAuth()
  const [loading, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    nome: client?.nome || '',
    telefone: client?.telefone || '',
    email: client?.email || '',
    aniversario: client?.aniversario || ''
  })
  const [addresses, setAddresses] = useState(client?.enderecos || [])
  const [newAddress, setNewAddress] = useState({
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: ''
  })
  const [showAddAddress, setShowAddAddress] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          nome: formData.nome,
          email: formData.email,
          aniversario: formData.aniversario || null,
          enderecos: addresses
        })
        .eq('id', client.id)

      if (error) throw error

      await refreshProfile()
      alert('Perfil atualizado com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar:', error)
      alert('Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  const addAddress = () => {
    if (!newAddress.logradouro || !newAddress.cidade) {
      alert('Preencha pelo menos o endereço e cidade')
      return
    }
    setAddresses([...addresses, newAddress])
    setNewAddress({
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: ''
    })
    setShowAddAddress(false)
  }

  const removeAddress = (index) => {
    setAddresses(addresses.filter((_, i) => i !== index))
  }

  return (
    <div className="client-profile-page">
      <h1><User size={24} /> Meu Perfil</h1>

      <div className="profile-grid">
        {/* Personal Info */}
        <div className="card">
          <div className="card-header">
            <h3>Dados Pessoais</h3>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Nome Completo</label>
              <input
                type="text"
                className="form-input"
                value={formData.nome}
                onChange={e => setFormData({...formData, nome: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Telefone/WhatsApp</label>
              <input
                type="tel"
                className="form-input"
                value={formData.telefone}
                disabled
              />
              <small className="text-muted">Contate o suporte para alterar</small>
            </div>

            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Data de Nascimento</label>
              <input
                type="date"
                className="form-input"
                value={formData.aniversario}
                onChange={e => setFormData({...formData, aniversario: e.target.value})}
              />
            </div>

            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              <Save size={16} />
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Addresses */}
        <div className="card">
          <div className="card-header">
            <h3>Endereços de Entrega</h3>
            <button 
              className="btn btn-success btn-sm"
              onClick={() => setShowAddAddress(true)}
            >
              <Plus size={14} /> Adicionar
            </button>
          </div>
          <div className="card-body">
            {addresses.length === 0 ? (
              <p className="text-muted">Nenhum endereço cadastrado</p>
            ) : (
              <div className="addresses-list">
                {addresses.map((addr, index) => (
                  <div key={index} className="address-card">
                    <div className="address-info">
                      <p>
                        {addr.logradouro}, {addr.numero}
                        {addr.complemento && ` - ${addr.complemento}`}
                      </p>
                      <p>{addr.bairro} - {addr.cidade}/{addr.estado}</p>
                      <p>CEP: {addr.cep}</p>
                    </div>
                    <button 
                      className="btn btn-danger btn-sm btn-icon"
                      onClick={() => removeAddress(index)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Address Form */}
            {showAddAddress && (
              <div className="add-address-form">
                <h4>Novo Endereço</h4>
                <div className="form-grid">
                  <div className="form-group full-width">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Rua, Avenida..."
                      value={newAddress.logradouro}
                      onChange={e => setNewAddress({...newAddress, logradouro: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Número"
                      value={newAddress.numero}
                      onChange={e => setNewAddress({...newAddress, numero: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Complemento"
                      value={newAddress.complemento}
                      onChange={e => setNewAddress({...newAddress, complemento: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Bairro"
                      value={newAddress.bairro}
                      onChange={e => setNewAddress({...newAddress, bairro: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Cidade"
                      value={newAddress.cidade}
                      onChange={e => setNewAddress({...newAddress, cidade: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Estado"
                      value={newAddress.estado}
                      onChange={e => setNewAddress({...newAddress, estado: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="CEP"
                      value={newAddress.cep}
                      onChange={e => setNewAddress({...newAddress, cep: e.target.value})}
                    />
                  </div>
                </div>
                <div className="add-address-actions">
                  <button className="btn btn-secondary" onClick={() => setShowAddAddress(false)}>
                    Cancelar
                  </button>
                  <button className="btn btn-success" onClick={addAddress}>
                    Adicionar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
