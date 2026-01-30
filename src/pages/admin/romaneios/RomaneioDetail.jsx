import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Printer, 
  Download, 
  MessageCircle,
  FileText,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import './RomaneioDetail.css'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../../components/common/Toast'

const STATUS_OPTIONS = [
  { value: 'aguardando_pagamento', label: 'Aguardando Pagamento', color: 'warning' },
  { value: 'pago', label: 'Pago', color: 'success' },
  { value: 'em_separacao', label: 'Em Separação', color: 'info' },
  { value: 'enviado', label: 'Enviado', color: 'primary' },
  { value: 'concluido', label: 'Concluído', color: 'success' },
  { value: 'cancelado', label: 'Cancelado', color: 'danger' },
  { value: 'admin_purchase', label: 'Compra Administrativa', color: 'purple' }
]

export default function RomaneioDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const printRef = useRef()
  const toast = useToast()
  const [romaneio, setRomaneio] = useState(null)
  const [lot, setLot] = useState(null)
  const [client, setClient] = useState(null)
  const [items, setItems] = useState([])
  const [company, setCompany] = useState(null)
  const { user } = useAuth()
  const [pixConfig, setPixConfig] = useState(null) // Centralized payment config
  const [loading, setLoading] = useState(true)
  
  // Status Modal Controls
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [targetStatus, setTargetStatus] = useState('')
  const [statusReason, setStatusReason] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
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

      // 2. Buscar romaneio
      const { data: romaneioData, error: romError } = await supabase
        .from('romaneios')
        .select('*')
        .eq('id', id)
        .single()

      if (romError) throw romError
      setRomaneio(romaneioData)

      // 3. Buscar lote
      const { data: lotData } = await supabase
        .from('lots')
        .select('id, nome, updated_at, requer_pacote_fechado, prazo_pagamento_horas')
        .eq('id', romaneioData.lot_id)
        .single()
      setLot(lotData)

      // 4. Buscar cliente
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', romaneioData.client_id)
        .single()
      setClient(clientData)

      // 5. Buscar itens do romaneio
      const { data: itemsData } = await supabase
        .from('romaneio_items')
        .select(`
          *,
          product:products(id, nome, descricao, preco, imagem1, categoria_id, category:categories(nome))
        `)
        .eq('romaneio_id', id)
        .order('created_at')
      setItems(itemsData || [])

      // 6. Buscar configurações da empresa
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('*')
        .single()
      setCompany(companyData)

    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleStatusUpdate = async () => {
    if (!targetStatus) return
    setUpdating(true)
    
    try {
        // Encontrar admin ID (client_id do usuario logado)
        const { data: adminClient } = await supabase
            .from('clients')
            .select('id')
            .eq('auth_id', user.id)
            .single()

        if (!adminClient) throw new Error('Perfil de administrador não encontrado')

        const { error } = await supabase.rpc('update_romaneio_status', {
            p_romaneio_id: id,
            p_novo_status: targetStatus,
            p_admin_id: adminClient.id,
            p_observacao: statusReason || null
        })

        if (error) throw error

        // Mensagem personalizada baseada no status
        const statusMessages = {
          'cancelado': '❌ Pedido cancelado com sucesso!',
          'pago': '✅ Pagamento confirmado!',
          'em_separacao': '📦 Pedido em separação!',
          'enviado': '🚚 Pedido marcado como enviado!',
          'concluido': '🎉 Pedido concluído!',
          'aguardando_pagamento': '⏳ Status alterado para aguardando pagamento'
        }
        
        toast.success(statusMessages[targetStatus] || 'Status atualizado com sucesso!')
        setShowStatusModal(false)
        setStatusReason('')
        fetchData() // Reload
    } catch (error) {
        console.error('Erro ao atualizar status:', error)
        toast.error('Erro ao atualizar status: ' + error.message)
    } finally {
        setUpdating(false)
    }
  }

  const openWhatsApp = () => {
    if (!client?.telefone) return
    
    const phone = client.telefone.replace(/\D/g, '')
    const message = encodeURIComponent(
      `Olá ${client.nome}! 🌟\n\n` +
      `Seu romaneio do *${lot?.nome}* está pronto!\n\n` +
      `📋 Pedido: ${romaneio?.numero_romaneio || romaneio?.numero_pedido}\n` +
      `💰 Valor Total: R$ ${romaneio?.valor_total?.toFixed(2)}\n\n` +
      `Por favor, realize o pagamento conforme os dados do romaneio.\n\n` +
      `Qualquer dúvida, estamos à disposição! 💎`
    )
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatCPF = (cpf) => {
    if (!cpf) return '-'
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  if (loading) {
    return <div className="page-container"><div className="loading-spinner" style={{ margin: '40px auto' }} /></div>
  }

  if (!romaneio) {
    return <div className="page-container">Romaneio não encontrado</div>
  }

  const requerPacote = lot?.requer_pacote_fechado ? '' : '(Não precisa fechar pacotes)'

  return (
    <div className="romaneio-detail-page">
      {/* Toolbar (não imprime) */}
      <div className="romaneio-toolbar no-print">
        <button className="btn btn-outline" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="toolbar-actions">
          <button className="btn btn-outline" onClick={openWhatsApp}>
            <MessageCircle size={16} /> Enviar WhatsApp
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      {/* Status do Pagamento (não imprime) */}
      <div className="payment-status-bar no-print">
        <div className={`payment-status status-${romaneio.status_pagamento === 'aguardando_pagamento' ? 'aguardando' : romaneio.status_pagamento}`}>
          {romaneio.status_pagamento === 'pago' ? (
            <><CheckCircle size={18} /> Pagamento Confirmado</>
          ) : ['aguardando', 'aguardando_pagamento'].includes(romaneio.status_pagamento) ? (
            <><Clock size={18} /> Aguardando Pagamento</>
          ) : (
            <><DollarSign size={18} /> Pendente</>
          )}
        </div>
        
        {romaneio.status_pagamento !== 'pago' && (
          <div className="payment-actions">
             <button 
              className="btn btn-outline btn-sm"
              onClick={() => {
                // Usar configuração centralizada de PIX
                const pixKey = pixConfig?.chave
                if (pixKey) {
                  navigator.clipboard.writeText(pixKey)
                  alert('Chave PIX copiada!')
                } else {
                  alert('Chave PIX não configurada. Configure em Configurações > Integrações.')
                }
              }}
            >
              <DollarSign size={14} /> Copiar PIX
            </button>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setShowStatusModal(true)}
            >
              <CheckCircle size={14} /> Alterar Status
            </button>
          </div>
        )}
      </div>

      {showStatusModal && (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Alterar Status do Romaneio</h3>
                <div className="form-group">
                    <label>Novo Status:</label>
                    <select 
                        value={targetStatus}
                        onChange={(e) => setTargetStatus(e.target.value)}
                        className="form-control"
                    >
                        <option value="">Selecione...</option>
                        {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>Justificativa / Observação (Opcional):</label>
                    <textarea
                        value={statusReason}
                        onChange={(e) => setStatusReason(e.target.value)}
                        placeholder="Ex: Pagamento confirmado via comprovante..."
                        className="form-control"
                        rows={3}
                    />
                </div>
                <div className="modal-actions">
                    <button 
                        className="btn btn-outline" 
                        onClick={() => setShowStatusModal(false)}
                        disabled={updating}
                    >
                        Cancelar
                    </button>
                    <button 
                        className="btn btn-primary"
                        onClick={handleStatusUpdate}
                        disabled={!targetStatus || updating}
                    >
                        {updating ? 'Salvando...' : 'Confirmar Alteração'}
                    </button>
                </div>
            </div>
        </div>
      )}


      {/* Documento do Romaneio (imprimível) */}
      <div className="romaneio-document" ref={printRef}>
        {/* Cabeçalho da Empresa */}
        <header className="romaneio-header">
          <div className="header-logo">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" />
            ) : (
              <div className="logo-placeholder">
                <span>{company?.nome_empresa?.charAt(0) || 'A'}</span>
              </div>
            )}
          </div>
          <div className="header-info">
            <h1>{company?.nome_empresa || 'ARTEA JOIAS'}</h1>
            <span>{company?.whatsapp || ''}</span>
            {romaneio.is_admin_purchase && (
                <div className="badge-admin">COMPRA ADMINISTRATIVA</div>
            )}
          </div>
        </header>

        {/* Título do Romaneio */}
        <div className="romaneio-title">
          <h2>
            Romaneio do Link <strong>{lot?.nome}</strong> {requerPacote}
          </h2>
          <span className="pedido-numero">Romaneio nº {romaneio.numero_romaneio || romaneio.numero_pedido}</span>
        </div>

        {/* Dados do Cliente */}
        <div className="cliente-info-box">
          <p><strong>Cliente:</strong> {client?.nome}</p>
          <p><strong>CPF/CNPJ:</strong> {formatCPF(client?.cpf)}</p>
          <p><strong>WhatsApp:</strong> {client?.telefone}</p>
          <p><strong>E-mail:</strong> {client?.email || '-'}</p>
          <p><strong>Data Fechamento:</strong> {formatDate(lot?.updated_at)}</p>
        </div>

        {/* Tabela de Produtos */}
        <table className="produtos-table">
          <thead>
            <tr>
              <th className="col-img"></th>
              <th className="col-cat">Categoria</th>
              <th className="col-desc">Descrição</th>
              <th className="col-val">Valor Unitário</th>
              <th className="col-qty">Quantidade</th>
              <th className="col-total">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td className="col-img">
                  {item.product?.imagem1 ? (
                    <img src={item.product.imagem1} alt="" className="produto-thumb" />
                  ) : (
                    <div className="produto-thumb-placeholder" />
                  )}
                </td>
                <td className="col-cat">{item.product?.category?.nome || '-'}</td>
                <td className="col-desc">{item.product?.descricao || item.product?.nome}</td>
                <td className="col-val">R$ {item.valor_unitario?.toFixed(2)}</td>
                <td className="col-qty">{item.quantidade}</td>
                <td className="col-total">R$ {item.valor_total?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Resumo Financeiro */}
        <div className="resumo-financeiro">
          <h3>• Valor Total da Compra: R$ {romaneio.valor_total?.toFixed(2)}</h3>
          <ul>
            <li>• Valor Produtos: R$ {romaneio.valor_produtos?.toFixed(2)}</li>
            {romaneio.total_bruto > 0 && romaneio.total_bruto !== romaneio.valor_total && (
              <li>• Total Bruto: R$ {romaneio.total_bruto?.toFixed(2)}</li>
            )}
            {romaneio.taxa_link > 0 && (
               <li>• Taxa Link/Plataforma: R$ {romaneio.taxa_link?.toFixed(2)}</li>
            )}
            {romaneio.desconto_credito > 0 && (
              <li style={{ marginLeft: 16 }}>○ Desconto (crédito anterior): R$ {romaneio.desconto_credito?.toFixed(2)}</li>
            )}
            {romaneio.taxa_separacao > 0 && (
              <li>• Custo Separação: R$ {romaneio.taxa_separacao?.toFixed(2)}</li>
            )}
            {romaneio.valor_frete > 0 && (
              <li>• Frete: R$ {romaneio.valor_frete?.toFixed(2)}</li>
            )}
            <li>• Quantidade Total de Produtos: {romaneio.quantidade_itens}</li>
            {romaneio.total_liquido > 0 && (
               <li style={{ marginTop: 8, fontWeight: 'bold' }}>• Recebido Líquido: R$ {romaneio.total_liquido?.toFixed(2)}</li>
            )}
          </ul>
        </div>

        {/* Dados de Pagamento - CENTRALIZED */}
        <div className="dados-pagamento">
          <h4>Dados para o pagamento:</h4>
          <p><strong>PAGAMENTO VIA PIX OU CARTÃO DE CRÉDITO.</strong></p>
          {pixConfig?.chave && (
            <p><strong>Chave Pix CNPJ:</strong> {pixConfig.chave}</p>
          )}
          {pixConfig?.nome_beneficiario && (
            <p><strong>Beneficiário:</strong> {pixConfig.nome_beneficiario}</p>
          )}
          {pixConfig?.cidade && (
            <p><strong>Cidade:</strong> {pixConfig.cidade}</p>
          )}
          {!pixConfig?.chave && (
            <p style={{ color: '#e63946' }}><strong>PIX não configurado.</strong> Configure em Configurações &gt; Integrações.</p>
          )}
          <p className="importante">
            <strong>IMPORTANTE:</strong> Atenção ao pagamento, deve ser realizado assim que receber o romaneio.
          </p>
          <p className="aviso">
            Caso o pagamento não seja realizado em até 24hs será removido do grupo e terá seu cadastro bloqueado 
            permanentemente, ficando impossibilitado de realizar novas compras.
          </p>
        </div>

        {/* Observações */}
        {romaneio.taxa_separacao > 0 && (
          <div className="observacoes">
            <h4>OBSERVAÇÃO</h4>
            <ul>
              <li>- *Pedidos até R$ 30,00*: isentos da taxa de serviço.</li>
              <li>- *Pedidos entre R$ 30,01 e R$ 100,00*: cobrança de R$ 20,00 de taxa de serviço.</li>
              <li>- *Pedidos acima de R$ 100,00*: cobrança da taxa de serviço no valor integral.</li>
            </ul>
            <p className="nota-taxas">
              As taxas visam cobrir custos operacionais, de manutenção das plataforma, e dos serviços prestados.
            </p>
          </div>
        )}

        {/* Rodapé */}
        <footer className="romaneio-footer">
          <p>Documento gerado em: {formatDate(romaneio.gerado_em || romaneio.created_at)}</p>
        </footer>
      </div>
    </div>
  )
}
