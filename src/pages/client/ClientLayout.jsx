import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  ShoppingBag, 
  Clock, 
  User, 
  LogOut, 
  Menu, 
  X,
  CreditCard,
  Package 
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import './ClientLayout.css'

export default function ClientLayout() {
  const { signOut } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  // Calcular itens do carrinho
  useEffect(() => {
    const calcCart = () => {
        let total = 0
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith('cart_')) {
                const items = JSON.parse(localStorage.getItem(key) || '[]')
                if (Array.isArray(items)) {
                    total += items.reduce((acc, item) => acc + (item.quantity || 1), 0)
                }
            }
        }
        setCartCount(total)
    }

    calcCart()
    // Ouvir evento customizado se implementarmos, ou apenas storage (outras abas)
    window.addEventListener('storage', calcCart)
    // Pequeno intervalo para pegar atualizações locais sem evento (polling simples)
    const interval = setInterval(calcCart, 2000)
    
    return () => {
        window.removeEventListener('storage', calcCart)
        clearInterval(interval)
    }
  }, [])

  const isActive = (path) => location.pathname === path

  const navItems = [
    { path: '/app', label: 'Links', icon: ShoppingBag },
    { path: '/app/historico', label: 'Histórico', icon: Clock },
    { path: '/app/perfil', label: 'Meus Dados', icon: User },
  ]

  return (
    <div className="client-layout">
      {/* Navbar Superior */}
      <header className="client-header">
        <div className="header-container">
          <Link to="/app" className="brand-area" aria-label="Ir para Início">
             <span className="brand-text">ARTEA JOIAS</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="desktop-nav" aria-label="Navegação Principal">
            {navItems.map((item) => (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                aria-current={isActive(item.path) ? 'page' : undefined}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Ações Direita */}
          <div className="header-actions">
            <Link 
                to="/app/carrinho" 
                className={`cart-btn ${cartCount > 0 ? 'has-items' : ''}`}
                aria-label={`Carrinho com ${cartCount} itens`}
            >
              <CreditCard size={20} />
              <span className="cart-text">Carrinho</span>
              {cartCount > 0 && (
                  <span className="cart-badge">{cartCount}</span>
              )}
            </Link>
            
            <button 
                className="logout-btn-icon" 
                onClick={signOut} 
                title="Sair"
                aria-label="Sair da conta"
            >
              <LogOut size={20} />
            </button>

            {/* Mobile Menu Toggle */}
            <button 
              className="mobile-menu-btn" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Fechar Menu" : "Abrir Menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
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

      {/* Conteúdo Principal */}
      <main className="client-content">
        <Outlet />
      </main>
    </div>
  )
}
