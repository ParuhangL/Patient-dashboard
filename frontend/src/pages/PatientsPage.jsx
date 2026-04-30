import { useEffect, useState } from 'react'
import { getPatients, getPatient, getRecords, getPatientAnalyses, updatePatient, deletePatient } from '../api'
import { Search, ChevronLeft, ChevronRight, X, Download, Pencil, Trash2, Save, AlertTriangle } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { createPortal } from 'react-dom'

function RiskBadge({ risk }) {
  const cls = risk === 'HIGH' ? 'badge-high' : risk === 'MEDIUM' ? 'badge-medium' : 'badge-low'
  return <span className={cls}>{risk}</span>
}

function MetricCard({ label, value, unit, color = '#3b82f6' }) {
  return (
    <div style={{ background: '#0f1117', borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>
        {value ?? '—'} {value && <span style={{ fontSize: 12, fontWeight: 400, color: '#475569' }}>{unit}</span>}
      </div>
    </div>
  )
}

function BPTrendChart({ records }) {
  if (!records || records.length === 0)
    return <div style={{ fontSize: 13, color: '#64748b', padding: '16px 0' }}>No medical records available for BP trend.</div>

  const data = [...records]
    .sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date))
    .map(r => ({
      date: new Date(r.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      systolic: r.blood_pressure_systolic ?? null,
      diastolic: r.blood_pressure_diastolic ?? null,
    }))
    .filter(r => r.systolic !== null || r.diastolic !== null)

  if (data.length === 0)
    return <div style={{ fontSize: 13, color: '#64748b', padding: '16px 0' }}>No BP data in medical records.</div>

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={['auto', 'auto']} unit=" mmHg" />
        <Tooltip
          contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8 }}
          labelStyle={{ color: '#e2e8f0' }}
          formatter={(v, name) => [`${v} mmHg`, name === 'systolic' ? 'Systolic' : 'Diastolic']}
        />
        <Legend formatter={val => val === 'systolic' ? 'Systolic' : 'Diastolic'} wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
        <Line type="monotone" dataKey="systolic" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} connectNulls />
        <Line type="monotone" dataKey="diastolic" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4' }} activeDot={{ r: 5 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Field helper ──────────────────────────────────────────────────────────
function Field({ label, value, name, type = 'text', options, onChange, disabled }) {
  const inputStyle = {
    width: '100%', padding: '8px 10px',
    background: disabled ? '#0a0d14' : '#0f1117',
    border: '1px solid #2a3347', borderRadius: 6,
    color: disabled ? '#475569' : '#e2e8f0',
    fontSize: 13, outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {options ? (
        <select name={name} value={value ?? ''} onChange={onChange} disabled={disabled} style={{ ...inputStyle, cursor: disabled ? 'default' : 'pointer' }}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} name={name} value={value ?? ''} onChange={onChange} disabled={disabled} style={inputStyle} />
      )}
    </div>
  )
}

// ── Edit Form ─────────────────────────────────────────────────────────────
function computeAge(dob) {
  if (!dob) return null
  const born = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - born.getFullYear()
  if (
    today.getMonth() < born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())
  ) age--
  return age
}

function EditPatientForm({ patient, onSave, onCancel }) {
  const [form, setForm] = useState({
    first_name: patient.first_name || '',
    last_name: patient.last_name || '',
    date_of_birth: patient.date_of_birth || '',
    gender: patient.gender || 'M',
    email: patient.email || '',
    phone: patient.phone || '',
    blood_pressure_systolic: patient.blood_pressure_systolic ?? '',
    blood_pressure_diastolic: patient.blood_pressure_diastolic ?? '',
    heart_rate: patient.heart_rate ?? '',
    glucose_level: patient.glucose_level ?? '',
    bmi: patient.bmi ?? '',
    cholesterol: patient.cholesterol ?? '',
    is_smoker: patient.is_smoker ?? false,
    is_diabetic: patient.is_diabetic ?? false,
    has_hypertension: patient.has_hypertension ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Live age preview computed from the form's date_of_birth
  const previewAge = computeAge(form.date_of_birth)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  // Prevent year from exceeding 4 digits in date input
  const handleDateKeyDown = (e) => {
    const input = e.target
    const val = input.value // format: YYYY-MM-DD
    const year = val.split('-')[0] || ''
    const cursorPos = input.selectionStart

    // If cursor is in the year section (positions 0-3) and year already has 4 digits
    // block any digit key that would make it 5+
    if (cursorPos <= 4 && year.length >= 4) {
      const isDigit = e.key >= '0' && e.key <= '9'
      const isNavKey = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'].includes(e.key)
      if (isDigit && !isNavKey) {
        e.preventDefault()
      }
    }
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = { ...form }
      ;['blood_pressure_systolic','blood_pressure_diastolic','heart_rate','glucose_level','bmi','cholesterol'].forEach(k => {
        if (payload[k] !== '' && payload[k] !== null) payload[k] = parseFloat(payload[k])
        else payload[k] = null
      })
      const res = await updatePatient(patient.id, payload)
      // Merge computed age into the returned data so the modal updates instantly
      onSave({ ...res.data, age: computeAge(payload.date_of_birth) })
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const sectionLabel = (text) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 10 }}>
      {text}
    </div>
  )

  return (
    <div>
      {sectionLabel('Personal Info')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="First Name" name="first_name" value={form.first_name} onChange={handleChange} />
        <Field label="Last Name" name="last_name" value={form.last_name} onChange={handleChange} />

        {/* Date of Birth with live age preview and year cap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Date of Birth
          </label>
          <input
            type="date"
            name="date_of_birth"
            value={form.date_of_birth}
            onChange={(e) => {
              const val = e.target.value // always "YYYY-MM-DD"
              // Block years longer than 4 digits
              if (val) {
                const year = val.split('-')[0]
                if (year.length > 4) return
              }
              handleChange(e)
            }}
            style={{
              padding: '8px 10px', background: '#0f1117',
              border: '1px solid #2a3347', borderRadius: 6,
              color: '#e2e8f0', fontSize: 13,
              outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
            }}
          />
          {previewAge !== null && (
            <span style={{ fontSize: 11, color: '#3b82f6' }}>
              Age: {previewAge} years old
            </span>
          )}
        </div>

        <Field label="Gender" name="gender" value={form.gender} onChange={handleChange} options={[
          { value: 'M', label: 'Male' },
          { value: 'F', label: 'Female' },
          { value: 'O', label: 'Other' },
        ]} />
        <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} />
        <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} />
      </div>

      {sectionLabel('Health Metrics')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Field label="Systolic BP (mmHg)" name="blood_pressure_systolic" type="number" value={form.blood_pressure_systolic} onChange={handleChange} />
        <Field label="Diastolic BP (mmHg)" name="blood_pressure_diastolic" type="number" value={form.blood_pressure_diastolic} onChange={handleChange} />
        <Field label="Heart Rate (bpm)" name="heart_rate" type="number" value={form.heart_rate} onChange={handleChange} />
        <Field label="Glucose (mg/dL)" name="glucose_level" type="number" value={form.glucose_level} onChange={handleChange} />
        <Field label="BMI" name="bmi" type="number" value={form.bmi} onChange={handleChange} />
        <Field label="Cholesterol (mg/dL)" name="cholesterol" type="number" value={form.cholesterol} onChange={handleChange} />
      </div>

      {sectionLabel('Lifestyle')}
      <div style={{ display: 'flex', gap: 24 }}>
        {[
          { label: 'Smoker', name: 'is_smoker' },
          { label: 'Diabetic', name: 'is_diabetic' },
          { label: 'Hypertension', name: 'has_hypertension' },
        ].map(({ label, name }) => (
          <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#94a3b8' }}>
            <input
              type="checkbox"
              name={name}
              checked={form[name]}
              onChange={handleChange}
              style={{ width: 15, height: 15, accentColor: '#3b82f6', cursor: 'pointer' }}
            />
            {label}
          </label>
        ))}
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: '#7f1d1d', borderRadius: 8, color: '#fca5a5', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', background: '#2563eb', border: 'none',
            borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            fontFamily: 'inherit',
          }}
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: '9px 18px', background: 'transparent',
            border: '1px solid #2a3347', borderRadius: 8,
            color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Delete Confirm ────────────────────────────────────────────────────────
function DeleteConfirm({ patient, onConfirm, onCancel }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deletePatient(patient.id)
      onConfirm()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div style={{
      background: '#1a0f0f', border: '1px solid #7f1d1d',
      borderRadius: 10, padding: 20, marginTop: 16,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fca5a5', marginBottom: 6 }}>
            Delete {patient.first_name} {patient.last_name}?
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
            This will permanently remove the patient and all associated records. This action cannot be undone.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '8px 16px', background: '#dc2626', border: 'none',
                borderRadius: 7, color: 'white', fontSize: 13, fontWeight: 600,
                cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1,
                fontFamily: 'inherit',
              }}
            >
              {deleting ? 'Deleting...' : 'Yes, delete'}
            </button>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 16px', background: 'transparent',
                border: '1px solid #2a3347', borderRadius: 7,
                color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Patient Modal ─────────────────────────────────────────────────────────
function PatientModal({ patientId, onClose, onPatientUpdated, onPatientDeleted }) {
  const [patient, setPatient] = useState(null)
  const [analyses, setAnalyses] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('view') // 'view' | 'edit' | 'delete'

  useEffect(() => {
    Promise.all([
      getPatient(patientId),
      getPatientAnalyses(patientId),
      getRecords({ patient_id: patientId }),
    ])
      .then(([pRes, aRes, rRes]) => {
        setPatient(pRes.data)
        setAnalyses(aRes.data.analyses || [])
        setRecords(rRes.data.results || rRes.data || [])
      })
      .catch(() => setError('Failed to load patient data'))
      .finally(() => setLoading(false))
  }, [patientId])

  const handleSaved = (updated) => {
    setPatient(updated)
    setMode('view')
    onPatientUpdated?.(updated)
  }

  const handleDeleted = () => {
    onPatientDeleted?.(patientId)
    onClose()
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        overflowY: 'auto', padding: '40px 24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#161b27', borderRadius: 12, width: '100%', maxWidth: 780,
          border: '1px solid #2a3347', padding: 28,
          margin: '0 auto',          
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            {loading
              ? <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>Loading...</div>
              : patient && (
                <>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>
                    {mode === 'edit' ? 'Edit Patient' : `${patient.first_name} ${patient.last_name}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, display: 'flex', gap: 12 }}>
                    <span>Age {patient.age ?? '—'}</span>
                    <span>·</span>
                    <span>{patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}</span>
                    {patient.email && <><span>·</span><span>{patient.email}</span></>}
                    {patient.phone && <><span>·</span><span>{patient.phone}</span></>}
                  </div>
                </>
              )
            }
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {patient && mode === 'view' && (
              <>
                <RiskBadge risk={patient.risk_level} />
                <button
                  onClick={() => setMode('edit')}
                  title="Edit patient"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', background: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.3)', borderRadius: 7,
                    color: '#3b82f6', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => setMode('delete')}
                  title="Delete patient"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7,
                    color: '#ef4444', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </>
            )}
            {mode !== 'view' && (
              <button
                onClick={() => setMode('view')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
              >
                ← Back
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}

        {/* Edit Mode */}
        {patient && mode === 'edit' && (
          <EditPatientForm
            patient={patient}
            onSave={handleSaved}
            onCancel={() => setMode('view')}
          />
        )}

        {/* Delete Mode */}
        {patient && mode === 'delete' && (
          <DeleteConfirm
            patient={patient}
            onConfirm={handleDeleted}
            onCancel={() => setMode('view')}
          />
        )}

        {/* View Mode */}
        {patient && mode === 'view' && (
          <>
            {/* Health Metrics */}
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              Health Metrics
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              <MetricCard label="Systolic BP"  value={patient.blood_pressure_systolic}  unit="mmHg" color="#3b82f6" />
              <MetricCard label="Diastolic BP" value={patient.blood_pressure_diastolic} unit="mmHg" color="#06b6d4" />
              <MetricCard label="Heart Rate"   value={patient.heart_rate}               unit="bpm"  color="#f59e0b" />
              <MetricCard label="Glucose"      value={patient.glucose_level}            unit="mg/dL" color="#10b981" />
              <MetricCard label="BMI"          value={patient.bmi}                      unit=""     color="#8b5cf6" />
              <MetricCard label="Cholesterol"  value={patient.cholesterol}              unit="mg/dL" color="#ef4444" />
            </div>

            {/* Lifestyle Flags */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {[
                { label: 'Smoker',       val: patient.is_smoker },
                { label: 'Diabetic',     val: patient.is_diabetic },
                { label: 'Hypertension', val: patient.has_hypertension },
              ].map(({ label, val }) => (
                <span key={label} style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4,
                  background: val ? '#7f1d1d' : '#1e2535',
                  color: val ? '#fca5a5' : '#475569',
                  border: `1px solid ${val ? '#ef444440' : '#2a3347'}`,
                }}>
                  {label}: {val ? 'Yes' : 'No'}
                </span>
              ))}
            </div>

            {/* BP Trend */}
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              Blood Pressure Trend ({records.length} visits)
            </div>
            <div style={{ background: '#0f1117', borderRadius: 8, padding: '16px', marginBottom: 24 }}>
              <BPTrendChart records={records} />
            </div>

            {/* Analysis History */}
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              Analysis History ({analyses.length})
            </div>
            {analyses.length === 0 ? (
              <div style={{ fontSize: 13, color: '#64748b', padding: '16px 0' }}>No analysis results yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a3347' }}>
                    {['Model', 'Risk Label', 'Confidence', 'Date', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analyses.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #1e2535' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#1e2535', color: '#06b6d4', border: '1px solid #2a3347' }}>
                          {a.model_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {a.risk_label ? <RiskBadge risk={a.risk_label} /> : <span style={{ color: '#475569' }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 13, color: '#e2e8f0' }}>
                        {a.confidence != null ? `${(a.confidence * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#475569' }}>
                        {new Date(a.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#475569' }}>
                        {a.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>,
  document.body
  )
}

function exportCSV(data, filename) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h] ?? ''
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function PatientsPage() {
  const [patients, setPatients] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const PAGE_SIZE = 10
  const [sortKey, setSortKey] = useState('')
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortedPatients = [...patients].sort((a, b) => {
    if (!sortKey) return 0
    const aVal = a[sortKey] ?? ''; const bVal = b[sortKey] ?? ''
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const loadPatients = () => {
    setLoading(true)
    const params = { page, page_size: PAGE_SIZE }
    if (search) params.search = search
    if (riskFilter) params.risk_level = riskFilter
    getPatients(params)
      .then(res => { setPatients(res.data.results || res.data); setCount(res.data.count || 0) })
      .catch(err => setError(err.userMessage || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPatients() }, [page, search, riskFilter])

  const totalPages = Math.ceil(count / PAGE_SIZE)

  const handlePatientUpdated = (updated) => {
    setPatients(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
  }

  const handlePatientDeleted = (id) => {
    setPatients(prev => prev.filter(p => p.id !== id))
    setCount(c => c - 1)
    setSelectedPatientId(null)
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Patients</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{count} total patients in the system</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{
              width: '100%', padding: '9px 12px 9px 34px',
              background: '#161b27', border: '1px solid #2a3347',
              borderRadius: 8, color: '#e2e8f0', fontSize: 13,
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>
        <select
          value={riskFilter}
          onChange={e => { setRiskFilter(e.target.value); setPage(1) }}
          style={{
            padding: '9px 14px', background: '#161b27', border: '1px solid #2a3347',
            borderRadius: 8, color: riskFilter ? '#e2e8f0' : '#64748b',
            fontSize: 13, outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="">All Risk Levels</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>

        <button
          onClick={() => exportCSV(
            sortedPatients.map(p => ({
              name: `${p.first_name} ${p.last_name}`, age: p.age, gender: p.gender,
              bmi: p.bmi, risk_level: p.risk_level, glucose: p.glucose_level,
              systolic_bp: p.blood_pressure_systolic, diastolic_bp: p.blood_pressure_diastolic,
              heart_rate: p.heart_rate, cholesterol: p.cholesterol,
              is_smoker: p.is_smoker, is_diabetic: p.is_diabetic, has_hypertension: p.has_hypertension,
            })),
            `patients_${new Date().toISOString().slice(0,10)}.csv`
          )}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', background: '#161b27', border: '1px solid #2a3347',
            borderRadius: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a3347'; e.currentTarget.style.color = '#94a3b8' }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading patients...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Error: {error}</div>
        ) : patients.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No patients found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a3347' }}>
                {[
                  { label: 'Name', key: 'first_name' },
                  { label: 'Age', key: 'age' },
                  { label: 'Gender', key: 'gender' },
                  { label: 'BMI', key: 'bmi' },
                  { label: 'Risk Level', key: 'risk_level' },
                  { label: 'Status', key: '' },
                ].map(({ label, key }) => (
                  <th
                    key={label}
                    onClick={() => key && handleSort(key)}
                    style={{
                      padding: '12px 16px', textAlign: 'left',
                      fontSize: 11, fontWeight: 600, color: sortKey === key ? '#3b82f6' : '#64748b',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      cursor: key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                    {key && (
                      <span style={{ marginLeft: 4, opacity: sortKey === key ? 1 : 0.3 }}>
                        {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPatients.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  style={{
                    borderBottom: '1px solid #1e2535',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#3b82f6' }}>{p.first_name} {p.last_name}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{p.age}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{p.gender}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{p.bmi ?? '—'}</td>
                  <td style={{ padding: '12px 16px' }}><RiskBadge risk={p.risk_level} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: p.is_active ? '#10b981' : '#64748b',
                      background: p.is_active ? '#064e3b' : '#1e2535',
                      padding: '2px 8px', borderRadius: 4,
                    }}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '6px 10px', background: '#161b27', border: '1px solid #2a3347', borderRadius: 6, color: page === 1 ? '#475569' : '#94a3b8', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
          ><ChevronLeft size={14} /></button>
          <span style={{ fontSize: 12, color: '#64748b' }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ padding: '6px 10px', background: '#161b27', border: '1px solid #2a3347', borderRadius: 6, color: page === totalPages ? '#475569' : '#94a3b8', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
          ><ChevronRight size={14} /></button>
        </div>
      )}

      {/* Patient Modal */}
      {selectedPatientId && (
        <PatientModal
          patientId={selectedPatientId}
          onClose={() => setSelectedPatientId(null)}
          onPatientUpdated={handlePatientUpdated}
          onPatientDeleted={handlePatientDeleted}
        />
      )}
    </div>
  )
}