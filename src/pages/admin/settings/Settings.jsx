import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, Building, Phone, MapPin, Globe, Download, X, Loader2, ContactRound, Plug, FileSpreadsheet, CreditCard, Truck } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/common/Toast'
import MercadoPagoService from '../../../services/integrations/mercadopago'
import CorreiosService from '../../../services/integrations/correios'
import PixService from '../../../services/integrations/pix'
import * as XLSX from 'xlsx'
import './Settings.css'

const tabs = [
  { id: 'contato', label: 'Contato', icon: ContactRound },
  { id: 'integracoes', label: 'Integrações', icon: Plug },
  { id: 'importacao', label: 'Importação', icon: FileSpreadsheet }
]

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

export default function Settings() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('contato')
  const [settings, setSettings] = useState({
    nome_empresa: 'ARTEA JOIAS',
    razao_social: '',
    cnpj_cpf: '',
    whatsapp: '',
    email: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    instagram: '',
    idioma: 'Português'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Import states
  const [importFile, setImportFile] = useState(null)
  const [photosLink, setPhotosLink] = useState('')
  const [importing, setImporting] = useState(false)
  
  // Logo/Icon upload states
  const [logoFile, setLogoFile] = useState(null)
  const [iconFile, setIconFile] = useState(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)

  // Integration modal states
  const [activeModal, setActiveModal] = useState(null)
  const [validatingIntegration, setValidatingIntegration] = useState(false)
  const [integrations, setIntegrations] = useState({
    pix: { configured: false, chave: '', nome_beneficiario: '', cidade: '' },
    mercadopago: { configured: false, public_key: '', access_token: '', pix: false, cartao: false, boleto: false, debito_virtual: false, loteria: false },
    correios: { configured: false, usuario: '', chave_acesso: '', contrato: '', unidade_gestora: '', cartao_postagem: '', nome_remetente: '', endereco: '', numero: '', complemento: '', cidade: '', bairro: '', estado: '', cep: '', tamanho_caixa: '6,12,17', tipo: '' }
  })

  useEffect(() => {
    fetchSettings()
    fetchIntegrations()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') throw error
      if (data) {
        setSettings(data)
        // Carregar URLs de logo e ícone se existirem
        if (data.logo_url) setLogoUrl(data.logo_url)
        if (data.icon_url) setIconUrl(data.icon_url)
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.includes('png')) {
      toast.error('Apenas arquivos PNG são aceitos')
      return
    }

    setUploadingLogo(true)
    try {
      const fileName = `logo_${Date.now()}.png`
      const { data, error } = await supabase.storage
        .from('company')
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('company')
        .getPublicUrl(fileName)

      const newLogoUrl = urlData.publicUrl
      setLogoUrl(newLogoUrl)
      setSettings(prev => ({ ...prev, logo_url: newLogoUrl }))
      toast.success('Logo enviado com sucesso!')
    } catch (error) {
      console.error('Erro ao enviar logo:', error)
      toast.error('Erro ao enviar logo: ' + error.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleIconUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.includes('png')) {
      toast.error('Apenas arquivos PNG são aceitos')
      return
    }

    setUploadingIcon(true)
    try {
      const fileName = `icon_${Date.now()}.png`
      const { data, error } = await supabase.storage
        .from('company')
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('company')
        .getPublicUrl(fileName)

      const newIconUrl = urlData.publicUrl
      setIconUrl(newIconUrl)
      setSettings(prev => ({ ...prev, icon_url: newIconUrl }))
      toast.success('Ícone enviado com sucesso!')
    } catch (error) {
      console.error('Erro ao enviar ícone:', error)
      toast.error('Erro ao enviar ícone: ' + error.message)
    } finally {
      setUploadingIcon(false)
    }
  }

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')

      if (error && error.code !== 'PGRST116') throw error
      if (data) {
        const integrationsMap = { ...integrations }
        data.forEach(item => {
          if (item.type === 'pix') {
            integrationsMap.pix = { configured: true, ...item.config }
          } else if (item.type === 'mercadopago') {
            integrationsMap.mercadopago = { configured: true, ...item.config }
          } else if (item.type === 'correios') {
            integrationsMap.correios = { configured: true, ...item.config }
          }
        })
        setIntegrations(integrationsMap)
      }
    } catch (error) {
      console.error('Erro ao carregar integrações:', error)
    }
  }

  const handleSaveIntegration = async (type) => {
    setValidatingIntegration(true)
    
    try {
      const config = { ...integrations[type] }
      delete config.configured

      // Validar credenciais antes de salvar
      if (type === 'mercadopago') {
        if (!config.access_token) {
          toast.error('Access Token é obrigatório')
          setValidatingIntegration(false)
          return
        }
        
        // Validar credenciais do Mercado Pago
        const mpService = new MercadoPagoService(config.access_token, config.public_key)
        const validation = await mpService.validateCredentials()
        
        if (!validation.valid) {
          toast.error('Credenciais do Mercado Pago inválidas. Verifique o Access Token.')
          setValidatingIntegration(false)
          return
        }
        
        toast.success(`Mercado Pago conectado! Usuário: ${validation.user?.email || validation.user?.nickname}`)
      }

      if (type === 'correios') {
        if (!config.usuario || !config.chave_acesso) {
          toast.error('Usuário e Chave de Acesso são obrigatórios')
          setValidatingIntegration(false)
          return
        }
        
        // Validar credenciais dos Correios
        const correiosService = new CorreiosService(config)
        const validation = await correiosService.validateCredentials()
        
        if (!validation.valid) {
          toast.error('Credenciais dos Correios inválidas. Verifique usuário e chave de acesso.')
          setValidatingIntegration(false)
          return
        }
      }

      if (type === 'pix') {
        if (!config.chave || !config.nome_beneficiario || !config.cidade) {
          toast.error('Chave, Nome do Beneficiário e Cidade são obrigatórios')
          setValidatingIntegration(false)
          return
        }
        
        // Validar configuração PIX
        const pixService = new PixService(config)
        const validation = pixService.validate()
        
        if (!validation.valid) {
          toast.error(validation.error)
          setValidatingIntegration(false)
          return
        }
      }

      // Salvar no banco
      const { data: existing } = await supabase
        .from('integrations')
        .select('id')
        .eq('type', type)
        .single()

      if (existing) {
        await supabase
          .from('integrations')
          .update({ config, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('integrations')
          .insert({ type, config })
      }

      setIntegrations(prev => ({
        ...prev,
        [type]: { ...prev[type], configured: true }
      }))
      setActiveModal(null)
      toast.success('Integração salva e validada com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar integração:', error)
      toast.error('Erro ao salvar integração: ' + error.message)
    } finally {
      setValidatingIntegration(false)
    }
  }

  const handleRemoveIntegration = async (type) => {
    if (!confirm('Tem certeza que deseja remover esta integração?')) return

    try {
      await supabase
        .from('integrations')
        .delete()
        .eq('type', type)

      const defaultValues = {
        pix: { configured: false, chave: '', nome_beneficiario: '', cidade: '' },
        mercadopago: { configured: false, public_key: '', access_token: '', pix: false, cartao: false, boleto: false, debito_virtual: false, loteria: false },
        correios: { configured: false, usuario: '', chave_acesso: '', contrato: '', unidade_gestora: '', cartao_postagem: '', nome_remetente: '', endereco: '', numero: '', complemento: '', cidade: '', bairro: '', estado: '', cep: '', tamanho_caixa: '6,12,17', tipo: '' }
      }

      setIntegrations(prev => ({
        ...prev,
        [type]: defaultValues[type]
      }))
      setActiveModal(null)
      toast.success('Integração removida com sucesso!')
    } catch (error) {
      console.error('Erro ao remover integração:', error)
      toast.error('Erro ao remover integração')
    }
  }

  const updateIntegration = (type, field, value) => {
    setIntegrations(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .single()

      if (existing) {
        const { error } = await supabase
          .from('company_settings')
          .update(settings)
          .eq('id', existing.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert(settings)

        if (error) throw error
      }

      toast.success('Configurações salvas com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar configurações:', error)
      toast.error('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadTemplate = () => {
    // Criar template com as abas necessárias
    const workbook = XLSX.utils.book_new()
    
    // Aba Produtos - colunas conforme banco de dados
    const produtosData = [
      { 
        'Código SKU': 'PROD001', 
        'Nome': 'Anel Solitário Ouro', 
        'Descrição': 'Anel solitário banhado a ouro 18k', 
        'Custo': 75.00, 
        'Margem %': 100,
        'Peso (gramas)': 5,
        'Quantidade Mínima': 1
      }
    ]
    const produtosSheet = XLSX.utils.json_to_sheet(produtosData)
    XLSX.utils.book_append_sheet(workbook, produtosSheet, 'Produtos')
    
    // Aba Clientes - colunas conforme banco de dados
    const clientesData = [
      { 
        'Nome': 'Maria Silva', 
        'Telefone': '11999999999', 
        'Email': 'maria@email.com', 
        'Aniversário': '15/03/1990',
        'Endereço': 'Rua das Flores',
        'Número': '123',
        'Bairro': 'Centro',
        'Cidade': 'São Paulo',
        'Estado': 'SP',
        'CEP': '01234567'
      }
    ]
    const clientesSheet = XLSX.utils.json_to_sheet(clientesData)
    XLSX.utils.book_append_sheet(workbook, clientesSheet, 'Clientes')
    
    XLSX.writeFile(workbook, 'modelo_importacao.xlsx')
  }

  const handleImportFile = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImportFile(file)
    }
  }

  const handleImportSave = async () => {
    if (!importFile) {
      toast.error('Selecione um arquivo XLSX para importar')
      return
    }

    setImporting(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          
          let totalImported = 0
          let errors = []
          
          // Importar Produtos se existir a aba
          if (workbook.SheetNames.includes('Produtos')) {
            const produtosSheet = workbook.Sheets['Produtos']
            const produtos = XLSX.utils.sheet_to_json(produtosSheet)
            
            for (let i = 0; i < produtos.length; i++) {
              const produto = produtos[i]
              const nome = produto['Nome'] || produto['nome'] || produto['NOME']
              const custo = parseFloat(produto['Custo'] || produto['custo'] || produto['CUSTO'] || 0)
              
              if (!nome) {
                errors.push(`Produto linha ${i + 2}: Nome obrigatório`)
                continue
              }
              if (!custo || custo <= 0) {
                errors.push(`Produto linha ${i + 2}: Custo deve ser maior que 0`)
                continue
              }

              const productData = {
                nome,
                descricao: produto['Descrição'] || produto['descricao'] || '',
                custo,
                margem_pct: parseFloat(produto['Margem %'] || produto['margem'] || 100),
                codigo_sku: produto['Código SKU'] || produto['SKU'] || produto['sku'] || null,
                peso_gramas: parseFloat(produto['Peso (gramas)'] || produto['peso'] || 0) || null,
                quantidade_minima: parseInt(produto['Quantidade Mínima'] || produto['qtd_minima'] || 1),
                ativo: true
              }

              const { error } = await supabase.from('products').upsert(
                productData, 
                { onConflict: 'codigo_sku', ignoreDuplicates: false }
              )
              
              if (error) {
                // Se erro de conflito, tentar insert normal
                const { error: insertError } = await supabase.from('products').insert(productData)
                if (!insertError) totalImported++
                else errors.push(`Produto "${nome}": ${insertError.message}`)
              } else {
                totalImported++
              }
            }
          }
          
          // Importar Clientes se existir a aba
          if (workbook.SheetNames.includes('Clientes')) {
            const clientesSheet = workbook.Sheets['Clientes']
            const clientes = XLSX.utils.sheet_to_json(clientesSheet)
            
            for (let i = 0; i < clientes.length; i++) {
              const cliente = clientes[i]
              const nome = cliente['Nome'] || cliente['nome'] || cliente['NOME']
              const telefone = String(cliente['Telefone'] || cliente['telefone'] || cliente['TELEFONE'] || '').replace(/\D/g, '')
              
              if (!nome) {
                errors.push(`Cliente linha ${i + 2}: Nome obrigatório`)
                continue
              }
              if (!telefone) {
                errors.push(`Cliente linha ${i + 2}: Telefone obrigatório`)
                continue
              }

              // Montar endereço no formato JSONB
              const endereco = {
                logradouro: cliente['Endereço'] || cliente['endereco'] || '',
                numero: cliente['Número'] || cliente['numero'] || '',
                bairro: cliente['Bairro'] || cliente['bairro'] || '',
                cidade: cliente['Cidade'] || cliente['cidade'] || '',
                estado: cliente['Estado'] || cliente['estado'] || '',
                cep: String(cliente['CEP'] || cliente['cep'] || '').replace(/\D/g, '')
              }

              // Parsear data de aniversário
              let aniversario = null
              const aniInput = cliente['Aniversário'] || cliente['aniversario'] || cliente['Data Nascimento']
              if (aniInput) {
                if (typeof aniInput === 'number') {
                  // Serial date do Excel
                  const date = new Date((aniInput - 25569) * 86400 * 1000)
                  aniversario = date.toISOString().split('T')[0]
                } else if (typeof aniInput === 'string') {
                  const parts = aniInput.split('/')
                  if (parts.length === 3) {
                    aniversario = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
                  }
                }
              }

              const clientData = {
                nome,
                telefone,
                email: cliente['Email'] || cliente['email'] || null,
                aniversario,
                enderecos: endereco.logradouro ? [endereco] : [],
                approved: true,
                cadastro_status: 'completo',
                grupo: 'Grupo Compras'
              }

              const { error } = await supabase.from('clients').upsert(
                clientData, 
                { onConflict: 'telefone' }
              )
              
              if (error) {
                errors.push(`Cliente "${nome}": ${error.message}`)
              } else {
                totalImported++
              }
            }
          }
          
          // Mostrar resultado
          if (totalImported > 0) {
            toast.success(`Importação concluída! ${totalImported} registros importados.`)
          }
          if (errors.length > 0) {
            console.error('Erros na importação:', errors)
            toast.error(`${errors.length} erro(s) durante importação. Verifique o console.`)
          }
          if (totalImported === 0 && errors.length === 0) {
            toast.error('Nenhum dado encontrado para importar. Verifique as abas do arquivo.')
          }
          
          setImportFile(null)
        } catch (err) {
          console.error('Erro ao processar arquivo:', err)
          toast.error('Erro ao processar arquivo: ' + err.message)
        }
        setImporting(false)
      }
      reader.readAsArrayBuffer(importFile)
    } catch (error) {
      console.error('Erro na importação:', error)
      toast.error('Erro na importação: ' + error.message)
      setImporting(false)
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'contato':
        return (
          <div className="settings-form">

            {/* Nome e CNPJ */}
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Nome da Empresa</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.nome_empresa}
                  onChange={e => setSettings({...settings, nome_empresa: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">CNPJ/CPF</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.cnpj_cpf}
                  onChange={e => setSettings({...settings, cnpj_cpf: e.target.value})}
                />
              </div>
            </div>

            {/* Razão Social */}
            <div className="form-group full-width">
              <label className="form-label">Razão Social</label>
              <input
                type="text"
                className="form-input"
                value={settings.razao_social}
                onChange={e => setSettings({...settings, razao_social: e.target.value})}
              />
            </div>

            {/* WhatsApp e E-mail */}
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">WhatsApp</label>
                <input
                  type="tel"
                  className="form-input"
                  value={settings.whatsapp}
                  onChange={e => setSettings({...settings, whatsapp: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input
                  type="email"
                  className="form-input"
                  value={settings.email}
                  onChange={e => setSettings({...settings, email: e.target.value})}
                />
              </div>
            </div>

            {/* Endereço - 4 colunas */}
            <div className="form-row-4">
              <div className="form-group">
                <label className="form-label">Endereço <span className="text-optional">Opcional</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.endereco}
                  onChange={e => setSettings({...settings, endereco: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Número <span className="text-optional">Opcional</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.numero}
                  onChange={e => setSettings({...settings, numero: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Complemento <span className="text-optional">Opcional</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.complemento}
                  onChange={e => setSettings({...settings, complemento: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Bairro <span className="text-optional">Opcional</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.bairro}
                  onChange={e => setSettings({...settings, bairro: e.target.value})}
                />
              </div>
            </div>

            {/* Cidade, Estado, CEP */}
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Cidade <span className="text-optional">Opcional</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.cidade}
                  onChange={e => setSettings({...settings, cidade: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Estado <span className="text-optional">Opcional</span></label>
                <select
                  className="form-select"
                  value={settings.estado}
                  onChange={e => setSettings({...settings, estado: e.target.value})}
                >
                  <option value="">Selecione...</option>
                  {ESTADOS_BRASIL.map(uf => (
                    <option key={uf} value={uf}>{uf === 'SP' ? 'São Paulo' : uf === 'RJ' ? 'Rio de Janeiro' : uf === 'MG' ? 'Minas Gerais' : uf === 'PR' ? 'Paraná' : uf === 'RS' ? 'Rio Grande do Sul' : uf === 'SC' ? 'Santa Catarina' : uf === 'BA' ? 'Bahia' : uf === 'GO' ? 'Goiás' : uf === 'PE' ? 'Pernambuco' : uf === 'CE' ? 'Ceará' : uf}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">CEP <span className="text-optional">Opcional</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.cep}
                  onChange={e => setSettings({...settings, cep: e.target.value})}
                />
              </div>
            </div>

            {/* Instagram e Idioma */}
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Instagram</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.instagram}
                  onChange={e => setSettings({...settings, instagram: e.target.value})}
                  placeholder="@usuario"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Idioma Oficial</label>
                <select
                  className="form-select"
                  value={settings.idioma}
                  onChange={e => setSettings({...settings, idioma: e.target.value})}
                >
                  <option value="Português">Português</option>
                  <option value="Espanhol">Espanhol</option>
                  <option value="English">English</option>
                </select>
              </div>
            </div>

            {/* Logo e Ícone */}
            <div className="form-row-2 mt-lg">
              <div className="form-group">
                <label className="form-label">Logo <span className="text-highlight">PNG</span></label>
                <div className="file-upload-with-preview">
                  <div className="file-upload-inline">
                    <label className="file-upload-btn">
                      <input 
                        type="file" 
                        accept=".png,image/png" 
                        hidden 
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                      />
                      <span className="btn btn-outline-sm">
                        {uploadingLogo ? 'Enviando...' : 'Escolher ficheiro'}
                      </span>
                    </label>
                    <span className="text-muted">
                      {logoUrl ? 'Logo configurado' : 'Nenhum ficheiro selecionado'}
                    </span>
                  </div>
                  {logoUrl && (
                    <div className="image-preview">
                      <img src={logoUrl} alt="Logo" />
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Ícone Web App <span className="text-highlight">PNG, Imagem quadrada</span></label>
                <div className="file-upload-with-preview">
                  <div className="file-upload-inline">
                    <label className="file-upload-btn">
                      <input 
                        type="file" 
                        accept=".png,image/png" 
                        hidden 
                        onChange={handleIconUpload}
                        disabled={uploadingIcon}
                      />
                      <span className="btn btn-outline-sm">
                        {uploadingIcon ? 'Enviando...' : 'Escolher ficheiro'}
                      </span>
                    </label>
                    <span className="text-muted">
                      {iconUrl ? 'Ícone configurado' : 'Nenhum ficheiro selecionado'}
                    </span>
                  </div>
                  {iconUrl && (
                    <div className="image-preview icon-preview">
                      <img src={iconUrl} alt="Ícone" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="settings-actions">
              <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
                <Save size={18} />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        )

      case 'integracoes':
        return (
          <div className="settings-form">
            <div className="integration-section">
              <h3 className="section-header">
                <CreditCard size={20} />
                <span>Pagamento</span>
              </h3>
              <div className="integration-list">
                <div 
                  className={`integration-item clickable ${integrations.pix.configured ? 'highlight' : ''}`}
                  onClick={() => setActiveModal('pix')}
                >
                  <div className="integration-info">
                    <span className="integration-name">PIX</span>
                    <span className="integration-desc">Pagamento instantâneo</span>
                  </div>
                  <span className={`badge ${integrations.pix.configured ? 'badge-success' : 'badge-secondary'}`}>
                    {integrations.pix.configured ? 'Configurado' : 'Não configurado'}
                  </span>
                </div>
                <div 
                  className={`integration-item clickable ${integrations.mercadopago.configured ? 'highlight' : ''}`}
                  onClick={() => setActiveModal('mercadopago')}
                >
                  <div className="integration-info">
                    <span className="integration-name">Mercado Pago</span>
                    <span className="integration-desc">Múltiplas formas de pagamento</span>
                  </div>
                  <span className={`badge ${integrations.mercadopago.configured ? 'badge-success' : 'badge-secondary'}`}>
                    {integrations.mercadopago.configured ? 'Configurado' : 'Não configurado'}
                  </span>
                </div>
              </div>
            </div>

            <div className="integration-section">
              <h3 className="section-header">
                <Truck size={20} />
                <span>Entrega</span>
              </h3>
              <div className="integration-list">
                <div 
                  className={`integration-item clickable ${integrations.correios.configured ? 'highlight' : ''}`}
                  onClick={() => setActiveModal('correios')}
                >
                  <div className="integration-info">
                    <span className="integration-name">Correios</span>
                    <span className="integration-desc">Cálculo de frete e etiquetas</span>
                  </div>
                  <span className={`badge ${integrations.correios.configured ? 'badge-success' : 'badge-secondary'}`}>
                    {integrations.correios.configured ? 'Configurado' : 'Não configurado'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )

      case 'importacao':
        return (
          <div className="settings-form">
            <p className="text-muted mb-lg">
              Preste muita atenção no modelo de preenchimento do arquivo de modelo. 
              NÃO remova nenhuma aba ou altere a ordem delas.
            </p>

            <ul className="mb-lg">
              <li>
                <a href="#" onClick={(e) => { e.preventDefault(); handleDownloadTemplate(); }} className="link-primary">
                  Baixar Modelo
                </a>
              </li>
            </ul>

            <div className="form-group mb-lg">
              <label className="form-label">Dados para serem importados XLSX</label>
              <div className="file-upload-box">
                <label className="file-upload-label">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportFile}
                    hidden
                  />
                  <span className="btn btn-outline">Escolher ficheiro</span>
                  <span className="text-muted ml-sm">
                    {importFile ? importFile.name : 'Nenhum ficheiro selecionado'}
                  </span>
                </label>
              </div>
            </div>

            <div className="import-instructions mb-lg">
              <p className="mb-md">Para importar as suas fotos o processo é bem simples:</p>
              <ol className="instructions-list">
                <li>O nome de cada arquivo precisa ser igual ao SKU ou ao Código de Barras do respectivos produto já importado</li>
                <li>Formato de cada arquivo JPG ou PNG</li>
                <li>Faça um arquivo .zip com todas as fotos desejadas</li>
                <li>Suba o arquivo .zip no site <a href="https://filebin.net/" target="_blank" rel="noopener noreferrer">https://filebin.net/</a></li>
                <li>Após o upload, copie o link do arquivo. Atenção! O final do link terminará em .ZIP: https://filebin.net/6ihwl2p347ennig1/Archive.zip</li>
              </ol>
            </div>

            <div className="form-group mb-lg">
              <label className="form-label">Link das fotos</label>
              <input
                type="url"
                className="form-input"
                value={photosLink}
                onChange={e => setPhotosLink(e.target.value)}
                placeholder="https://"
              />
            </div>

            <div className="settings-actions">
              <button 
                className="btn btn-primary btn-lg" 
                onClick={handleImportSave} 
                disabled={importing}
              >
                <Save size={18} />
                {importing ? 'Importando...' : 'Importar Dados'}
              </button>
            </div>
          </div>
        )

      default:
        return (
          <div className="settings-form">
            <p className="text-muted text-center">
              Conteúdo da aba "{activeTab}" em desenvolvimento.
            </p>
          </div>
        )
    }
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1><SettingsIcon size={24} /> Configurações</h1>
      </div>

      <div className="card settings-card">
        {/* Tabs */}
        <div className="tabs" data-active={activeTab}>
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="card-body">
          {loading ? (
            <div className="text-center p-lg">
              <div className="loading-spinner" style={{ width: 40, height: 40 }} />
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
      </div>

      {/* Modal PIX */}
      {activeModal === 'pix' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>PIX</h2>
              <button className="modal-close" onClick={() => setActiveModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Chave</label>
                <input
                  type="text"
                  className="form-input"
                  value={integrations.pix.chave}
                  onChange={e => updateIntegration('pix', 'chave', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nome do Beneficiário</label>
                <input
                  type="text"
                  className="form-input"
                  value={integrations.pix.nome_beneficiario}
                  onChange={e => updateIntegration('pix', 'nome_beneficiario', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Cidade</label>
                <input
                  type="text"
                  className="form-input"
                  value={integrations.pix.cidade}
                  onChange={e => updateIntegration('pix', 'cidade', e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-primary btn-block" 
                onClick={() => handleSaveIntegration('pix')}
                disabled={validatingIntegration}
              >
                {validatingIntegration ? (
                  <>
                    <Loader2 size={16} className="spin" /> Validando...
                  </>
                ) : 'Salvar'}
              </button>
              {integrations.pix.configured && (
                <button className="btn btn-outline-danger mt-sm" onClick={() => handleRemoveIntegration('pix')}>
                  Remover Integração
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Mercado Pago */}
      {activeModal === 'mercadopago' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Mercado Pago</h2>
              <button className="modal-close" onClick={() => setActiveModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-muted mb-sm">
                Para configurar a integração com o Mercado Pago é simples, basta seguir os passos abaixo:
              </p>
              <p className="mb-md">
                <a href="https://www.mercadopago.com.br/business" target="_blank" rel="noopener noreferrer" className="link-primary">
                  https://www.mercadopago.com.br/business
                </a>
              </p>
              <ol className="instructions-list mb-lg">
                <li>No menu esquerdo clique em Seu Negócio &gt; Configurações &gt; Integrações &gt; Credenciais : + Criar Aplicação</li>
                <li>Nome da Aplicação: <strong>Dynamic PRO - arteajoias</strong></li>
                <li>Qual tipo de solução de pagamento você vai integrar? <strong>Pagamento Online</strong></li>
                <li>Você está usando uma plataforma de e-commerce? <strong>Não</strong></li>
                <li>Qual produto você está integrando? <strong>Checkout Pro</strong></li>
                <li>Modelo de integração: <strong>Marketplace</strong></li>
                <li>Marque a opção "Eu autorizo o uso do..." e confirme que não é um robô</li>
                <li>Depois clique em <strong>Ativar Credenciais</strong></li>
                <li>Setor: <strong>Vestuário, calçados e acessórios</strong></li>
                <li>Site: Colocar o link do catálogo: <strong>https://arteajoias.semijoias.net/</strong></li>
                <li><strong>Ativar Credenciais de Produção</strong></li>
                <li>Copie a Public Key e a Access Token nos campos abaixo</li>
              </ol>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Public Key</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="APP_USR-..."
                    value={integrations.mercadopago.public_key}
                    onChange={e => updateIntegration('mercadopago', 'public_key', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Access Token</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="APP_USR-..."
                    value={integrations.mercadopago.access_token}
                    onChange={e => updateIntegration('mercadopago', 'access_token', e.target.value)}
                  />
                </div>
              </div>

              <div className="section-divider">
                <label className="form-label mb-sm">Opções de pagamento para o consumidor</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={integrations.mercadopago.pix}
                      onChange={e => updateIntegration('mercadopago', 'pix', e.target.checked)}
                    />
                    <span>PIX</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={integrations.mercadopago.cartao}
                      onChange={e => updateIntegration('mercadopago', 'cartao', e.target.checked)}
                    />
                    <span>Cartão de Crédito/Débito</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={integrations.mercadopago.boleto}
                      onChange={e => updateIntegration('mercadopago', 'boleto', e.target.checked)}
                    />
                    <span>Boleto</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={integrations.mercadopago.debito_virtual}
                      onChange={e => updateIntegration('mercadopago', 'debito_virtual', e.target.checked)}
                    />
                    <span>Cartão de Débito Virtual Caixa</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={integrations.mercadopago.loteria}
                      onChange={e => updateIntegration('mercadopago', 'loteria', e.target.checked)}
                    />
                    <span>Pagamento na Lotérica</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-primary btn-block" 
                onClick={() => handleSaveIntegration('mercadopago')}
                disabled={validatingIntegration}
              >
                {validatingIntegration ? (
                  <>
                    <Loader2 size={16} className="spin" /> Validando credenciais...
                  </>
                ) : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Correios */}
      {activeModal === 'correios' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Correios</h2>
              <button className="modal-close" onClick={() => setActiveModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="mb-sm">
                <strong>Para mais informações aqui no link:</strong><br />
                <a href="https://cws.correios.com.br/" target="_blank" rel="noopener noreferrer" className="link-primary">
                  https://cws.correios.com.br/
                </a>
              </p>
              <p className="text-muted mb-lg">
                As informações Contrato, Unidade Gestora e Cartão Postagem podem ser obtidas na área logada da sua empresa no site dos Correios. O seu gerente de conta dos Correios também poderá te ajudar.
              </p>

              <div className="section-title">Credenciais de Acesso</div>
              <div className="form-grid-2 mb-md">
                <div className="form-group">
                  <label className="form-label">Usuário</label>
                  <input
                    type="text"
                    className="form-input"
                    value={integrations.correios.usuario}
                    onChange={e => updateIntegration('correios', 'usuario', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Chave Acesso (Token)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={integrations.correios.chave_acesso}
                    onChange={e => updateIntegration('correios', 'chave_acesso', e.target.value)}
                  />
                </div>
              </div>
              
              <div className="form-grid-2 mb-md">
                <div className="form-group">
                  <label className="form-label">Contrato</label>
                  <input
                    type="text"
                    className="form-input"
                    value={integrations.correios.contrato}
                    onChange={e => updateIntegration('correios', 'contrato', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unidade Gestora</label>
                  <input
                    type="text"
                    className="form-input"
                    value={integrations.correios.unidade_gestora}
                    onChange={e => updateIntegration('correios', 'unidade_gestora', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group mb-md">
                <label className="form-label">Cartão Postagem</label>
                <input
                  type="text"
                  className="form-input"
                  value={integrations.correios.cartao_postagem}
                  onChange={e => updateIntegration('correios', 'cartao_postagem', e.target.value)}
                />
              </div>

              <div className="section-divider">
                <div className="section-title">Dados do Remetente</div>
              </div>

              <div className="form-group mb-md">
                <label className="form-label">Nome do Remetente</label>
                <input
                  type="text"
                  className="form-input"
                  value={integrations.correios.nome_remetente}
                  onChange={e => updateIntegration('correios', 'nome_remetente', e.target.value)}
                />
              </div>

              <div className="form-grid-2 mb-md">
                <div className="form-group">
                  <label className="form-label">Endereço</label>
                  <input
                    type="text"
                    className="form-input"
                    value={integrations.correios.endereco}
                    onChange={e => updateIntegration('correios', 'endereco', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Número</label>
                  <input
                    type="text"
                    className="form-input"
                    value={integrations.correios.numero}
                    onChange={e => updateIntegration('correios', 'numero', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2 mb-md">
                <div className="form-group">
                  <label className="form-label">Complemento <span className="text-optional">Opcional</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={integrations.correios.complemento}
                    onChange={e => updateIntegration('correios', 'complemento', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bairro</label>
                  <input
                    type="text"
                    className="form-input"
                    value={integrations.correios.bairro}
                    onChange={e => updateIntegration('correios', 'bairro', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2 mb-md">
                <div className="form-group">
                  <label className="form-label">Cidade</label>
                  <input
                    type="text"
                    className="form-input"
                    value={integrations.correios.cidade}
                    onChange={e => updateIntegration('correios', 'cidade', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={integrations.correios.estado}
                    onChange={e => updateIntegration('correios', 'estado', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {ESTADOS_BRASIL.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group mb-md">
                <label className="form-label">CEP</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="00000-000"
                  value={integrations.correios.cep}
                  onChange={e => updateIntegration('correios', 'cep', e.target.value)}
                />
              </div>

              <div className="section-divider">
                <div className="section-title">Configurações de Envio</div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Tamanho Caixa (cm)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={integrations.correios.tamanho_caixa}
                    onChange={e => updateIntegration('correios', 'tamanho_caixa', e.target.value)}
                    placeholder="Altura, Largura, Comprimento"
                  />
                  <small className="text-muted">Ex: 6,12,17</small>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de Serviço</label>
                  <select
                    className="form-select"
                    value={integrations.correios.tipo}
                    onChange={e => updateIntegration('correios', 'tipo', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    <option value="pac">PAC</option>
                    <option value="sedex">SEDEX</option>
                    <option value="pac_sedex">PAC e SEDEX</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-primary btn-block" 
                onClick={() => handleSaveIntegration('correios')}
                disabled={validatingIntegration}
              >
                {validatingIntegration ? (
                  <>
                    <Loader2 size={16} className="spin" /> Validando credenciais...
                  </>
                ) : 'Salvar'}
              </button>
              {integrations.correios.configured && (
                <button className="btn btn-outline-danger btn-block mt-sm" onClick={() => handleRemoveIntegration('correios')}>
                  Remover Integração
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
