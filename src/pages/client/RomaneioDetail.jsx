import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Download, 
  Copy, 
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  Package,
  Upload
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import './RomaneioDetail.css'

export default function RomaneioDetail() {
  const { romaneioId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [romaneio, setRomaneio] = useState(null)
  const [products, setProducts] = useState([])
  const [lot, setLot] = useState(null)
  const [pixConfig, setPixConfig] = useState(null) // Centralized payment config
  const [loading, setLoading] = useState(true)
  const [copiedPix, setCopiedPix] = useState(false)
  const [uploadingProof, setUploadingProof] = useState(false)

  useEffect(() => {
    if (romaneioId) loadRomaneio()
  }, [romaneioId])

  const loadRomaneio = async () => {
    try {
      // 1. Buscar configuração de pagamento CENTRALIZADA (integrations)
      const { data: pixIntegration } = await supabase
        .from('integrations')
        .select('config')
        .eq('type', 'pix')
        .single()
      
      if (pixIntegration?.config) {
        setPixConfig(pixIntegration.config)
      }

      // 2. Buscar romaneio detalhado (SEM dados de pagamento - vem de integrations)
      const { data: romData, error: romError } = await supabase
        .from('romaneios')
        .select(`
          *,
          client:clients(id, nome, telefone, email, enderecos),
          lot:lots(id, nome, prazo_pagamento_horas)
        `)
        .eq('id', romaneioId)
        .single()

      if (romError) throw romError
      setRomaneio(romData)
      setLot(romData.lot)

      // 3. Buscar produtos do romaneio
      const { data: itemsData, error: itemsError } = await supabase
        .from('romaneio_items')
        .select(`
          *,
          product:products(id, nome, codigo_sku, imagem1, preco)
        `)
        .eq('romaneio_id', romaneioId)

      if (itemsError) throw itemsError
      setProducts(itemsData || [])

    } catch (error) {
      console.error('Erro ao carregar romaneio:', error)
      alert('Erro ao carregar romaneio. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusInfo = (status) => {
    const statusMap = {
      'aguardando': { 
        label: 'Aguardando Pagamento', 
        class: 'status-warning', 
        icon: Clock,
        description: 'Realize o pagamento para confirmar seu pedido'
      },
      'aguardando_pagamento': { 
        label: 'Aguardando Pagamento', 
        class: 'status-warning', 
        icon: Clock,
        description: 'Realize o pagamento para confirmar seu pedido'
      },
      'pago': { 
        label: 'Pagamento Confirmado', 
        class: 'status-success', 
        icon: CheckCircle,
        description: 'Seu pagamento foi confirmado!'
      },
      'pendente': { 
        label: 'Pendente', 
        class: 'status-secondary', 
        icon: AlertCircle,
        description: 'Aguardando processamento'
      },
      'cancelado': { 
        label: 'Cancelado', 
        class: 'status-error', 
        icon: AlertCircle,
        description: 'Este pedido foi cancelado'
      }
    }
    return statusMap[status] || statusMap.pendente
  }

  const copyPixKey = () => {
    // Usar configuração centralizada de PIX
    const pixKey = pixConfig?.chave
    if (pixKey) {
      navigator.clipboard.writeText(pixKey)
      setCopiedPix(true)
      setTimeout(() => setCopiedPix(false), 2000)
    }
  }

  const generatePixQRCodeValue = () => {
    // Usar configuração centralizada de PIX
    const pixKey = pixConfig?.chave || ''
    const beneficiary = pixConfig?.nome_beneficiario || ''
    const amount = romaneio?.valor_total || 0
    
    // This is a simplified version. For production, implement full PIX BR Code spec
    return `PIX|${pixKey}|${beneficiary}|${amount.toFixed(2)}`
  }

  const handleUploadProof = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingProof(true)
    try {
      // Upload comprovante
      const fileExt = file.name.split('.').pop()
      const fileName = `${romaneioId}_${Date.now()}.${fileExt}`
      const filePath = `comprovantes/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('romaneios')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('romaneios')
        .getPublicUrl(filePath)

      // Update romaneio
      const { error: updateError } = await supabase
        .from('romaneios')
        .update({ 
          comprovante_url: urlData.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', romaneioId)

      if (updateError) throw updateError

      alert('Comprovante enviado com sucesso! Aguarde a confirmação.')
      loadRomaneio()
    } catch (error) {
      console.error('Erro ao enviar comprovante:', error)
      alert('Erro ao enviar comprovante. Tente novamente.')
    } finally {
      setUploadingProof(false)
    }
  }

  const downloadPDF = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-romaneio-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ romaneioId })
        }
      )

      if (!response.ok) throw new Error('Erro ao gerar PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Romaneio-${romaneio.numero_romaneio}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Erro ao baixar PDF:', error)
      alert('Erro ao baixar PDF. Tente novamente.')
    }
  }

  const calculateDeadline = () => {
    if (!romaneio?.created_at) return null
    const prazo = lot?.prazo_pagamento_horas || 48
    const deadline = new Date(romaneio.created_at)
    deadline.setHours(deadline.getHours() + prazo)
    return deadline
  }

  const isPaymentExpired = () => {
    const deadline = calculateDeadline()
    if (!deadline || romaneio?.status_pagamento === 'pago') return false
    return new Date() > deadline
  }

  if (loading) {
    return (
      <div className="client-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Carregando romaneio...</p>
        </div>
      </div>
    )
  }

  if (!romaneio) {
    return (
      <div className="client-page">
        <div className="error-container">
          <AlertCircle size={48} />
          <h2>Romaneio não encontrado</h2>
          <button onClick={() => navigate('/app/historico')} className="btn btn-primary">
            Voltar para Histórico
          </button>
        </div>
      </div>
    )
  }

  const statusInfo = getStatusInfo(romaneio.status_pagamento)
  const StatusIcon = statusInfo.icon
  const deadline = calculateDeadline()
  const expired = isPaymentExpired()

  return (
    <div className="client-page romaneio-detail-page">
      {/* Header */}
      <div className="page-header">
        <button onClick={() => navigate('/app/historico')} className="btn-back">
          <ArrowLeft size={20} />
          Voltar
        </button>
        <div className="header-title">
          <h1>Romaneio #{romaneio.numero_romaneio || romaneio.numero_pedido}</h1>
          <p className="subtitle">{lot?.nome}</p>
        </div>
        <button onClick={downloadPDF} className="btn btn-outline">
          <Download size={18} />
          Baixar PDF
        </button>
      </div>

      {/* Status Badge */}
      <div className={`status-banner ${statusInfo.class}`}>
        <StatusIcon size={24} />
        <div>
          <h3>{statusInfo.label}</h3>
          <p>{statusInfo.description}</p>
        </div>
      </div>

      <div className="romaneio-content">
        {/* Payment Section - CENTRALIZED CONFIG */}
        {romaneio.status_pagamento !== 'pago' && !expired && (
          <div className="payment-section card">
            <h2>💳 Pagamento</h2>
            
            {/* PIX Payment - Usando config centralizada */}
            {pixConfig?.chave && (
              <div className="payment-method pix">
                <h3>Pix</h3>
                <div className="pix-details">
                  <div className="qr-code-container">
                    <QRCodeSVG 
                      value={generatePixQRCodeValue()}
                      size={200}
                      level="H"
                    />
                  </div>
                  <div className="pix-info">
                    <div className="info-item">
                      <span className="label">Chave PIX:</span>
                      <div className="pix-key-copy">
                        <code>{pixConfig.chave}</code>
                        <button onClick={copyPixKey} className="btn-copy">
                          {copiedPix ? <CheckCircle size={16} /> : <Copy size={16} />}
                          {copiedPix ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                    <div className="info-item">
                      <span className="label">Beneficiário:</span>
                      <span>{pixConfig.nome_beneficiario}</span>
                    </div>
                    {pixConfig.cidade && (
                      <div className="info-item">
                        <span className="label">Cidade:</span>
                        <span>{pixConfig.cidade}</span>
                      </div>
                    )}
                    <div className="info-item valor-destaque">
                      <span className="label">Valor Total:</span>
                      <span className="valor">R$ {romaneio.valor_total?.toFixed(2)}</span>
                    </div>
                    {deadline && (
                      <div className="info-item prazo">
                        <Clock size={16} />
                        <span>Pagar até: {deadline.toLocaleString('pt-BR')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mensagem se PIX não configurado */}
            {!pixConfig?.chave && (
              <div className="payment-method-notice">
                <AlertCircle size={20} />
                <p>Método de pagamento não configurado. Entre em contato com o administrador.</p>
              </div>
            )}

            {/* Upload Comprovante */}
            <div className="upload-proof">
              <h4>Já realizou o pagamento?</h4>
              <p>Envie o comprovante para agilizar a confirmação</p>
             <label className="btn btn-outline btn-upload">
                <Upload size={18} />
                {uploadingProof ? 'Enviando...' : 'Enviar Comprovante'}
                <input 
                  type="file" 
                  accept="image/*,.pdf" 
                  onChange={handleUploadProof}
                  disabled={uploadingProof}
                  style={{ display: 'none' }}
                />
              </label>
              {romaneio.comprovante_url && (
                <div className="proof-uploaded">
                  <CheckCircle size={16} />
                  <span>Comprovante enviado! Aguarde a confirmação.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {expired && romaneio.status_pagamento !== 'pago' && (
          <div className="alert alert-error">
            <AlertCircle size={20} />
            <div>
              <strong>Prazo de pagamento expirado</strong>
              <p>Entre em contato para renovar este pedido.</p>
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="order-summary card">
          <h2><Package size={20} /> Resumo do Pedido</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <span>Pedido:</span>
              <strong>{romaneio.numero_pedido || romaneio.numero_romaneio}</strong>
            </div>
            <div className="summary-item">
              <span>Data:</span>
              <strong>{new Date(romaneio.created_at).toLocaleDateString('pt-BR')}</strong>
            </div>
            <div className="summary-item">
              <span>Itens:</span>
              <strong>{romaneio.quantidade_itens}</strong>
            </div>
          </div>
        </div>

        {/* Products List */}
        <div className="products-list card">
          <h2>Produtos</h2>
          {products.map((order) => (
            <div key={order.id} className="product-item">
              {order.product?.imagem1 && (
                <img src={order.product.imagem1} alt={order.product.nome} className="product-img" />
              )}
              <div className="product-info">
                <h4>{order.product?.nome}</h4>
                <p className="sku">{order.product?.codigo_sku}</p>
                <p className="quantity">Quantidade: {order.quantidade}</p>
              </div>
              <div className="product-price">
                <span className="unit-price">R$ {order.valor_unitario?.toFixed(2)}</span>
                <strong className="total-price">R$ {order.valor_total?.toFixed(2)}</strong>
              </div>
            </div>
          ))}
        </div>

        {/* Financial Breakdown */}
        <div className="financial-breakdown card">
          <h2>Detalhamento Financeiro</h2>
          <div className="breakdown-items">
            <div className="breakdown-item">
              <span>Subtotal (Produtos):</span>
              <span>R$ {romaneio.valor_produtos?.toFixed(2)}</span>
            </div>
            {romaneio.taxa_separacao > 0 && (
              <div className="breakdown-item">
                <span>Taxa de Separação:</span>
                <span>R$ {romaneio.taxa_separacao?.toFixed(2)}</span>
              </div>
            )}
            {romaneio.valor_frete > 0 && (
              <div className="breakdown-item">
                <span>Frete:</span>
                <span>R$ {romaneio.valor_frete?.toFixed(2)}</span>
              </div>
            )}
            {romaneio.desconto_credito > 0 && (
              <div className="breakdown-item discount">
                <span>Desconto:</span>
                <span>- R$ {romaneio.desconto_credito?.toFixed(2)}</span>
              </div>
            )}
            <div className="breakdown-item total">
              <strong>Total:</strong>
              <strong>R$ {romaneio.valor_total?.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
