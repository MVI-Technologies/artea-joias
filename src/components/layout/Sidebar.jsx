import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  Users, 
  Link as LinkIcon,
  FileText,
  BarChart3,
  Settings,
  MessageSquare,
  Wallet,
  Tag,
  ChevronDown,
  ChevronRight,
  LogOut,
  Gift,
  Layers,
  Star,
  Truck,
  Award,
  FileSpreadsheet,
  Megaphone
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import './Sidebar.css'

const menuItems = [
  {
    label: 'Compras',
    icon: ShoppingBag,
    path: '/admin/compras',
    badge: null
  },
  {
    label: 'Produtos',
    icon: Package,
    submenu: [
      { label: 'Estoque', path: '/admin/produtos/estoque' },
      { label: 'Categorias', path: '/admin/produtos/categorias' },
      { label: 'Coleções', path: '/admin/produtos/colecoes' },
    ]
  },
  {
    label: 'Vendas',
    icon: Wallet,
    submenu: [
      { label: 'Atacado', path: '/admin/vendas/atacado' },
      { label: 'Varejo', path: '/admin/vendas/varejo' },
      { label: 'Aluguel', path: '/admin/vendas/aluguel' },
    ]
  },
  {
    label: 'Grupo de Compras',
    icon: LinkIcon,
    path: '/admin/lotes',
    badge: null
  },
  {
    label: 'Clientes',
    icon: Users,
    path: '/admin/clientes',
    badge: null
  },
  {
    label: 'WhatsApp',
    icon: MessageSquare,
    path: '/admin/whatsapp',
  },
  {
    label: 'Relatórios',
    icon: BarChart3,
    path: '/admin/relatorios',
  },
  {
    label: 'Controle Financeiro',
    icon: Wallet,
    path: '/admin/financeiro',
  },
  {
    label: 'Usuários',
    icon: Users,
    path: '/admin/usuarios',
    badge: 1
  },
  {
    label: 'Configurações',
    icon: Settings,
    path: '/admin/configuracoes',
    badge: 1
  },
  {
    label: 'Pesquisar',
    icon: FileSpreadsheet,
    path: '/admin/pesquisar',
  }
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [openSubmenus, setOpenSubmenus] = useState({})
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleSubmenu = (label) => {
    setOpenSubmenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }))
  }

  const isActive = (path) => location.pathname === path
  const isSubmenuActive = (submenu) => submenu?.some(item => location.pathname === item.path)

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Logo/Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-text">ARTEA JOIAS</span>
        </div>
        <div className="sidebar-user">
          <span className="user-greeting">Olá, {user?.nome || 'Administrador'}</span>
        </div>
      </div>

      {/* Menu */}
      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          {menuItems.map((item) => (
            <li key={item.label} className="sidebar-menu-item">
              {item.submenu ? (
                <>
                  <button
                    className={`sidebar-link ${isSubmenuActive(item.submenu) ? 'active' : ''}`}
                    onClick={() => toggleSubmenu(item.label)}
                  >
                    <item.icon size={18} className="sidebar-icon" />
                    <span className="sidebar-label">{item.label}</span>
                    {openSubmenus[item.label] ? (
                      <ChevronDown size={16} className="sidebar-chevron" />
                    ) : (
                      <ChevronRight size={16} className="sidebar-chevron" />
                    )}
                  </button>
                  {openSubmenus[item.label] && (
                    <ul className="sidebar-submenu">
                      {item.submenu.map((subitem) => (
                        <li key={subitem.path}>
                          <Link
                            to={subitem.path}
                            className={`sidebar-sublink ${isActive(subitem.path) ? 'active' : ''}`}
                          >
                            {subitem.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <Link
                  to={item.path}
                  className={`sidebar-link ${isActive(item.path) ? 'active' : ''}`}
                >
                  <item.icon size={18} className="sidebar-icon" />
                  <span className="sidebar-label">{item.label}</span>
                  {item.badge && (
                    <span className="sidebar-badge">{item.badge}</span>
                  )}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="sidebar-link logout-btn" onClick={handleLogout}>
          <LogOut size={18} className="sidebar-icon" />
          <span className="sidebar-label">Sair</span>
        </button>
      </div>
    </aside>
  )
}
