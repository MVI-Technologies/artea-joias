import { useState, useEffect } from 'react'
import { Clock, FileText, CheckCircle, Package, Truck, Download, MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/common/Toast'
import './OrderHistory.css'

export default function OrderHistory() {
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
      // 1. Buscar Pedidos
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
            *,
            product:products (nome, imagem1),
            lot:lots (nome, status)
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })

      if (orderError) throw orderError
      setOrders(orderData || [])

      // 2. Buscar Romaneios Disponíveis
      const { data: romData, error: romError } = await supabase
        .from('romaneios')
        .select('*')
        .eq('client_id', client.id)
      
      if (!romError) setRomaneios(romData || [])

    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRomaneioUrl = (lotId) => {
      const romaneio = romaneios.find(r => r.lot_id === lotId)
      if (!romaneio) return null
      return romaneio.id
  }

  const handleDownloadRomaneio = async (romaneioId, fileName) => {
      try {
        setLoading(true) // O ideal seria loading especifico por id, mas ok para demo
        
        const { data, error } = await supabase.functions.invoke('generate-romaneio-pdf', {
            body: { romaneioId }
        })

        if (error) throw error
        
        // O Edge Function retorna o PDF como Blob se responseType for setado, 
        // mas supabase-js functions invoke padrao retorna JSON ou ArrayBuffer se configurado.
        // Vamos ajustar para lidar com blob.
        
        // Nota: A invoke as vezes precisa de hacks pra Blob.
        // Alternativa mais segura: fetch direto com URL da function e Auth Header.
        
        // Hack simples para Blob via Supabase client:
        if (data && data.error) throw new Error(data.error)

        // Se o function retornou o binario, precisamos processar
        // Porem, supabase-js tenta fazer JSON parse. 
        // Solução Sênior: Usar URL direta.
      } catch (e) {
         console.log('Tentando metodo fallback fetch nupuro...')
         // Fallback Fetch Puro
         const session = (await supabase.auth.getSession()).data.session
         const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-romaneio-pdf`, {
             method: 'POST',
             headers: {
                 'Authorization': `Bearer ${session?.access_token}`,
                 'Content-Type': 'application/json'
             },
             body: JSON.stringify({ romaneioId })
         })
         
         if (!response.ok) {
             const err = await response.json()
             toast.error(`Erro: ${err.error || 'Falha ao gerar PDF'}`)
             return
         }
         
         const blob = await response.blob()
         const url = window.URL.createObjectURL(blob)
         const a = document.createElement('a')
         a.href = url
         a.download = fileName || `Romaneio-${romaneioId.slice(0,8)}.pdf`
         document.body.appendChild(a)
         a.click()
         window.URL.revokeObjectURL(url)
         document.body.removeChild(a)
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
               const romaneioId = getRomaneioUrl(order.lot_id)
               
               return (
                <div key={order.id} className="order-card">
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
                                <button 
                                    onClick={() => handleDownloadRomaneio(romaneioId, `Romaneio-${order.lot?.nome}.pdf`)}
                                    className="order-action-btn download"
                                    title="Baixar Romaneio (PDF)"
                                >
                                    <FileText size={18} />
                                </button>
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
