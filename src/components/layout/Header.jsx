import { Search, Menu } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import './Header.css'

export default function Header({ onMenuToggle, title }) {
  const { user } = useAuth()

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

        <div className="header-user">
          <div className="user-avatar">
            {user?.nome?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.nome || 'Administrador'}</span>
            <span className="user-role">Admin</span>
          </div>
        </div>
      </div>
    </header>
  )
}
