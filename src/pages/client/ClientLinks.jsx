import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom' 
import { ShoppingBag, ChevronRight, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './ClientLinks.css' // Importando CSS customizado

export default function ClientLinks() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAllLinks, setShowAllLinks] = useState(false)

  useEffect(() => {
    loadLinks()
  }, [showAllLinks])

  const loadLinks = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('lots')
        .select(`
            *,
            lot_products (
                quantidade_pedidos
            )
        `)
        .order('created_at', { ascending: false })

      // Se não estiver mostrando todos, filtra apenas os abertos
      if (!showAllLinks) {
        query = query.eq('status', 'aberto')
      }

      const { data, error } = await query

      if (error) throw error
      
      const processed = (data || []).map(lot => {
        return {
            ...lot
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
        <div className="header-actions">
           <p className="client-subtitle">Participe dos grupos abertos e garanta preços de atacado.</p>
           <button 
             className={`btn-toggle-links ${showAllLinks ? 'active' : ''}`}
             onClick={() => setShowAllLinks(!showAllLinks)}
           >
             {showAllLinks ? 'Ocultar links fechados' : 'Exibir links não abertos'}
           </button>
        </div>
      </div>

      <div className="links-grid">
        {links.length === 0 ? (
          <div className="empty-state">
            <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
            <h3 className="font-bold text-lg">Nenhum grupo encontrado</h3>
            <p>Tente alterar os filtros.</p>
          </div>
        ) : (
          links.map(link => (
            <div key={link.id} className="link-card">
              {/* Cover Image Area */}
              <div 
                className="link-card-cover"
                style={{
                  backgroundImage: link.cover_image_url ? `url(${link.cover_image_url})` : 'none',
                }}
              >
                {!link.cover_image_url && (
                  <div className="cover-placeholder-gradient">
                    <ShoppingBag size={32} className="opacity-20 text-white" />
                  </div>
                )}
              </div>

              <div className="link-card-body">
                <div className="link-card-info">
                  <h3 className="link-card-title">{link.nome}</h3>
                  <p className="link-card-date">
                    <strong>Data de Fechamento:</strong> {link.data_fim ? new Date(link.data_fim).toLocaleDateString('pt-BR') : 'Indefinido'}
                  </p>
                  
                  <div className={`status-badge-card status-${link.status}`}>
                    {link.status === 'pronto_e_aberto' ? 'Pronto e Aberto' : 
                     link.status === 'aberto' ? 'Aberto' : 
                     link.status?.toUpperCase().replace(/_/g, ' ')}
                  </div>
                </div>
                
                <Link 
                  to={`/app/catalogo/${link.id}`} 
                  className="btn-access-products"
                >
                  Acessar Produtos
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
