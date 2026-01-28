import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, FileText, CheckCircle, Package, Truck, Download, MessageCircle, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { generateRomaneioPDF } from '../../utils/pdfGenerator'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/common/Toast'
import './OrderHistory.css'

export default function OrderHistory() {
  const navigate = useNavigate()
  const { client } = useAuth()
  const toast = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [romaneios, setRomaneios] = useState([])

  useEffect(() => {
    if (client) fetchData()
  }, [client])

  const fetchData = async () => {
    try {
      // 1. Buscar Romaneios do Cliente - SIMPLIFICADO para garantir tudo
      const { data: myRomaneios, error: romError } = await supabase
        .from('romaneios')
        .select(`*, lot:lots(nome, status)`)
        .eq('client_id', client.id)
      // Removido .order aqui para garantir que não afete a busca, ordenaremos no js final


      if (romError) throw romError
      setRomaneios(myRomaneios || [])

      if (!myRomaneios || myRomaneios.length === 0) {
        setOrders([])
        return
      }

      const romaneioIds = myRomaneios.map(r => r.id)

      // 2. Buscar Itens desses romaneios
      const { data: itemsData, error: itemsError } = await supabase
        .from('romaneio_items')
        .select(`
            *,
            product:products (nome, imagem1, descricao, codigo_sku, categoria_id, category:categories(nome))
        `)
        .in('romaneio_id', romaneioIds.length > 0 ? romaneioIds : ['00000000-0000-0000-0000-000000000000']) // Pass a dummy ID if no romaneios to prevent error
        .order('created_at', { ascending: false })

      if (itemsError) throw itemsError

      // 3. Combinar dados
      // Romaneios Items
      const romaneioOrders = (itemsData || []).map(item => {
        const romaneio = myRomaneios.find(r => r.id === item.romaneio_id)
        return {
          id: item.id,
          unique_key: `rom-${item.id}`,
          type: 'romaneio_item',
          product: item.product,
          lot: romaneio?.lot,
          lot_id: romaneio?.lot_id,
          quantidade: item.quantidade,
          valor_total: item.valor_total,
          status: romaneio?.status_pagamento || 'pendente',
          created_at: romaneio?.created_at || item.created_at,
          romaneio_id: item.romaneio_id,
          romaneio_obj: romaneio
        }
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setOrders(romaneioOrders)
      console.log('Total Romaneios encontrados:', myRomaneios.length)
      console.log('Total Itens encontrados:', romaneioOrders.length)

    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
      toast.error('Erro ao carregar histórico de pedidos')
      // Se for erro de rede/CORS, talvez mostrar msg pro usuario
      if (error.message === 'Failed to fetch') {
        toast.error('Erro de conexão ao buscar histórico.')
      }
    } finally {
      setLoading(false)
    }
  }

  const getRomaneioUrl = (lotId) => {
    const romaneio = romaneios.find(r => r.lot_id === lotId)
    if (!romaneio) return null
    return romaneio.id
  }

  const handleDownloadRomaneio = async (romaneioId, fileName, order) => {
    try {
      setLoading(true)

      // Recuperar objeto romaneio completo
      let fullRomaneio = order?.romaneio_obj
      if (!fullRomaneio) {
        const { data } = await supabase.from('romaneios').select('*, lot:lots(*)').eq('id', romaneioId).single()
        fullRomaneio = data
      }

      // Recuperar itens deste romaneio para o PDF
      // (order é apenas 1 item, precisamos de todos do romaneio)
      const { data: allItems } = await supabase
        .from('romaneio_items')
        .select('*, product:products(*, category:categories(nome))')
        .eq('romaneio_id', romaneioId)

      // Buscar configs
      const { data: company } = await supabase.from('company_settings').select('*').single()
      const { data: pixInt } = await supabase.from('integrations').select('config').eq('type', 'pix').single()

      const pdfBase64 = await generateRomaneioPDF({
        romaneio: fullRomaneio,
        lot: fullRomaneio?.lot || { nome: 'Catálogo' },
        client: client,
        items: allItems || [],
        company: company,
        pixConfig: pixInt?.config
      })

      if (!pdfBase64) throw new Error('Falha ao gerar PDF')

      const link = document.createElement('a')
      link.href = `data:application/pdf;base64,${pdfBase64}`
      link.download = fileName || `Romaneio-${romaneioId.slice(0, 8)}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (e) {
      console.error('Erro ao baixar PDF:', e)
      toast.error('Erro ao baixar PDF')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="order-history-page">
      <div className="text-center py-16 text-slate-500">Carregando histórico...</div>
    </div>
  )

  return (
    <div className="order-history-page">
      <div className="order-history-header">
        <h1>Histórico de Pedidos</h1>
        <p>Acompanhe suas compras e comprovantes.</p>
      </div>

      <div className="order-history-list">
        {orders.length === 0 ? (
          <div className="order-history-empty">
            <Clock size={40} className="order-history-empty-icon" />
            <p>Nenhum pedido realizado ainda.</p>
          </div>
        ) : (
          orders.map(order => {
            const romaneioId = order.romaneio_id || getRomaneioUrl(order.lot_id)

            return (
              <div key={order.unique_key || order.id} className="order-card">
                {/* Imagem */}
                <div className="order-card-image">
                  {order.product?.imagem1 ? (
                    <img src={order.product.imagem1} alt={order.product.nome} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-300">
                      <Package size={24} />
                    </div>
                  )}
                </div>

                {/* Info Central */}
                <div className="order-card-content">
                  <div className="order-card-header">
                    <span className={`order-status-badge ${order.status}`}>
                      {order.status?.replace('_', ' ')}
                    </span>
                    <span className="order-date">
                      {new Date(order.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <h3 className="order-product-name">{order.product?.nome || 'Produto não encontrado'}</h3>
                  <p className="order-product-details">
                    Grupo: {order.lot?.nome || 'N/A'} • Qtd: {order.quantidade}
                  </p>
                </div>

                {/* Preço e Ações */}
                <div className="order-card-footer">
                  <span className="order-total">R$ {order.valor_total?.toFixed(2) || '0.00'}</span>

                  <div className="order-actions">
                    {/* Se tiver romaneio liberado */}
                    {romaneioId && (
                      <>
                        <button
                          onClick={() => navigate(`/app/romaneio/${romaneioId}`)}
                          className="order-action-btn view"
                          title="Ver Romaneio e Pagamento"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDownloadRomaneio(romaneioId, `Romaneio-${order.lot?.nome}.pdf`, order)}
                          className="order-action-btn download"
                          title="Baixar PDF"
                        >
                          <Download size={18} />
                        </button>
                      </>
                    )}

                    {/* Botão Copiar Resumo (Zap) */}
                    <button
                      className="order-action-btn copy"
                      title="Copiar Resumo"
                      onClick={() => {
                        const text = `Pedido: ${order.product?.nome} (x${order.quantidade})\nTotal: R$ ${order.valor_total}\nStatus: ${order.status}`
                        navigator.clipboard.writeText(text)
                        toast.success('Resumo copiado!')
                      }}
                    >
                      <MessageCircle size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
