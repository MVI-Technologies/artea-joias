import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Home, 
  ShoppingBag, 
  User, 
  Package,
  LogOut,
  Menu,
  X
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import './ClientLayout.css'

export default function ClientLayout() {
  const { client, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const menuItems = [
    { path: '/cliente', icon: Home, label: 'Início' },
    { path: '/cliente/catalogo', icon: Package, label: 'Catálogo' },
    { path: '/cliente/pedidos', icon: ShoppingBag, label: 'Meus Pedidos' },
    { path: '/cliente/perfil', icon: User, label: 'Meu Perfil' }
  ]

  return (
    <div className="client-layout">
      {/* Header */}
      <header className="client-header">
        <div className="client-header-content">
          <Link to="/cliente" className="client-logo">
            ARTEA JOIAS
          </Link>

          <nav className={`client-nav ${menuOpen ? 'open' : ''}`}>
            <button className="client-nav-close" onClick={() => setMenuOpen(false)}>
              <X size={24} />
            </button>
            
            {menuItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`client-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
            
            <button className="client-nav-item logout" onClick={handleLogout}>
              <LogOut size={18} />
              Sair
            </button>
          </nav>

          <div className="client-header-right">
            <span className="client-greeting">
              Olá, {client?.nome?.split(' ')[0] || 'Cliente'}
            </span>
            <button className="client-menu-toggle" onClick={() => setMenuOpen(true)}>
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="client-main">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="client-footer">
        <p>© 2024 Artea Joias - Todos os direitos reservados</p>
      </footer>

      {/* Mobile Overlay */}
      {menuOpen && (
        <div className="client-overlay" onClick={() => setMenuOpen(false)} />
      )}
    </div>
  )
}
