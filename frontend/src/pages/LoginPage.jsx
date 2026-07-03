import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Eye, EyeOff, Sun, Moon } from 'lucide-react'
import { login } from '../api/index'
import { useTheme } from '../App'

const RULES = {
  username: (v) => {
    if (!v.trim()) return 'Username is required.'
    if (v.length > 150) return 'Username is too long.'
    return ''
  },
  password: (v) => {
    if (!v) return 'Password is required.'
    return ''
  },
}

export default function LoginPage({ onSuccess }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [touched, setTouched] = useState({ username: false, password: false })
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const { theme, toggle } = useTheme()

  const getError = (key) => (!touched[key] ? '' : RULES[key](form[key]))
  const handleBlur = (key) => setTouched((t) => ({ ...t, [key]: true }))
  const handleChange = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (serverError) setServerError('')
  }
  const isFormValid = () => Object.keys(RULES).every((key) => RULES[key](form[key]) === '')

  const handleSubmit = async () => {
    setTouched({ username: true, password: true })
    if (!isFormValid()) return
    setLoading(true)
    setServerError('')
    try {
      const res = await login(form.username.trim(), form.password)
      localStorage.setItem('access_token', res.data.access)
      localStorage.setItem('refresh_token', res.data.refresh)
      onSuccess()
    } catch (err) {
      setServerError(err.response?.data?.detail || 'Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }
  const usernameError = getError('username')
  const passwordError = getError('password')

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 400, background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 16, padding: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>MediDash</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Diagnostic AI Platform</div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Sign in</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Enter your credentials to continue</p>
        </div>

        {serverError && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            fontSize: 13, color: '#f87171',
          }}>
            {serverError}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Username</label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => handleChange('username', e.target.value)}
            onBlur={() => handleBlur('username')}
            onKeyDown={handleKey}
            placeholder="Enter username"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              background: 'var(--bg-base)',
              border: `1px solid ${usernameError ? '#ef4444' : 'var(--border)'}`,
              color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }}
          />
          {usernameError && <div style={{ fontSize: 11, color: '#f87171', marginTop: 5 }}>{usernameError}</div>}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              onKeyDown={handleKey}
              placeholder="Enter password"
              style={{
                width: '100%', padding: '10px 40px 10px 14px', borderRadius: 8,
                background: 'var(--bg-base)',
                border: `1px solid ${passwordError ? '#ef4444' : 'var(--border)'}`,
                color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {passwordError && <div style={{ fontSize: 11, color: '#f87171', marginTop: 5 }}>{passwordError}</div>}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '11px', borderRadius: 8, border: 'none',
            background: loading ? 'var(--bg-surface-alt)' : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            color: loading ? 'var(--text-muted)' : 'white', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          No account?{' '}
          <Link to="/register" style={{ color: '#3b82f6', textDecoration: 'none' }}>Create one</Link>
        </p>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link
            to="/admin-panel/login"
            style={{ fontSize: 11, color: 'var(--text-faint)', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-muted)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
          >
            Staff access
          </Link>
          <button
            onClick={toggle}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'inherit', padding: 0,
            }}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </div>
    </div>
  )
}