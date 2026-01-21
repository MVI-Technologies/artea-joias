import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Info } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './LotForm.css'

export default function LotForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = !!id
  
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('taxas')
  
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    status: 'aberto',
    // Taxas
    custo_separacao: 0,
    custo_operacional: 0,
    custo_motoboy: 0,
    custo_digitacao: 0,
    escritorio_pct: 0,
    percentual_entrada: 0,
    taxa_separacao_dinamica: ''
  })

  useEffect(() => {
    if (isEditing) {
      fetchLot()
    }
  }, [id])

  const fetchLot = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      setFormData({
        nome: data.nome || '',
        descricao: data.descricao || '',
        status: data.status || 'aberto',
        custo_separacao: data.custo_separacao || 0,
        custo_operacional: data.custo_operacional || 0,
        custo_motoboy: data.custo_motoboy || 0,
        custo_digitacao: data.custo_digitacao || 0,
        escritorio_pct: data.escritorio_pct || 0,
        percentual_entrada: data.percentual_entrada || 0,
        taxa_separacao_dinamica: data.taxa_separacao_dinamica || ''
      })
    } catch (error) {
      console.error('Erro ao carregar grupo:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.nome.trim()) {
      alert('Nome é obrigatório')
      return
    }

    setSaving(true)
    try {
      const dataToSave = {
        nome: formData.nome,
        descricao: formData.descricao,
        status: formData.status,
        // Os campos de taxas serão salvos após aplicar a migration
        // custo_separacao: formData.custo_separacao,
        // custo_operacional: formData.custo_operacional,
        // custo_motoboy: formData.custo_motoboy,
        // custo_digitacao: formData.custo_digitacao,
        // escritorio_pct: formData.escritorio_pct,
        // percentual_entrada: formData.percentual_entrada,
        // taxa_separacao_dinamica: formData.taxa_separacao_dinamica
      }

      if (isEditing) {
        const { error } = await supabase
          .from('lots')
          .update(dataToSave)
          .eq('id', id)
        if (error) throw error
      } else {
        dataToSave.link_compra = `grupo-${Date.now()}`
        const { error } = await supabase
          .from('lots')
          .insert(dataToSave)
        if (error) throw error
      }

      navigate('/admin/lotes')
    } catch (error) {
      console.error('Erro ao salvar:', error)
      alert('Erro ao salvar grupo de compras')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner" style={{ margin: '40px auto' }} />
      </div>
    )
  }

  return (
    <div className="page-container lot-form-page">
      {/* Header */}
      <div className="form-header">
        <button className="btn-back" onClick={() => navigate('/admin/lotes')}>
          <ArrowLeft size={18} />
        </button>
        <h1>{isEditing ? formData.nome || 'Editar Grupo' : 'Novo Grupo de Compras'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="lot-form">
        {/* Campos principais */}
        <div className="form-section">
          <div className="form-row">
            <div className="form-group flex-2">
              <label>Nome <span className="required">Obrigatório</span></label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => handleChange('nome', e.target.value)}
                placeholder="Nome do grupo"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Descrição <span className="optional">Opcional</span></label>
            <textarea
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder="Descrição do grupo (opcional)"
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                <option value="aberto">Aberto</option>
                <option value="pronto_aberto">Pronto e Aberto</option>
                <option value="fechado">Fechado</option>
                <option value="preparacao">Em preparação</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="form-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'taxas' ? 'active' : ''}`}
            onClick={() => setActiveTab('taxas')}
          >
            Taxas
          </button>
          <button
            type="button"
            className={`tab-btn-link ${activeTab === 'configuracoes' ? 'active' : ''}`}
            onClick={() => setActiveTab('configuracoes')}
          >
            Configurações
          </button>
        </div>

        {/* Tab Content: Taxas */}
        {activeTab === 'taxas' && (
          <div className="form-section taxas-section">
            <div className="taxas-grid">
              <div className="form-group">
                <label>Custo Separação <span className="optional">Opcional</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.custo_separacao}
                  onChange={(e) => handleChange('custo_separacao', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Custo Operacional <span className="optional">opcional, ($ por produto)</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.custo_operacional}
                  onChange={(e) => handleChange('custo_operacional', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Escritório <span className="optional">Opcional, (% s/ produtos)</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.escritorio_pct}
                  onChange={(e) => handleChange('escritorio_pct', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Custo Motoboy <span className="optional">Opcional</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.custo_motoboy}
                  onChange={(e) => handleChange('custo_motoboy', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Custo Digitação <span className="optional">Opcional</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.custo_digitacao}
                  onChange={(e) => handleChange('custo_digitacao', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Percentual Entrada <span className="optional">Opcional</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.percentual_entrada}
                  onChange={(e) => handleChange('percentual_entrada', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="form-group taxa-dinamica">
              <label>
                Taxa Separação Dinâmica 
                <Info size={14} className="info-icon" />
                <span className="optional">Opcional</span>
              </label>
              <textarea
                value={formData.taxa_separacao_dinamica}
                onChange={(e) => handleChange('taxa_separacao_dinamica', e.target.value)}
                placeholder="Descreva a regra de taxa dinâmica..."
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Tab Content: Configurações */}
        {activeTab === 'configuracoes' && (
          <div className="form-section">
            <p className="text-muted">Configurações adicionais em breve...</p>
          </div>
        )}

        {/* Botão Salvar */}
        <div className="form-actions">
          <button type="submit" className="btn btn-save" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
