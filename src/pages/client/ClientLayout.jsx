import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  ShoppingBag, 
  Clock, 
  User, 
  LogOut, 
  Menu, 
  X,
  CreditCard 
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import './ClientLayout.css'

export default function ClientLayout() {
  const { signOut, user } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (path) => location.pathname === path

  const navItems = [
    { path: '/app', label: 'Links', icon: ShoppingBag },
    { path: '/app/historico', label: 'Histórico', icon: Clock },
    { path: '/app/perfil', label: 'Meus Dados', icon: User },
  ]

  return (
    <div className="client-layout">
      {/* Navbar Superior - Estilo App */}
      <header className="client-header">
        <div className="header-container">
          <div className="brand-area">
            <img src="/logo.png" alt="Artea Joias" style={{ height: '56px' }} />
          </div>

          {/* Desktop Nav */}
          <nav className="desktop-nav">
            {navItems.map((item) => (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Ações Direita */}
          <div className="header-actions">
            <Link to="/app/carrinho" className="cart-btn">
              <CreditCard size={20} />
              <span className="cart-text">Carrinho</span>
              {/* Badge de contador viria aqui */}
            </Link>
            
            <button className="logout-btn-icon" onClick={signOut} title="Sair">
              <LogOut size={20} />
            </button>

            {/* Mobile Menu Toggle */}
            <button 
              className="mobile-menu-btn" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`mobile-nav-link ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="client-content">
        <Outlet />
      </main>
    </div>
  )
}
