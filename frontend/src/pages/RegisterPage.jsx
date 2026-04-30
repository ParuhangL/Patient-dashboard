import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { register, login } from '../api/index'

export default function RegisterPage({ onSuccess }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!form.username || !form.password) {
      setError('Username and password are required.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await register(form.username, form.password, form.email)
      const res = await login(form.username, form.password)
      localStorage.setItem('access_token', res.data.access)
      localStorage.setItem('refresh_token', res.data.refresh)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  const field = (key, label, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 8,
          background: '#0f1117', border: '1px solid #2a3347',
          color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  )

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

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            fontSize: 13, color: '#f87171',
          }}>
            {error}
          </div>
        )}

        {field('username', 'Username', 'text', 'Choose a username')}
        {field('email', 'Email (optional)', 'email', 'you@example.com')}
        {field('password', 'Password', 'password', 'Create a password')}
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