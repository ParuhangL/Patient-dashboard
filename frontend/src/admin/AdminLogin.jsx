import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

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

export default function AdminLogin() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [touched, setTouched] = useState({ username: false, password: false })
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const getError = (key) => (!touched[key] ? '' : RULES[key](form[key]))
  const handleBlur = (key) => setTouched((t) => ({ ...t, [key]: true }))
  const handleChange = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (serverError) setServerError(null)
  }
  const isFormValid = () => Object.keys(RULES).every((key) => RULES[key](form[key]) === '')

  const handleSubmit = async () => {
    setTouched({ username: true, password: true })
    if (!isFormValid()) return
    setLoading(true)
    setServerError(null)
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/admin/login/`,
        { username: form.username.trim(), password: form.password },
        { headers: { 'Content-Type': 'application/json' } }
      )
      localStorage.setItem('adminToken', res.data.access)
      localStorage.setItem('adminUser', JSON.stringify(res.data.user))
      navigate('/admin-panel')
    } catch (err) {
      setServerError(err.response?.data?.error || 'Invalid credentials.')
    } finally {
      setLoading(false)
    }
  }

  const usernameError = getError('username')
  const passwordError = getError('password')

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 36, width: '100%', maxWidth: 400,
      }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', fontSize: 20,
          }}>
            🛡️
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Admin Panel</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Staff access only</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{
            fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.4px', display: 'block', marginBottom: 6,
          }}>
            Username
          </label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => handleChange('username', e.target.value)}
            onBlur={() => handleBlur('username')}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            style={{
              width: '100%', padding: '9px 12px',
              background: 'var(--bg-base)',
              border: `1px solid ${usernameError ? '#ef4444' : 'var(--border)'}`,
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          {usernameError && (
            <div style={{ fontSize: 11, color: '#f87171', marginTop: 5 }}>{usernameError}</div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{
            fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.4px', display: 'block', marginBottom: 6,
          }}>
            Password
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            onBlur={() => handleBlur('password')}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            style={{
              width: '100%', padding: '9px 12px',
              background: 'var(--bg-base)',
              border: `1px solid ${passwordError ? '#ef4444' : 'var(--border)'}`,
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          {passwordError && (
            <div style={{ fontSize: 11, color: '#f87171', marginTop: 5 }}>{passwordError}</div>
          )}
        </div>

        {serverError && (
          <div style={{
            padding: '9px 12px', background: '#450a0a',
            borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 14,
          }}>
            {serverError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '10px',
            background: '#dc2626', border: 'none', borderRadius: 8,
            color: 'white', fontSize: 13, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in as Admin'}
        </button>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <a href="/" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Back to main app
          </a>
        </div>
      </div>
    </div>
  )
}