import { useState, useEffect } from 'react'
import { BrowserRouter, useLocation, useNavigate, Navigate } from 'react-router-dom'
import './index.css'
import Sidebar from './components/layout/Sidebar'
import DashboardPage from './pages/DashboardPage'
import PatientsPage from './pages/PatientsPage'
import AnalysisPage from './pages/AnalysisPage'
import UploadPage from './pages/UploadPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AdminLogin from './admin/AdminLogin'
import AdminPage from './admin/AdminPage'


const PAGE_MAP = {
  '/dashboard': 'dashboard',
  '/patients':  'patients',
  '/analysis':  'analysis',
  '/upload':    'upload',
}

const ROUTE_MAP = {
  dashboard: '/dashboard',
  patients:  '/patients',
  analysis:  '/analysis',
  upload:    '/upload',
}

const PAGES = {
  dashboard: DashboardPage,
  patients:  PatientsPage,
  analysis:  AnalysisPage,
  upload:    UploadPage,
}

function AppInner() {
  const location = useLocation()
  const navigate = useNavigate()

  // ✅ ALL hooks must be at the top — before any conditional returns
  const [uploadResult, setUploadResult] = useState(null)
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem('access_token'))
  const [user, setUser] = useState(null)

  useEffect(() => {
    const check = () => setIsAuth(!!localStorage.getItem('access_token'))
    window.addEventListener('storage', check)
    return () => window.removeEventListener('storage', check)
  }, [])

  useEffect(() => {
    if (isAuth && !PAGE_MAP[location.pathname] &&
        location.pathname !== '/login' && location.pathname !== '/register') {
      navigate('/dashboard', { replace: true })
    }
  }, [location.pathname, isAuth])

  // ✅ Fetch user info whenever auth state changes
  useEffect(() => {
    if (isAuth) {
      fetch('/api/auth/me/', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
      })
        .then(r => r.json())
        .then(data => setUser(data))
        .catch(() => {})
    } else {
      setUser(null)
    }
  }, [isAuth])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setIsAuth(false)
    setUser(null)
    navigate('/login')
  }

  // ── Admin routes — handle before anything else ──
  if (location.pathname === '/admin-panel/login') {
    return <AdminLogin />
  }
  if (location.pathname.startsWith('/admin-panel')) {
    const token = localStorage.getItem('adminToken')
    if (!token) return <Navigate to="/admin-panel/login" replace />
    return <AdminPage />
  }

  // Conditional returns AFTER all hooks
  if (location.pathname === '/login') {
    if (isAuth) return <Navigate to="/dashboard" replace />
    return <LoginPage onSuccess={() => { setIsAuth(true); navigate('/dashboard') }} />
  }
  if (location.pathname === '/register') {
    if (isAuth) return <Navigate to="/dashboard" replace />
    return <RegisterPage onSuccess={() => { setIsAuth(true); navigate('/dashboard') }} />
  }

  if (!isAuth) return <Navigate to="/login" replace />

  const activePage = PAGE_MAP[location.pathname] || 'dashboard'
  const PageComponent = PAGES[activePage] || DashboardPage

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f1117' }}>
      <Sidebar
        activePage={activePage}
        onNavigate={(id) => navigate(ROUTE_MAP[id])}
        onLogout={handleLogout}
        user={user}
      />
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {activePage === 'upload'
          ? <UploadPage uploadResult={uploadResult} setUploadResult={setUploadResult} />
          : <PageComponent />
        }
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}