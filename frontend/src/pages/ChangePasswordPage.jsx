import { useState } from 'react'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'
import { changePassword } from '../api/index'
import { useToast } from '../App'

const RULES = {
  current_password: (v) => {
    if (!v) return 'Current password is required.'
    return ''
  },
  new_password: (v) => {
    if (!v) return 'New password is required.'
    if (v.length < 8) return 'Must be at least 8 characters.'
    if (!/[a-zA-Z]/.test(v)) return 'Must contain at least one letter.'
    if (!/[0-9]/.test(v)) return 'Must contain at least one number.'
    return ''
  },
  confirm_password: (v, form) => {
    if (!v) return 'Please confirm your new password.'
    if (v !== form.new_password) return 'Passwords do not match.'
    return ''
  },
}

const FIELDS = ['current_password', 'new_password', 'confirm_password']

export default function ChangePasswordPage() {
  const toast = useToast()

  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [touched, setTouched] = useState({
    current_password: false,
    new_password: false,
    confirm_password: false,
  })
  const [show, setShow] = useState({
    current_password: false,
    new_password: false,
    confirm_password: false,
  })
  const [loading, setLoading]         = useState(false)
  const [serverError, setServerError] = useState('')
  const [success, setSuccess]         = useState(false)

  const getError = (key) => {
    if (!touched[key]) return ''
    return RULES[key](form[key], form)
  }

  const handleBlur   = (key) => setTouched(t => ({ ...t, [key]: true }))
  const handleChange = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    if (serverError) setServerError('')
    if (success) setSuccess(false)
  }

  const isFormValid = () => FIELDS.every(k => RULES[k](form[k], form) === '')

  const handleSubmit = async () => {
    setTouched({ current_password: true, new_password: true, confirm_password: true })
    if (!isFormValid()) return

    setLoading(true)
    setServerError('')
    try {
      await changePassword(form.current_password, form.new_password, form.confirm_password)
      setSuccess(true)
      setForm({ current_password: '', new_password: '', confirm_password: '' })
      setTouched({ current_password: false, new_password: false, confirm_password: false })
      toast.success('Password updated', 'Your password has been changed successfully.')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to update password.'
      setServerError(msg)
    } finally {
      setLoading(false)
    }
  }

  const LABELS = {
    current_password: 'Current Password',
    new_password:     'New Password',
    confirm_password: 'Confirm New Password',
  }

  return (
    <div>
      <div style={{
        borderBottom: '1px solid var(--border)',
        paddingBottom: 16,
        marginBottom: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Change Password
          </h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginLeft: 28 }}>
          Update your account password
        </p>
      </div>

      <div style={{
        maxWidth: 440,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 32,
      }}>

        {serverError && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 13,
            color: '#f87171',
          }}>
            {serverError}
          </div>
        )}

        {success && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 13,
            color: '#10b981',
          }}>
            <CheckCircle size={15} />
            Password updated successfully.
          </div>
        )}

        {FIELDS.map((key) => {
          const err = getError(key)
          return (
            <div key={key} style={{ marginBottom: 18 }}>
              <label style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {LABELS[key]}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={show[key] ? 'text' : 'password'}
                  value={form[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  onBlur={() => handleBlur(key)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                  placeholder={`Enter ${LABELS[key].toLowerCase()}`}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 14px',
                    borderRadius: 8,
                    background: 'var(--bg-base)',
                    border: `1px solid ${err ? '#ef4444' : 'var(--border)'}`,
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 0,
                  }}
                >
                  {show[key] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {err && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 5 }}>{err}</div>
              )}
            </div>
          )
        })}

        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          marginBottom: 24,
          lineHeight: 1.6,
        }}>
          New password must be at least 8 characters and contain at least one letter and one number.
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: 8,
            border: 'none',
            background: loading ? 'var(--bg-surface-alt)' : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            color: loading ? 'var(--text-muted)' : 'white',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </div>
  )
}