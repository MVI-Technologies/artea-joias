import { useState, useEffect } from 'react'
import { Clock, FileText, CheckCircle, Package, Truck, Download, MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function OrderHistory() {
  const { client } = useAuth()
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

  const getStatusBadge = (status) => {
      const styles = {
          'pendente': 'bg-amber-100 text-amber-700',
          'aguardando_pagamento': 'bg-amber-100 text-amber-700',
          'pago': 'bg-green-100 text-green-700',
          'em_preparacao': 'bg-blue-100 text-blue-700',
          'enviado': 'bg-purple-100 text-purple-700',
          'entregue': 'bg-slate-100 text-slate-700 line-through opacity-75'
      }
      return styles[status] || 'bg-slate-100 text-slate-700'
  }

  const getRomaneioUrl = (lotId) => {
      const romaneio = romaneios.find(r => r.lot_id === lotId)
      if (!romaneio) return null
      // Aqui chamaríamos a Edge Function para gerar o PDF ou baixar do Storage se salvo
      // Por enquanto, placeholder alert
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
             alert(`Erro: ${err.error || 'Falha ao gerar PDF'}`)
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

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando histórico...</div>

  return (
    <div className="client-page">
      <div className="page-header mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Histórico de Pedidos</h1>
        <p className="text-slate-500">Acompanhe suas compras e comprovantes.</p>
      </div>

      <div className="space-y-6">
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
             <Clock size={40} className="mx-auto mb-4 text-slate-300" />
             <p className="text-slate-500">Nenhum pedido realizado ainda.</p>
          </div>
        ) : (
           // Agrupar visualmente por Lote poderia ser legal, mas lista plana por data funciona bem como histórico
           orders.map(order => {
               const romaneioId = getRomaneioUrl(order.lot_id)
               
               return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row gap-4 items-start md:items-center">
                    {/* Imagem */}
                    <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                         {order.product?.imagem1 && <img src={order.product.imagem1} className="w-full h-full object-cover" />}
                    </div>
                    
                    {/* Info Central */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${getStatusBadge(order.status)}`}>
                                {order.status?.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-slate-400">
                                {new Date(order.created_at).toLocaleDateString('pt-BR')}
                            </span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">{order.product?.nome}</h3>
                        <p className="text-xs text-slate-500">
                            Grupo: {order.lot?.nome} • Qtd: {order.quantidade}
                        </p>
                    </div>

                    {/* Preço e Ações */}
                    <div className="flex flex-col items-end gap-2 min-w-[120px]">
                        <span className="font-bold text-slate-900">R$ {order.valor_total?.toFixed(2)}</span>
                        
                        <div className="flex items-center gap-2">
                            {/* Se tiver romaneio liberado */}
                            {romaneioId && (
                                <button 
                                    onClick={() => handleDownloadRomaneio(romaneioId, `Romaneio-${order.lot?.nome}.pdf`)}
                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors tooltip"
                                    title="Baixar Romaneio (PDF)"
                                >
                                    <FileText size={18} />
                                </button>
                            )}
                            
                            {/* Botão Copiar Resumo (Zap) */}
                            <button 
                                className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Copiar Resumo"
                                onClick={() => {
                                    const text = `Pedido: ${order.product?.nome} (x${order.quantity})\nTotal: R$ ${order.valor_total}\nStatus: ${order.status}`
                                    navigator.clipboard.writeText(text)
                                    alert('Resumo copiado!')
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
