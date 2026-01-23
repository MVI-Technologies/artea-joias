import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom' 
import { ShoppingBag, ChevronRight, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './ClientLinks.css' // Importando CSS customizado

export default function ClientLinks() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLinks()
  }, [])

  const loadLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select(`
            *,
            lot_products (
                quantidade_pedidos
            )
        `)
        .eq('status', 'aberto')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      const processed = (data || []).map(lot => {
          const meta = 12 
          let totalVendido = 0
          if (lot.lot_products) {
              totalVendido = lot.lot_products.reduce((acc, lp) => acc + (lp.quantidade_pedidos || 0), 0)
          }

          const falta = Math.max(0, meta - totalVendido)
          const progresso = Math.min(100, (totalVendido / meta) * 100)
          
          return {
              ...lot,
              stats: {
                  meta,
                  vendido: totalVendido,
                  falta,
                  progresso,
                  completo: falta === 0
              }
          }
      })
      
      setLinks(processed)
    } catch (error) {
      console.error('Erro ao carregar links:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
      <div className="flex justify-center items-center min-h-[60vh]">
          <div className="loading-spinner"></div>
      </div>
  )

  return (
    <div className="client-page">
      <div className="client-page-header">
        <h1 className="client-title">Grupos de Compra</h1>
        <p className="client-subtitle">Participe dos grupos abertos e garanta preços de atacado.</p>
      </div>

      <div className="links-grid">
        {links.length === 0 ? (
          <div className="empty-state">
            <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
            <h3 className="font-bold text-lg">Nenhum grupo aberto</h3>
            <p>Volte mais tarde para novas oportunidades.</p>
          </div>
        ) : (
          links.map(link => (
            <div key={link.id} className="link-card">
               {/* Capa */}
               <div className="card-image-container">
                  {link.imagem_capa ? (
                    <img 
                        src={link.imagem_capa} 
                        alt={link.nome} 
                        className="card-image" 
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">
                      <ShoppingBag size={40} opacity={0.2} />
                    </div>
                  )}
                  
                  <div className="status-badge">
                    <div className="status-dot"></div>
                    ABERTO
                  </div>
               </div>
               
               {/* Conteúdo */}
               <div className="card-content">
                 <h3 className="card-title">{link.nome}</h3>
                 <p className="card-description">{link.descricao || 'Sem descrição.'}</p>
                 
                 {/* Barra de Progresso */}
                 <div className="progress-container">
                    <div className="progress-header">
                        <span className="progress-label">Progresso do Grupo</span>
                        {link.stats.completo ? (
                            <span className="progress-status status-success">
                                <CheckCircle size={12} /> Mínimo Atingido!
                            </span>
                        ) : (
                            <span className="progress-status status-warning">
                                <AlertTriangle size={12} /> Faltam {link.stats.falta} pçs
                            </span>
                        )}
                    </div>
                    <div className="progress-track">
                        <div 
                            className={`progress-fill ${link.stats.completo ? 'bg-success' : 'bg-warning'}`}
                            style={{ width: `${link.stats.progresso}%` }}
                        />
                    </div>
                    <p className="progress-text">
                        {link.stats.completo 
                            ? "✨ Sucesso! O grupo já garantiu o envio." 
                            : `🔥 Faltam apenas ${link.stats.falta} para fechar o pedido!`}
                    </p>
                 </div>
                 
                 {/* Footer */}
                 <div className="card-footer">
                    <div className="date-info">
                        <Clock size={14} />
                        <span>Encerra: {link.data_fim ? new Date(link.data_fim).toLocaleDateString('pt-BR') : 'Em breve'}</span>
                    </div>
                 </div>

                 <Link 
                    to={`/app/catalogo/${link.id}`} 
                    className="btn-view-products"
                 >
                   Ver Produtos <ChevronRight size={18} />
                 </Link>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
