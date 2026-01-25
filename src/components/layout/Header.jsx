import { Search, Menu, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import './Header.css'

export default function Header({ onMenuToggle, title }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="header">
      <div className="header-left">
        <button className="header-menu-btn" onClick={onMenuToggle}>
          <Menu size={20} />
        </button>
        {title && (
          <div className="header-title">
            <h1>{title}</h1>
          </div>
        )}
      </div>

      <div className="header-center">
        {/* Espaço para breadcrumb ou busca global */}
      </div>

      <div className="header-right">
        <div className="header-search">
          <Search size={18} />
          <input type="text" placeholder="Pesquisar..." />
        </div>

        <button className="header-logout-btn" onClick={handleLogout} title="Sair">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
