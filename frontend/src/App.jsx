import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'
import { BrowserRouter, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import './index.css'
import Sidebar from './components/layout/Sidebar'
import DashboardPage from './pages/DashboardPage'
import PatientsPage from './pages/PatientsPage'
import AnalysisPage from './pages/AnalysisPage'
import UploadPage from './pages/UploadPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import AdminLogin from './admin/AdminLogin'
import AdminPage from './admin/AdminPage'

// ─── Toast Context ────────────────────────────────────────────────────────────

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

const TOAST_ICONS = {
  success: <CheckCircle size={16} color="#10b981" />,
  error:   <XCircle    size={16} color="#ef4444" />,
  warning: <AlertTriangle size={16} color="#f59e0b" />,
  info:    <Info       size={16} color="#3b82f6" />,
}

const TOAST_BORDER = {
  success: '#10b981',
  error:   '#ef4444',
  warning: '#f59e0b',
  info:    '#3b82f6',
}

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(() => onRemove(toast.id), 300)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        background: '#1e2535',
        border: `1px solid ${TOAST_BORDER[toast.type]}40`,
        borderLeft: `3px solid ${TOAST_BORDER[toast.type]}`,
        borderRadius: 8,
        padding: '12px 14px',
        minWidth: 280,
        maxWidth: 380,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(40px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents: 'all',
      }}
    >
      <div style={{ marginTop: 1, flexShrink: 0 }}>
        {TOAST_ICONS[toast.type]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: toast.message ? 2 : 0 }}>
            {toast.title}
          </div>
        )}
        {toast.message && (
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            {toast.message}
          </div>
        )}
      </div>
      <button
        onClick={handleClose}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#475569', padding: 2, flexShrink: 0, marginTop: 1,
          borderRadius: 4,
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

function ToastContainer({ toasts, onRemove }) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  )
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const toast = useCallback((type, title, message = '', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, type, title, message }])
    if (duration > 0) {
      timers.current[id] = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
        delete timers.current[id]
      }, duration)
    }
    return id
  }, [])

  toast.success = (title, message, duration) => toast('success', title, message, duration)
  toast.error   = (title, message, duration) => toast('error',   title, message, duration)
  toast.warning = (title, message, duration) => toast('warning', title, message, duration)
  toast.info    = (title, message, duration) => toast('info',    title, message, duration)

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  )
}

// ─── Routing ──────────────────────────────────────────────────────────────────

const PAGE_MAP = {
  '/dashboard':        'dashboard',
  '/patients':         'patients',
  '/analysis':         'analysis',
  '/upload':           'upload',
  '/change-password':  'change-password',
}

const ROUTE_MAP = {
  dashboard:         '/dashboard',
  patients:          '/patients',
  analysis:          '/analysis',
  upload:            '/upload',
  'change-password': '/change-password',
}

const PAGES = {
  dashboard:         DashboardPage,
  patients:          PatientsPage,
  analysis:          AnalysisPage,
  upload:            UploadPage,
  'change-password': ChangePasswordPage,
}

function AppInner() {
  const location = useLocation()
  const navigate  = useNavigate()

  const [uploadResult, setUploadResult] = useState(null)
  const [isAuth, setIsAuth]             = useState(!!localStorage.getItem('access_token'))
  const [user, setUser]                 = useState(null)

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

  if (location.pathname === '/admin-panel/login')
    return <AdminLogin />
  if (location.pathname.startsWith('/admin-panel')) {
    if (!localStorage.getItem('adminToken')) return <Navigate to="/admin-panel/login" replace />
    return <AdminPage />
  }
  if (location.pathname === '/login') {
    if (isAuth) return <Navigate to="/dashboard" replace />
    return <LoginPage onSuccess={() => { setIsAuth(true); navigate('/dashboard') }} />
  }
  if (location.pathname === '/register') {
    if (isAuth) return <Navigate to="/dashboard" replace />
    return <RegisterPage onSuccess={() => { setIsAuth(true); navigate('/dashboard') }} />
  }
  if (!isAuth) return <Navigate to="/login" replace />

  const activePage    = PAGE_MAP[location.pathname] || 'dashboard'
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
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </BrowserRouter>
  )
}