import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Sun, Moon } from 'lucide-react'
import { register, login } from '../api/index'
import { useTheme } from '../App'

const RULES = {
  username: (v) => {
    if (!v) return 'Username is required.'
    if (v.length < 3) return 'Username must be at least 3 characters.'
    if (v.length > 20) return 'Username must be 20 characters or fewer.'
    if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'Only letters, numbers, and underscores allowed.'
    return ''
  },
  email: (v) => {
    if (!v) return ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address.'
    return ''
  },
  password: (v) => {
    if (!v) return 'Password is required.'
    if (v.length < 8) return 'Password must be at least 8 characters.'
    if (!/[a-zA-Z]/.test(v)) return 'Password must contain at least one letter.'
    if (!/[0-9]/.test(v)) return 'Password must contain at least one number.'
    return ''
  },
  confirm: (v, form) => {
    if (!v) return 'Please confirm your password.'
    if (v !== form.password) return 'Passwords do not match.'
    return ''
  },
}

export default function RegisterPage({ onSuccess }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [touched, setTouched] = useState({ username: false, email: false, password: false, confirm: false })
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const { theme, toggle } = useTheme()

  const getError = (key) => {
    if (!touched[key]) return ''
    return RULES[key](form[key], form)
  }
  const handleBlur = (key) => setTouched((t) => ({ ...t, [key]: true }))
  const handleChange = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (serverError) setServerError('')
  }
  const isFormValid = () => Object.keys(RULES).every((key) => RULES[key](form[key], form) === '')

  const handleSubmit = async () => {
    setTouched({ username: true, email: true, password: true, confirm: true })
    if (!isFormValid()) return
    setLoading(true)
    setServerError('')
    try {
      await register(form.username, form.password, form.email)
      const res = await login(form.username, form.password)
      localStorage.setItem('access_token', res.data.access)
      localStorage.setItem('refresh_token', res.data.refresh)
      onSuccess()
    } catch (err) {
      setServerError(err.response?.data?.detail || 'Registration failed. Try a different username.')
    } finally {
      setLoading(false)
    }
  }

  const field = (key, label, type = 'text', placeholder = '') => {
    const error = getError(key)
    return (
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{label}</label>
        <input
          type={type}
          value={form[key]}
          onChange={(e) => handleChange(key, e.target.value)}
          onBlur={() => handleBlur(key)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            background: 'var(--bg-base)',
            border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
            color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
        />
        {error && <div style={{ fontSize: 11, color: '#f87171', marginTop: 5 }}>{error}</div>}
      </div>
    )
  }

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
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Create account</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Get started with MediDash</p>
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

        {field('username', 'Username', 'text', 'Choose a username')}
        {field('email', 'Email (optional)', 'email', 'you@example.com')}
        {field('password', 'Password', 'password', 'Min 8 chars, include a number')}
        {field('confirm', 'Confirm Password', 'password', 'Repeat password')}

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
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none' }}>Sign in</Link>
          </p>
          <button
            onClick={toggle}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'inherit', padding: 0, flexShrink: 0,
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