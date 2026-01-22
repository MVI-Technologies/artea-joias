import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/common/Toast'

// Layouts
import AdminLayout from './components/layout/AdminLayout'
import ClientLayout from './components/layout/ClientLayout'

// Auth Pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'

// Admin Pages
import Dashboard from './pages/admin/Dashboard'
import ProductList from './pages/admin/products/ProductList'
import CategoryList from './pages/admin/products/CategoryList'
import CollectionList from './pages/admin/products/CollectionList'
import LotList from './pages/admin/lots/LotList'
import LotDetail from './pages/admin/lots/LotDetail'
import LotForm from './pages/admin/lots/LotForm'
import ClientList from './pages/admin/clients/ClientList'
import ClientForm from './pages/admin/clients/ClientForm'
import OrderList from './pages/admin/orders/OrderList'
import RomaneioList from './pages/admin/romaneios/RomaneioList'
import RomaneioDetail from './pages/admin/romaneios/RomaneioDetail'
import SeparacaoList from './pages/admin/separacao/SeparacaoList'
import Reports from './pages/admin/reports/Reports'
import ImportClients from './pages/admin/import/ImportClients'
import Settings from './pages/admin/settings/Settings'
import WhatsApp from './pages/admin/whatsapp/WhatsApp'
import Marketing from './pages/admin/marketing/Marketing'
import Financeiro from './pages/admin/financeiro/Financeiro'
import UserList from './pages/admin/users/UserList'

// Client Pages
import ClientDashboard from './pages/client/ClientDashboard'
import Catalog from './pages/client/Catalog'
import ClientOrders from './pages/client/ClientOrders'
import ClientProfile from './pages/client/ClientProfile'

import './styles/index.css'

// Protected Route Component
function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, isAdmin, loading, client } = useAuth()

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" style={{ width: 40, height: 40 }} />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/cliente" replace />
  }

  // Se for cliente não aprovado, mostrar mensagem
  if (!requireAdmin && client && !client.approved) {
    return (
      <div className="loading-overlay" style={{ flexDirection: 'column', gap: 16 }}>
        <h2>Cadastro Pendente</h2>
        <p>Seu cadastro ainda está aguardando aprovação.</p>
        <p>Entre em contato com a administração.</p>
      </div>
    )
  }

  return children
}

function AppRoutes() {
  const { isAdmin, user, loading } = useAuth()

  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Register />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      
      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        
        {/* Produtos */}
        <Route path="produtos" element={<ProductList />} />
        <Route path="produtos/estoque" element={<ProductList />} />
        <Route path="produtos/categorias" element={<CategoryList />} />
        <Route path="produtos/colecoes" element={<CollectionList />} />
        
        {/* Lotes/Grupo de Compras */}
        <Route path="lotes" element={<LotList />} />
        <Route path="lotes/novo" element={<LotForm />} />
        <Route path="lotes/:id" element={<LotDetail />} />
        <Route path="lotes/:id/editar" element={<LotForm />} />
        <Route path="lotes/:id/separacao" element={<LotDetail defaultTab="separacao" />} />
        <Route path="lotes/:id/romaneios" element={<LotDetail defaultTab="romaneios" />} />
        
        {/* Marketing */}
        <Route path="marketing" element={<Marketing />} />
        
        {/* Clientes */}
        <Route path="clientes" element={<ClientList />} />
        <Route path="clientes/novo" element={<ClientForm />} />
        <Route path="clientes/:id" element={<ClientForm />} />
        <Route path="clientes/importar" element={<ImportClients />} />
        
        {/* Pedidos */}
        <Route path="pedidos" element={<OrderList />} />
        <Route path="compras" element={<OrderList />} />
        
        {/* Romaneios */}
        <Route path="romaneios" element={<RomaneioList />} />
        <Route path="romaneios/:id" element={<RomaneioDetail />} />
        
        {/* Separação */}
        <Route path="separacao" element={<SeparacaoList />} />
        
        {/* Relatórios */}
        <Route path="relatorios" element={<Reports />} />
        
        {/* Configurações */}
        <Route path="configuracoes" element={<Settings />} />
        
        {/* Marketing e Financeiro */}
        <Route path="marketing" element={<Marketing />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="usuarios" element={<UserList />} />

        {/* WhatsApp */}\n        <Route path="whatsapp" element={<WhatsApp />} />
        
        {/* Fallback */}
        <Route path="*" element={<Dashboard />} />
      </Route>

      {/* Client Routes */}
      <Route
        path="/cliente"
        element={
          <ProtectedRoute>
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClientDashboard />} />
        <Route path="catalogo" element={<Catalog />} />
        <Route path="catalogo/:lotId" element={<Catalog />} />
        <Route path="pedidos" element={<ClientOrders />} />
        <Route path="perfil" element={<ClientProfile />} />
      </Route>

      {/* Default redirect - WAIT for loading before redirecting */}
      <Route path="/" element={
        loading ? (
          <div className="loading-overlay">
            <div className="loading-spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : user ? (
          isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/cliente" replace />
        ) : (
          <Navigate to="/login" replace />
        )
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
