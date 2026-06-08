import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'


export default function AdminLogin() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/admin/login/`,
        form,
        { headers: { 'Content-Type': 'application/json' } }
      )
      localStorage.setItem('adminToken', res.data.access)
      localStorage.setItem('adminUser', JSON.stringify(res.data.user))
      navigate('/admin-panel')
    } catch (error) {
      setError(error.response?.data?.error || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0d14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#161b27', border: '1px solid #2a3347',
        borderRadius: 12, padding: 36, width: '100%', maxWidth: 400,
      }}>
        {/* Header */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            fontSize: 20,
          }}>
            
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>
            Admin Panel
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Staff access only
          </div>
        </div>

        {/* Fields */}
        {[
          { label: 'Username', key: 'username', type: 'text' },
          { label: 'Password', key: 'password', type: 'password' },
        ].map(({ label, key, type }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={{
              fontSize: 11, color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.4px',
              display: 'block', marginBottom: 6,
            }}>
              {label}
            </label>
            <input
              type={type}
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{
                width: '100%', padding: '9px 12px',
                background: '#0f1117', border: '1px solid #2a3347',
                borderRadius: 8, color: '#e2e8f0', fontSize: 13,
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
        ))}

        {error && (
          <div style={{
            padding: '9px 12px', background: '#7f1d1d',
            borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 14,
          }}>
            {error}
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
          <a href="/" style={{ fontSize: 12, color: '#475569', textDecoration: 'none' }}>
            ← Back to main app
          </a>
        </div>
      </div>
    </div>
  )
}