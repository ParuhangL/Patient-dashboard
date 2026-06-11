import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { register, login } from '../api/index'

// ── Validation rules ────────────────────────────────────────────────────────
const RULES = {
  username: (v) => {
    if (!v) return 'Username is required.'
    if (v.length < 3) return 'Username must be at least 3 characters.'
    if (v.length > 20) return 'Username must be 20 characters or fewer.'
    if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'Only letters, numbers, and underscores allowed.'
    return ''
  },
  email: (v) => {
    if (!v) return '' // optional
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

  // Get error for a field (only show after it's been touched)
  const getError = (key) => {
    if (!touched[key]) return ''
    return RULES[key](form[key], form)
  }

  // Mark field as touched on blur
  const handleBlur = (key) => {
    setTouched((t) => ({ ...t, [key]: true }))
  }

  const handleChange = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    // Clear server error when user starts editing
    if (serverError) setServerError('')
  }

  const isFormValid = () => {
    return Object.keys(RULES).every((key) => RULES[key](form[key], form) === '')
  }

  const handleSubmit = async () => {
    // Touch all fields to show all errors
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
    const hasError = !!error
    return (
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
          {label}
        </label>
        <input
          type={type}
          value={form[key]}
          onChange={(e) => handleChange(key, e.target.value)}
          onBlur={() => handleBlur(key)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            background: '#0f1117',
            border: `1px solid ${hasError ? '#ef4444' : '#2a3347'}`,
            color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
        />
        {hasError && (
          <div style={{ fontSize: 11, color: '#f87171', marginTop: 5 }}>
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 400, background: '#161b27',
        border: '1px solid #2a3347', borderRadius: 16, padding: 40,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>MediDash</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Diagnostic AI Platform</div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Create account</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Get started with MediDash</p>
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
            background: loading ? '#1e3a5f' : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            color: 'white', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}