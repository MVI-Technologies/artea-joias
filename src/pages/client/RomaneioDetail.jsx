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
  Upload,
  Wallet,
  DollarSign,
  Banknote
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { generateRomaneioPDF } from '../../utils/pdfGenerator'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/common/Toast'
import './RomaneioDetail.css'

export default function RomaneioDetail() {
  const { romaneioId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()

  const [romaneio, setRomaneio] = useState(null)
  const [products, setProducts] = useState([])
  const [lot, setLot] = useState(null)
  const [pixConfig, setPixConfig] = useState(null) // Centralized payment config
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copiedPix, setCopiedPix] = useState(false)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [pagamentos, setPagamentos] = useState([])

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
          lot:lots(id, nome, prazo_pagamento_horas, dados_pagamento)
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
          product:products(id, nome, codigo_sku, imagem1, preco, descricao, categoria_id, category:categories(nome))
        `)
        .eq('romaneio_id', romaneioId)

      if (itemsError) throw itemsError
      setProducts(itemsData || [])

      // 4. Buscar configurações da empresa
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('*')
        .single()
      setCompany(companyData)

    } catch (error) {
      console.error('Erro ao carregar romaneio:', error)
      toast.error('Erro ao carregar romaneio. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch payments for this romaneio
  const fetchPagamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('romaneio_pagamentos')
        .select('id, valor, meio_pagamento, observacao, created_at')
        .eq('romaneio_id', romaneioId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setPagamentos(data || [])
    } catch (error) {
      console.error('Erro ao carregar pagamentos:', error)
    }
  }

  useEffect(() => {
    if (romaneioId) fetchPagamentos()
  }, [romaneioId])

  const getMeioPagamentoLabel = (meio) => {
    const labels = { 'pix': 'PIX', 'dinheiro': 'Dinheiro', 'cartao': 'Cartão', 'transferencia': 'Transferência', 'outro': 'Outro' }
    return labels[meio] || meio
  }

  const getMeioPagamentoIcon = (meio) => {
    switch (meio) {
      case 'pix': return DollarSign
      case 'dinheiro': return Banknote
      case 'cartao': return CreditCard
      case 'transferencia': return Wallet
      default: return DollarSign
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
        label: 'Pago sem frete',
        class: 'status-success',
        icon: CheckCircle,
        description: 'Seu pagamento foi confirmado (sem frete).'
      },
      'pago_frete_incluso': {
        label: 'Pago com frete',
        class: 'status-success',
        icon: CheckCircle,
        description: 'Pagamento confirmado (com frete incluso).'
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

      toast.success('Comprovante enviado com sucesso! Aguarde a confirmação.')
      loadRomaneio()
    } catch (error) {
      console.error('Erro ao enviar comprovante:', error)
      toast.error('Erro ao enviar comprovante. Tente novamente.')
    } finally {
      setUploadingProof(false)
    }
  }

  const downloadPDF = async () => {
    try {
      const pdfBlob = await generateRomaneioPDF({
        romaneio,
        lot,
        client: romaneio.client,
        items: products, // products state already has item structure from romaneio_items fetch
        company,
        pixConfig
      })

      if (!pdfBlob) throw new Error('Erro ao gerar PDF')

      const blobUrl = URL.createObjectURL(pdfBlob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `Romaneio-${romaneio.numero_romaneio || romaneio.numero_pedido}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (error) {
      console.error('Erro ao baixar PDF:', error)
      toast.error('Erro ao baixar PDF. Tente novamente.')
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
    if (!deadline || ['pago', 'pago_frete_incluso'].includes(romaneio?.status_pagamento)) return false
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
        {!['pago', 'pago_frete_incluso'].includes(romaneio.status_pagamento) && !expired && (
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
                    {/* Show remaining balance if partial payments exist */}
                    {(() => {
                      const totalPago = pagamentos.reduce((s, p) => s + (p.valor || 0), 0)
                      const restante = (romaneio.valor_total || 0) - totalPago
                      if (totalPago > 0 && restante > 0.01) {
                        return (
                          <div className="info-item valor-destaque" style={{ marginTop: 8 }}>
                            <span className="label">Saldo Restante:</span>
                            <span className="valor" style={{ color: '#b45309' }}>R$ {restante.toFixed(2)}</span>
                          </div>
                        )
                      }
                      return null
                    })()}
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

            {/* Dados de pagamento adicionais do lote */}
            {lot?.dados_pagamento && (
              <div className="payment-additional-info">
                <h4>📋 Informações Adicionais de Pagamento</h4>
                <div className="payment-info-text">
                  {lot.dados_pagamento.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
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

        {expired && !['pago', 'pago_frete_incluso'].includes(romaneio.status_pagamento) && (
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

        {/* Financial Breakdown - custo separação calculado quando não gravado (15 até R$80, 25 acima) */}
        {(() => {
          const valorProdutos = Number(romaneio.valor_produtos ?? 0)
          let taxaSep = Number(romaneio.taxa_separacao ?? 0)
          if (taxaSep <= 0 && valorProdutos >= 1) taxaSep = valorProdutos <= 80 ? 15 : 25
          const totalExib = (Number(romaneio.valor_total ?? 0) <= valorProdutos && taxaSep > 0)
            ? valorProdutos + taxaSep + (romaneio.valor_frete || 0) - (romaneio.desconto_credito || 0)
            : (romaneio.valor_total ?? 0)
          return (
        <div className="financial-breakdown card">
          <h2>Detalhamento Financeiro</h2>
          <div className="breakdown-items">
            <div className="breakdown-item">
              <span>Subtotal (Produtos):</span>
              <span>R$ {valorProdutos.toFixed(2)}</span>
            </div>
            {taxaSep > 0 && (
              <div className="breakdown-item">
                <span>Taxa de Separação:</span>
                <span>R$ {taxaSep.toFixed(2)}</span>
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
              <strong>R$ {totalExib.toFixed(2)}</strong>
            </div>
          </div>
        </div>
          )
        })()}

        {/* Pagamentos Realizados (read-only) */}
        {pagamentos.length > 0 && (() => {
          const totalPago = pagamentos.reduce((s, p) => s + (p.valor || 0), 0)
          const valorTotal = romaneio.valor_total || 0
          const saldoRestante = Math.max(0, valorTotal - totalPago)
          const porcentagemPaga = valorTotal > 0 ? Math.min(100, (totalPago / valorTotal) * 100) : 0
          const quitado = saldoRestante <= 0.01 && totalPago > 0

          return (
            <div className="payments-history card">
              <h2><Wallet size={20} /> Pagamentos Realizados</h2>

              {/* Progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 8,
                      background: quitado
                        ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                        : 'linear-gradient(90deg, #D4AF37, #f0d060)',
                      width: `${porcentagemPaga}%`,
                      transition: 'width 0.5s ease'
                    }}
                  />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                  {porcentagemPaga.toFixed(0)}%
                </span>
              </div>

              {/* Summary badges */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  background: '#dbeafe', color: '#1d4ed8'
                }}>
                  Pago: R$ {totalPago.toFixed(2)}
                </span>
                {!quitado && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                    background: '#fef3c7', color: '#b45309'
                  }}>
                    Restante: R$ {saldoRestante.toFixed(2)}
                  </span>
                )}
                {quitado && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                    background: '#d1fae5', color: '#059669'
                  }}>
                    <CheckCircle size={14} /> Quitado
                  </span>
                )}
              </div>

              {/* Payments list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pagamentos.map(pag => {
                  const MeioIcon = getMeioPagamentoIcon(pag.meio_pagamento)
                  return (
                    <div key={pag.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', background: '#f8fafc',
                      border: '1px solid #e2e8f0', borderRadius: 8
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 6,
                        background: 'linear-gradient(135deg, #D4AF37, #e6c555)',
                        color: 'white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0
                      }}>
                        <MeioIcon size={16} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: 14 }}>R$ {pag.valor?.toFixed(2)}</strong>
                          <span style={{
                            fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                            padding: '2px 6px', borderRadius: 4,
                            background: '#f1f5f9', color: '#475569'
                          }}>
                            {getMeioPagamentoLabel(pag.meio_pagamento)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                          {new Date(pag.created_at).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                          {pag.observacao && <span style={{ color: '#64748b', fontStyle: 'italic' }}> — {pag.observacao}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
