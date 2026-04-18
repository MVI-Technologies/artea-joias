import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom' 
import { ShoppingBag, ChevronRight, Clock, Lock, Package, Truck, CheckCircle, Factory, Search, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/common/Toast'
import CenteredLoader from '../../components/common/CenteredLoader'
import './ClientLinks.css' // Importando CSS customizado

export default function ClientLinks() {
  const toast = useToast()
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('aberto') // 'aberto' ou 'fechado'

  useEffect(() => {
    loadLinks()
  }, [activeTab])

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
      
      if (activeTab === 'aberto') {
        query = query.in('status', ['aberto', 'pronto_e_aberto'])
      } else {
        query = query.not('status', 'in', '(aberto,pronto_e_aberto)')
      }

      query = query.order('created_at', { ascending: false })

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

  const getLotStatusLabel = (status) => {
    const labels = {
      'aberto': 'Aberto',
      'pronto_e_aberto': 'Pronto e Aberto',
      'fechado': 'Fechado',
      'fechado_e_bloqueado': 'Fechado',
      'preparacao': 'Em Preparação',
      'em_preparacao': 'Em Preparação',
      'em_fabricacao': 'Em Fabricação',
      'fornecedor_separando': 'Fornecedor Separando',
      'verificando_estoque': 'Verificando Estoque',
      'organizando_valores': 'Organizando Valores',
      'aguardando_pagamentos': 'Aguardando Pagamentos',
      'em_transito': 'Em Trânsito',
      'em_transito_internacional': 'Em Trânsito Internacional',
      'em_separacao': 'Em Separação',
      'envio_liberado': 'Envio Liberado',
      'envio_parcial_liberado': 'Envio Parcial Liberado',
      'pago': 'Pago',
      'enviado': 'Enviado',
      'concluido': 'Concluído',
      'finalizado': 'Finalizado',
      'cancelado': 'Cancelado'
    }
    return labels[status] || status
  }

  if (loading) return <CenteredLoader fullHeight />

  return (
    <div className="client-page">
      <div className="client-page-header">
        <h1 className="client-title">Grupos de Compra</h1>
        <div className="header-actions">
           <p className="client-subtitle">
            {activeTab === 'aberto' 
              ? 'Participe dos grupos abertos e garanta preços de fábrica.' 
              : 'Visualize os grupos que já foram encerrados.'}
           </p>
           
           <div className="tab-container">
             <button 
               className={`btn-toggle-links ${activeTab === 'aberto' ? 'active' : ''}`}
               onClick={() => setActiveTab('aberto')}
             >
               Abertos
             </button>
             <button 
               className={`btn-toggle-links ${activeTab === 'fechado' ? 'active' : ''}`}
               onClick={() => setActiveTab('fechado')}
             >
               Encerrados
             </button>
           </div>
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
                  backgroundImage: (link.status === 'fechado' || link.status === 'fechado_e_bloqueado') 
                    ? 'url(/images/closed-lot.png)' 
                    : (link.cover_image_url ? `url(${link.cover_image_url})` : 'none'),
                  backgroundSize: (link.status === 'fechado' || link.status === 'fechado_e_bloqueado') ? 'contain' : 'cover',
                  backgroundRepeat: (link.status === 'fechado' || link.status === 'fechado_e_bloqueado') ? 'no-repeat' : 'initial',
                  backgroundColor: (link.status === 'fechado' || link.status === 'fechado_e_bloqueado') ? '#ffffff' : 'transparent',
                }}
              >
                {/* Placeholder apenas se NÃO for fechado E não tiver cover_image_url */}
                {!(link.status === 'fechado' || link.status === 'fechado_e_bloqueado') && !link.cover_image_url && (
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
                    {getLotStatusLabel(link.status)}
                  </div>
                </div>
                
                {/* Botão de acesso - desabilitar se lote não está aberto */}
                {!['aberto', 'pronto_e_aberto'].includes(link.status) ? (
                  <button 
                    className="btn-access-products btn-disabled"
                    onClick={() => toast.warning('Este link está fechado!')}
                    disabled
                  >
                    <Lock size={16} />
                    Link Fechado
                  </button>
                ) : (
                  <Link 
                    to={`/app/catalogo/${link.id}`} 
                    className="btn-access-products"
                  >
                    Acessar Produtos
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
