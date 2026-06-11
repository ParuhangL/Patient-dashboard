import { useEffect, useState } from 'react'
import { getPatients, getAllPatients, getPatient, getRecords, getPatientAnalyses, updatePatient, deletePatient, createRecord, analysePatient, bulkDeletePatients } from '../api'
import { Search, ChevronLeft, ChevronRight, X, Download, Pencil, Trash2, Save, AlertTriangle, PlusCircle, RefreshCw, FileText } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { createPortal } from 'react-dom'
import { useToast } from '../App'

const RISK_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' }
const RISK_BG =     { LOW: '#052e16', MEDIUM: '#431407', HIGH: '#450a0a' }

function RiskBadge({ risk }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
      background: RISK_BG[risk] || '#1e2535',
      color: RISK_COLORS[risk] || '#64748b',
      border: `1px solid ${RISK_COLORS[risk] || '#2a3347'}30`,
    }}>
      {risk}
    </span>
  )
}

function MetricCard({ label, value, unit, color = '#3b82f6' }) {
  return (
    <div style={{ background: '#0f1117', borderRadius: 6, padding: '10px 14px' }}>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color }}>
        {value ?? '—'}{value != null && unit && <span style={{ fontSize: 11, fontWeight: 400, color: '#475569', marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  )
}

function BPTrendChart({ records }) {
  if (!records || records.length === 0)
    return <div style={{ fontSize: 13, color: '#475569', padding: '16px 0' }}>No medical records available.</div>

  const data = [...records]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((r, i) => ({
      date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
            (records.filter(x => x.visit_date === r.visit_date).length > 1 ? ` #${i + 1}` : ''),
      Systolic: r.blood_pressure_systolic ?? null,
      Diastolic: r.blood_pressure_diastolic ?? null,
    }))
    .filter(r => r.Systolic !== null || r.Diastolic !== null)

  if (data.length === 0)
    return <div style={{ fontSize: 13, color: '#475569', padding: '16px 0' }}>No BP data in records.</div>

  const allValues = data.flatMap(d => [d.Systolic, d.Diastolic]).filter(v => v !== null)
  const minVal = Math.max(40, Math.floor(Math.min(...allValues) / 10) * 10 - 10)
  const maxVal = Math.ceil(Math.max(...allValues) / 10) * 10 + 10

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, paddingLeft: 4 }}>
        {[['#3b82f6', 'Systolic'], ['#06b6d4', 'Diastolic']].map(([color, label]) => (
          <span key={label} style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 20, height: 2, background: color, borderRadius: 2 }} />
            {label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={[minVal, maxVal]} tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#e2e8f0', marginBottom: 4 }}
            formatter={(value, name) => [`${value} mmHg`, name]}
          />
          <Line type="monotone" dataKey="Systolic" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
          <Line type="monotone" dataKey="Diastolic" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4', strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function RiskTrendChart({ analyses }) {
  const RISK_SCORE = { LOW: 1, MEDIUM: 2, HIGH: 3 }
  const RISK_COLOR = { 1: '#10b981', 2: '#f59e0b', 3: '#ef4444' }
  const RISK_LABEL = { 1: 'Low', 2: 'Mid', 3: 'High' }
  const RISK_LABEL_FULL = { 1: 'LOW', 2: 'MEDIUM', 3: 'HIGH' }

  const sorted = [...analyses]
    .filter(a => a.risk_label && a.model_type === 'rule_based')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const dateCounts = {}
  sorted.forEach(a => {
    const d = new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    dateCounts[d] = (dateCounts[d] || 0) + 1
  })
  const dateIndex = {}
  const data = sorted.map(a => {
    const d = new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    dateIndex[d] = (dateIndex[d] || 0) + 1
    return { date: dateCounts[d] > 1 ? `${d} #${dateIndex[d]}` : d, score: RISK_SCORE[a.risk_label] ?? null }
  })

  if (data.length < 2)
    return <div style={{ fontSize: 13, color: '#475569', padding: '12px 0' }}>Not enough analyses to show a trend.</div>

  return (
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={data} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis domain={[0.5, 3.5]} ticks={[1, 2, 3]} width={32} tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => RISK_LABEL[v] ?? ''} />
        <Tooltip
          contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 6 }}
          labelStyle={{ color: '#e2e8f0' }}
          formatter={v => [RISK_LABEL_FULL[v], 'Risk']}
        />
        <Line
          type="stepAfter" dataKey="score" stroke="#8b5cf6" strokeWidth={2} connectNulls
          dot={(props) => {
            const { cx, cy, payload } = props
            return <circle key={payload.date} cx={cx} cy={cy} r={4} fill={RISK_COLOR[payload.score]} stroke="#161b27" strokeWidth={2} />
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function exportPatientPDF(patient, records, analyses) {
  const riskColor = patient.risk_level === 'HIGH' ? '#ef4444' : patient.risk_level === 'MEDIUM' ? '#f59e0b' : '#10b981'
  const riskBg    = patient.risk_level === 'HIGH' ? '#fee2e2' : patient.risk_level === 'MEDIUM' ? '#fef3c7' : '#d1fae5'
  const fmt = (v, unit = '') => v != null ? `${v}${unit ? ' ' + unit : ''}` : '—'

  const metricsRows = [
    ['Systolic BP', fmt(patient.blood_pressure_systolic, 'mmHg'), 'Diastolic BP', fmt(patient.blood_pressure_diastolic, 'mmHg')],
    ['Heart Rate',  fmt(patient.heart_rate, 'bpm'),               'Glucose',      fmt(patient.glucose_level, 'mg/dL')],
    ['BMI',         fmt(patient.bmi, 'kg/m²'),                    'Cholesterol',  fmt(patient.cholesterol, 'mg/dL')],
  ]

  const bpRecords = [...records]
    .sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date))
    .filter(r => r.blood_pressure_systolic != null || r.blood_pressure_diastolic != null)

  const buildBPSparkline = () => {
    if (bpRecords.length < 2) return ''
    const W = 500, H = 120, PAD = 20
    const sysVals = bpRecords.map(r => r.blood_pressure_systolic ?? 0)
    const diaVals = bpRecords.map(r => r.blood_pressure_diastolic ?? 0)
    const allVals = [...sysVals, ...diaVals].filter(v => v > 0)
    const minV = Math.min(...allVals) - 10
    const maxV = Math.max(...allVals) + 10
    const xStep = (W - PAD * 2) / (bpRecords.length - 1)
    const yScale = v => H - PAD - ((v - minV) / (maxV - minV)) * (H - PAD * 2)
    const polyline = (vals, color) => {
      const pts = vals.map((v, i) => `${PAD + i * xStep},${yScale(v)}`).join(' ')
      return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>`
    }
    const xLabels = bpRecords.map((r, i) =>
      `<text x="${PAD + i * xStep}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#888">
        ${new Date(r.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </text>`
    ).join('')
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:8px 0">
      <rect width="${W}" height="${H}" fill="#f8fafc" rx="4"/>
      ${polyline(sysVals, '#3b82f6')}${polyline(diaVals, '#06b6d4')}
      ${xLabels}
      <text x="${PAD}" y="14" font-size="9" fill="#3b82f6">Systolic</text>
      <text x="${PAD + 56}" y="14" font-size="9" fill="#06b6d4">Diastolic</text>
    </svg>`
  }

  const visitNotesRows = [...records]
    .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))
    .filter(r => r.notes || r.diagnosis)
    .map(r => `<tr>
      <td style="padding:8px 10px;font-size:12px;color:#475569">${new Date(r.visit_date).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}</td>
      <td style="padding:8px 10px;font-size:12px">${r.diagnosis || '—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#475569">${r.notes || '—'}</td>
    </tr>`).join('')

  const analysisRows = analyses.map(a => {
    const rc = a.risk_label === 'HIGH' ? '#ef4444' : a.risk_label === 'MEDIUM' ? '#f59e0b' : '#10b981'
    const rb = a.risk_label === 'HIGH' ? '#fee2e2' : a.risk_label === 'MEDIUM' ? '#fef3c7' : '#d1fae5'
    const detail = a.model_type === 'linear_regression' && a.result?.predicted_systolic_bp != null
      ? `SBP: ${a.result.predicted_systolic_bp} mmHg${a.result?.predicted_diastolic_bp != null ? ` · DBP: ${a.result.predicted_diastolic_bp} mmHg` : ''}`
      : a.model_type === 'logistic' && a.result?.prediction ? a.result.prediction
      : a.model_type === 'kmeans' && a.result?.profile ? a.result.profile
      : '—'
    return `<tr>
      <td style="padding:8px 10px;font-size:12px">${a.model_type.replace('_',' ').toUpperCase()}</td>
      <td style="padding:8px 10px">${a.risk_label ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;background:${rb};color:${rc}">${a.risk_label}</span>` : '—'}</td>
      <td style="padding:8px 10px;font-size:12px">${a.confidence != null ? `${(a.confidence * 100).toFixed(0)}%` : '—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#475569">${detail}</td>
      <td style="padding:8px 10px;font-size:12px;color:#475569">${new Date(a.created_at).toLocaleDateString()}</td>
      <td style="padding:8px 10px;font-size:12px;color:#475569">${a.notes || '—'}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Patient Report — ${patient.first_name} ${patient.last_name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;background:white;padding:32px 40px}
    h2{font-size:18px;font-weight:700;margin-bottom:4px}
    h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin:24px 0 10px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #e2e8f0;margin-bottom:20px}
    .meta{font-size:12px;color:#64748b;margin-top:4px}
    .risk{font-size:12px;font-weight:700;padding:4px 14px;border-radius:6px;background:${riskBg};color:${riskColor}}
    .grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
    .cell{padding:10px 14px;border-bottom:1px solid #e2e8f0}
    .cell:nth-last-child(-n+2){border-bottom:none}
    .clabel{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px}
    .cval{font-size:16px;font-weight:700}
    .flags{display:flex;gap:8px;flex-wrap:wrap}
    .flag{font-size:11px;font-weight:600;padding:3px 10px;border-radius:4px}
    .fy{background:#fee2e2;color:#dc2626}.fn{background:#f1f5f9;color:#94a3b8}
    table{width:100%;border-collapse:collapse}
    thead tr{background:#f8fafc}
    th{padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#64748b;border-bottom:1px solid #e2e8f0}
    td{border-bottom:1px solid #f1f5f9}
    tr:last-child td{border-bottom:none}
    .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
  </style></head><body>
  <div class="header">
    <div>
      <h2>${patient.first_name} ${patient.last_name}</h2>
      <div class="meta">Age ${patient.age ?? '—'} &nbsp;·&nbsp; ${patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}${patient.email ? ` &nbsp;·&nbsp; ${patient.email}` : ''}${patient.phone ? ` &nbsp;·&nbsp; ${patient.phone}` : ''}</div>
    </div>
    <div style="text-align:right">
      <div class="risk">${patient.risk_level ?? '—'} RISK</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:6px">Generated ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</div>
    </div>
  </div>
  <h3>Health Metrics</h3>
  <div class="grid">
    ${metricsRows.map(([l1,v1,l2,v2]) => `
      <div class="cell"><div class="clabel">${l1}</div><div class="cval">${v1}</div></div>
      <div class="cell"><div class="clabel">${l2}</div><div class="cval">${v2}</div></div>`).join('')}
  </div>
  <h3>Lifestyle</h3>
  <div class="flags">
    <span class="flag ${patient.is_smoker ? 'fy':'fn'}">Smoker: ${patient.is_smoker ? 'Yes':'No'}</span>
    <span class="flag ${patient.is_diabetic ? 'fy':'fn'}">Diabetic: ${patient.is_diabetic ? 'Yes':'No'}</span>
    <span class="flag ${patient.has_hypertension ? 'fy':'fn'}">Hypertension: ${patient.has_hypertension ? 'Yes':'No'}</span>
  </div>
  ${bpRecords.length > 1 ? `<h3>Blood Pressure Trend</h3>${buildBPSparkline()}` : ''}
  ${visitNotesRows ? `<h3>Visit Notes</h3><table><thead><tr><th>Date</th><th>Diagnosis</th><th>Notes</th></tr></thead><tbody>${visitNotesRows}</tbody></table>` : ''}
  ${analyses.length > 0 ? `<h3>Analysis History</h3><table><thead><tr><th>Model</th><th>Risk</th><th>Confidence</th><th>Detail</th><th>Date</th><th>Notes</th></tr></thead><tbody>${analysisRows}</tbody></table>` : ''}
  <div class="footer"><span>Patient Diagnostic Dashboard</span><span>Confidential — For clinical use only</span></div>
  </body></html>`

  const win = window.open('', '_blank', 'width=800,height=900')
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print() }
}

function Field({ label, value, name, type = 'text', options, onChange, disabled }) {
  const inputStyle = {
    width: '100%', padding: '8px 10px',
    background: disabled ? '#0a0d14' : '#0f1117',
    border: '1px solid #2a3347', borderRadius: 6,
    color: disabled ? '#475569' : '#e2e8f0',
    fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
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

function computeAge(dob) {
  if (!dob) return null
  const born = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - born.getFullYear()
  if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) age--
  return age
}

function EditPatientForm({ patient, onSave, onCancel, toast }) {
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
  const [touched, setTouched] = useState({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState(null)

  const today = new Date().toISOString().slice(0, 10)
  const previewAge = computeAge(form.date_of_birth)

  const VITALS_RULES = {
    blood_pressure_systolic:  { min: 60,  max: 250, label: 'Systolic BP' },
    blood_pressure_diastolic: { min: 40,  max: 150, label: 'Diastolic BP' },
    heart_rate:               { min: 30,  max: 220, label: 'Heart Rate' },
    glucose_level:            { min: 20,  max: 600, label: 'Glucose' },
    bmi:                      { min: 10,  max: 70,  label: 'BMI' },
    cholesterol:              { min: 50,  max: 500, label: 'Cholesterol' },
  }

  const validate = (name, value) => {
    switch (name) {
      case 'first_name':
      case 'last_name': {
        const label = name === 'first_name' ? 'First name' : 'Last name'
        if (!value.trim()) return `${label} is required.`
        if (value.trim().length > 50) return `${label} must be 50 characters or fewer.`
        if (!/^[a-zA-Z\s'\-]+$/.test(value)) return `${label} can only contain letters, spaces, hyphens, or apostrophes.`
        return ''
      }
      case 'date_of_birth': {
        if (!value) return 'Date of birth is required.'
        if (value >= today) return 'Date of birth must be in the past.'
        const age = computeAge(value)
        if (age > 120) return 'Age cannot exceed 120 years.'
        return ''
      }
      case 'email': {
        if (!value) return ''
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.'
        return ''
      }
      case 'phone': {
        if (!value) return ''
        if (!/^[0-9\s\+\-\(\)]+$/.test(value)) return 'Phone can only contain digits, spaces, +, -, or parentheses.'
        const digits = value.replace(/\D/g, '')
        if (digits.length < 7) return 'Phone number is too short.'
        if (digits.length > 15) return 'Phone number is too long.'
        return ''
      }
      default: {
        if (VITALS_RULES[name]) {
          if (value === '' || value === null) return ''
          const num = parseFloat(value)
          if (isNaN(num)) return 'Must be a number.'
          const { min, max, label } = VITALS_RULES[name]
          if (num < min || num > max) return `${label} must be between ${min} and ${max}.`
        }
        return ''
      }
    }
  }

  const getError = (name) => {
    if (!touched[name]) return ''
    return validate(name, form[name])
  }

  const handleBlur = (name) => setTouched(t => ({ ...t, [name]: true }))

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    if (name === 'date_of_birth' && value && value.split('-')[0].length > 4) return
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
    if (serverError) setServerError(null)
  }

  const isFormValid = () => {
    return Object.keys(form).every(name => {
      if (typeof form[name] === 'boolean') return true
      return validate(name, form[name]) === ''
    })
  }

  const handleSubmit = async () => {
    const allTouched = Object.keys(form).reduce((acc, k) => ({ ...acc, [k]: true }), {})
    setTouched(allTouched)
    if (!isFormValid()) return

    setSaving(true)
    setServerError(null)
    try {
      const payload = { ...form }
      Object.keys(VITALS_RULES).forEach(k => {
        payload[k] = payload[k] !== '' && payload[k] !== null ? parseFloat(payload[k]) : null
      })
      const res = await updatePatient(patient.id, payload)
      toast.success('Patient updated', `${payload.first_name} ${payload.last_name}'s record has been saved.`)
      onSave({ ...res.data, age: computeAge(payload.date_of_birth) })
    } catch (err) {
      const msg = err.response?.data ? JSON.stringify(err.response.data) : 'Failed to save changes.'
      setServerError(msg)
      toast.error('Save failed', msg)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = (name) => ({
    width: '100%', padding: '8px 10px',
    background: '#0f1117',
    border: `1px solid ${getError(name) ? '#ef4444' : '#2a3347'}`,
    borderRadius: 6, color: '#e2e8f0', fontSize: 13,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  })

  const sectionLabel = (text) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 10 }}>
      {text}
    </div>
  )

  const FieldError = ({ name }) => {
    const err = getError(name)
    return err ? <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2, display: 'block' }}>{err}</span> : null
  }

  const TextField = ({ label, name, type = 'text', placeholder = '' }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      <input
        type={type} name={name} value={form[name] ?? ''}
        onChange={handleChange}
        onBlur={() => handleBlur(name)}
        placeholder={placeholder}
        style={inputStyle(name)}
      />
      <FieldError name={name} />
    </div>
  )

  return (
    <div>
      {sectionLabel('Personal Info')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <TextField label="First Name *" name="first_name" />
        <TextField label="Last Name *"  name="last_name" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Date of Birth *</label>
          <input
            type="date" name="date_of_birth" value={form.date_of_birth}
            max={today}
            onChange={handleChange}
            onBlur={() => handleBlur('date_of_birth')}
            style={inputStyle('date_of_birth')}
          />
          {previewAge !== null && !getError('date_of_birth') && (
            <span style={{ fontSize: 11, color: '#3b82f6' }}>Age: {previewAge}</span>
          )}
          <FieldError name="date_of_birth" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Gender</label>
          <select
            name="gender" value={form.gender}
            onChange={handleChange}
            style={{ ...inputStyle('gender'), cursor: 'pointer' }}
          >
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="O">Other</option>
          </select>
        </div>

        <TextField label="Email"  name="email" type="email" placeholder="you@example.com" />
        <TextField label="Phone"  name="phone" placeholder="+1 555 000 0000" />
      </div>

      {sectionLabel('Health Metrics')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Systolic BP (mmHg)',  name: 'blood_pressure_systolic',  placeholder: '60–250' },
          { label: 'Diastolic BP (mmHg)', name: 'blood_pressure_diastolic', placeholder: '40–150' },
          { label: 'Heart Rate (bpm)',    name: 'heart_rate',               placeholder: '30–220' },
          { label: 'Glucose (mg/dL)',     name: 'glucose_level',            placeholder: '20–600' },
          { label: 'BMI',                 name: 'bmi',                      placeholder: '10–70' },
          { label: 'Cholesterol (mg/dL)', name: 'cholesterol',              placeholder: '50–500' },
        ].map(({ label, name, placeholder }) => (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
            <input
              type="number" name={name} value={form[name] ?? ''}
              onChange={handleChange}
              onBlur={() => handleBlur(name)}
              placeholder={placeholder}
              step="0.1"
              style={inputStyle(name)}
            />
            <FieldError name={name} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, padding: '8px 12px', background: '#0f1f10', border: '1px solid #1a3a1a', borderRadius: 6, fontSize: 12, color: '#86efac' }}>
        Editing vitals here updates the patient's baseline. To track changes over time, use <strong>Add Visit</strong>.
      </div>

      {sectionLabel('Lifestyle')}
      <div style={{ display: 'flex', gap: 24 }}>
        {[{ label: 'Smoker', name: 'is_smoker' }, { label: 'Diabetic', name: 'is_diabetic' }, { label: 'Hypertension', name: 'has_hypertension' }].map(({ label, name }) => (
          <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#94a3b8' }}>
            <input
              type="checkbox" name={name} checked={form[name]}
              onChange={handleChange}
              style={{ width: 15, height: 15, accentColor: '#3b82f6', cursor: 'pointer' }}
            />
            {label}
          </label>
        ))}
      </div>

      {serverError && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#450a0a', borderRadius: 6, color: '#fca5a5', fontSize: 13 }}>
          {serverError}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button
          onClick={handleSubmit} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}
        >
          <Save size={13} />{saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={onCancel} disabled={saving}
          style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #2a3347', borderRadius: 6, color: '#64748b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function AddVisitForm({ patientId, onSaved, onCancel, toast }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    visit_date: today, diagnosis: '', notes: '',
    blood_pressure_systolic: '', blood_pressure_diastolic: '',
    heart_rate: '', glucose_level: '', bmi: '', temperature: '',
  })
  const [touched, setTouched] = useState({})
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState({})

  const VITALS_RULES = {
    blood_pressure_systolic:  { min: 60,  max: 250, label: 'Systolic BP' },
    blood_pressure_diastolic: { min: 40,  max: 150, label: 'Diastolic BP' },
    heart_rate:               { min: 30,  max: 220, label: 'Heart Rate' },
    glucose_level:            { min: 20,  max: 600, label: 'Glucose' },
    bmi:                      { min: 10,  max: 70,  label: 'BMI' },
    temperature:              { min: 34,  max: 42,  label: 'Temperature' },
  }

  const validate = (name, value) => {
    if (name === 'visit_date') {
      if (!value) return 'Visit date is required.'
      if (value > today) return 'Visit date cannot be in the future.'
      return ''
    }
    if (name === 'diagnosis') {
      if (value.length > 200) return 'Max 200 characters.'
      if (value && !/^[a-zA-Z0-9\s\-,.()/]+$/.test(value)) return 'Invalid characters in diagnosis.'
      return ''
    }
    if (name === 'notes') {
      if (value.length > 1000) return 'Max 1000 characters.'
      return ''
    }
    if (VITALS_RULES[name]) {
      if (value === '' || value === null) return ''
      const num = parseFloat(value)
      if (isNaN(num)) return 'Must be a number.'
      const { min, max, label } = VITALS_RULES[name]
      if (num < min || num > max) return `${label} must be between ${min} and ${max}.`
      return ''
    }
    return ''
  }

  const getError = (name) => {
    if (!touched[name]) return ''
    return serverErrors[name] || validate(name, form[name])
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (serverErrors[name]) setServerErrors(prev => { const n = { ...prev }; delete n[name]; return n })
  }

  const handleBlur = (name) => setTouched(t => ({ ...t, [name]: true }))

  const isFormValid = () => Object.keys(form).every(name => validate(name, form[name]) === '')

  const handleSubmit = async () => {
    const allTouched = Object.keys(form).reduce((acc, k) => ({ ...acc, [k]: true }), {})
    setTouched(allTouched)
    if (!isFormValid()) return

    setSaving(true)
    setServerErrors({})
    try {
      const payload = { ...form, patient: patientId }
      Object.keys(VITALS_RULES).forEach(k => {
        payload[k] = payload[k] !== '' ? parseFloat(payload[k]) : null
      })
      const res = await createRecord(payload)
      toast.success('Visit recorded', `Visit on ${form.visit_date} has been saved.`)
      onSaved(res.data)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const mapped = {}
        Object.entries(data).forEach(([key, msgs]) => {
          mapped[key] = Array.isArray(msgs) ? msgs.join(' ') : String(msgs)
        })
        setServerErrors(mapped)
        setTouched(t => ({ ...t, ...Object.keys(mapped).reduce((acc, k) => ({ ...acc, [k]: true }), {}) }))
        toast.error('Save failed', 'Please fix the errors and try again.')
      } else {
        setServerErrors({ non_field_errors: 'Failed to save visit.' })
        toast.error('Save failed', 'Failed to save visit.')
      }
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = (name) => ({
    width: '100%', padding: '8px 10px', background: '#0f1117',
    border: `1px solid ${getError(name) ? '#ef4444' : '#2a3347'}`,
    borderRadius: 6, color: '#e2e8f0', fontSize: 13,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  })

  const sectionLabel = (text) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 10 }}>
      {text}
    </div>
  )

  const FieldError = ({ name }) => {
    const err = getError(name)
    return err ? <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2, display: 'block' }}>{err}</span> : null
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 16, padding: '8px 12px', background: '#0f1117', borderRadius: 6, borderLeft: '3px solid #2a3347' }}>
        Vitals recorded here update the patient's baseline. Use <strong style={{ color: '#e2e8f0' }}>Edit Patient</strong> to update cholesterol.
      </div>

      {sectionLabel('Visit Details')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Visit Date <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="date" name="visit_date" value={form.visit_date}
            max={today}
            onChange={handleChange}
            onBlur={() => handleBlur('visit_date')}
            style={inputStyle('visit_date')}
          />
          <FieldError name="visit_date" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Diagnosis</label>
          <input
            type="text" name="diagnosis" value={form.diagnosis}
            onChange={handleChange}
            onBlur={() => handleBlur('diagnosis')}
            placeholder="e.g. Hypertension"
            style={inputStyle('diagnosis')}
          />
          <FieldError name="diagnosis" />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
        <label style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Clinical Notes
          {form.notes.length > 0 && (
            <span style={{ float: 'right', fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: form.notes.length > 1000 ? '#ef4444' : '#334155' }}>
              {form.notes.length}/1000
            </span>
          )}
        </label>
        <textarea
          name="notes" value={form.notes}
          onChange={handleChange}
          onBlur={() => handleBlur('notes')}
          rows={3}
          placeholder="Observations, medications prescribed…"
          style={{ ...inputStyle('notes'), resize: 'vertical', lineHeight: 1.5 }}
        />
        <FieldError name="notes" />
      </div>

      {sectionLabel('Vitals at This Visit')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { label: 'Systolic BP (mmHg)',  name: 'blood_pressure_systolic',  placeholder: '60–250' },
          { label: 'Diastolic BP (mmHg)', name: 'blood_pressure_diastolic', placeholder: '40–150' },
          { label: 'Heart Rate (bpm)',    name: 'heart_rate',               placeholder: '30–220' },
          { label: 'Glucose (mg/dL)',     name: 'glucose_level',            placeholder: '20–600' },
          { label: 'BMI',                 name: 'bmi',                      placeholder: '10–70' },
          { label: 'Temperature (°C)',    name: 'temperature',              placeholder: '34–42' },
        ].map(({ label, name, placeholder }) => (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
            <input
              type="number" name={name} value={form[name]}
              onChange={handleChange}
              onBlur={() => handleBlur(name)}
              placeholder={placeholder}
              step="0.1"
              style={inputStyle(name)}
            />
            <FieldError name={name} />
          </div>
        ))}
      </div>

      {serverErrors.non_field_errors && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#450a0a', borderRadius: 6, color: '#fca5a5', fontSize: 13 }}>
          {serverErrors.non_field_errors}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button
          onClick={handleSubmit} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#059669', border: 'none', borderRadius: 6, color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}
        >
          <Save size={13} />{saving ? 'Saving…' : 'Save Visit'}
        </button>
        <button
          onClick={onCancel} disabled={saving}
          style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #2a3347', borderRadius: 6, color: '#64748b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function DeleteConfirm({ patient, onConfirm, onCancel, toast }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deletePatient(patient.id)
      toast.success('Patient deleted', `${patient.first_name} ${patient.last_name} has been removed.`)
      onConfirm()
    } catch {
      toast.error('Delete failed', 'Could not delete patient. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div style={{ background: '#1a0a0a', border: '1px solid #450a0a', borderRadius: 8, padding: 18, marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fca5a5', marginBottom: 4 }}>Delete {patient.first_name} {patient.last_name}?</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>This will permanently remove the patient and all associated records.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDelete} disabled={deleting} style={{ padding: '7px 14px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 13, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1, fontFamily: 'inherit' }}>
              {deleting ? 'Deleting...' : 'Yes, delete'}
            </button>
            <button onClick={onCancel} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #2a3347', borderRadius: 6, color: '#64748b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PatientModal({ patientId, onClose, onPatientUpdated, onPatientDeleted, toast }) {
  const [patient, setPatient] = useState(null)
  const [analyses, setAnalyses] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('view')
  const [reanalysing, setReanalysing] = useState(false)

  useEffect(() => {
    Promise.all([getPatient(patientId), getPatientAnalyses(patientId), getRecords({ patient_id: patientId })])
      .then(([pRes, aRes, rRes]) => {
        setPatient(pRes.data)
        setAnalyses(aRes.data.analyses || [])
        setRecords(rRes.data.results || rRes.data || [])
      })
      .catch(() => setError('Failed to load patient data'))
      .finally(() => setLoading(false))
  }, [patientId])

  const handleReanalyse = async () => {
    setReanalysing(true)
    try {
      await analysePatient(patient.id)
      const aRes = await getPatientAnalyses(patient.id)
      setAnalyses(aRes.data.analyses || [])
      toast.success('Re-analysis complete', 'All ML models have been updated.')
    } catch {
      toast.error('Re-analysis failed', 'Could not run analysis. Please try again.')
    } finally {
      setReanalysing(false)
    }
  }

  const handleSaved = async (updated) => {
    try { const pRes = await getPatient(patientId); setPatient(pRes.data); onPatientUpdated?.(pRes.data) }
    catch { setPatient(updated); onPatientUpdated?.(updated) }
    setMode('view')
  }

  const handleVisitAdded = async (newRecord) => {
    setRecords(prev => [newRecord, ...prev])
    try { const pRes = await getPatient(patientId); setPatient(pRes.data); onPatientUpdated?.(pRes.data) } catch {}
    setMode('view')
  }

  const btnBase = { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid' }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', overflowY: 'auto', padding: '40px 24px' }} onClick={onClose}>
      <div style={{ background: '#161b27', borderRadius: 10, width: '100%', maxWidth: 780, border: '1px solid #2a3347', padding: 26, margin: '0 auto' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            {loading
              ? <div style={{ fontSize: 17, fontWeight: 600, color: '#e2e8f0' }}>Loading...</div>
              : patient && (
                <>
                  <div style={{ fontSize: 17, fontWeight: 600, color: '#e2e8f0' }}>
                    {mode === 'edit' ? 'Edit Patient' : `${patient.first_name} ${patient.last_name}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 3, display: 'flex', gap: 10 }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {patient && mode === 'view' && (
              <>
                <RiskBadge risk={patient.risk_level} />
                <button onClick={handleReanalyse} disabled={reanalysing} style={{ ...btnBase, background: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.25)', color: '#8b5cf6', opacity: reanalysing ? 0.6 : 1, cursor: reanalysing ? 'not-allowed' : 'pointer' }}>
                  <RefreshCw size={12} style={{ animation: reanalysing ? 'spin 0.8s linear infinite' : 'none' }} />
                  {reanalysing ? 'Analysing…' : 'Re-analyse'}
                </button>
                <button onClick={() => exportPatientPDF(patient, records, analyses)} style={{ ...btnBase, background: 'rgba(6,182,212,0.08)', borderColor: 'rgba(6,182,212,0.25)', color: '#06b6d4' }}>
                  <FileText size={12} /> Export PDF
                </button>
                <button onClick={() => setMode('add_visit')} style={{ ...btnBase, background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)', color: '#10b981' }}>
                  <PlusCircle size={12} /> Add Visit
                </button>
                <button onClick={() => setMode('edit')} style={{ ...btnBase, background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)', color: '#3b82f6' }}>
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => setMode('delete')} style={{ ...btnBase, background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                  <Trash2 size={12} /> Delete
                </button>
              </>
            )}
            {mode !== 'view' && (
              <button onClick={() => setMode('view')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 13, padding: 4 }}>← Back</button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}><X size={18} /></button>
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
        {patient && mode === 'edit'      && <EditPatientForm patient={patient} onSave={handleSaved} onCancel={() => setMode('view')} toast={toast} />}
        {patient && mode === 'add_visit' && <AddVisitForm patientId={patient.id} onSaved={handleVisitAdded} onCancel={() => setMode('view')} toast={toast} />}
        {patient && mode === 'delete'    && <DeleteConfirm patient={patient} onConfirm={() => { onPatientDeleted?.(patientId); onClose() }} onCancel={() => setMode('view')} toast={toast} />}

        {patient && mode === 'view' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Health Metrics</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              <MetricCard label="Systolic BP"  value={patient.blood_pressure_systolic}  unit="mmHg" color="#3b82f6" />
              <MetricCard label="Diastolic BP" value={patient.blood_pressure_diastolic} unit="mmHg" color="#06b6d4" />
              <MetricCard label="Heart Rate"   value={patient.heart_rate}               unit="bpm"  color="#f59e0b" />
              <MetricCard label="Glucose"      value={patient.glucose_level}            unit="mg/dL" color="#10b981" />
              <MetricCard label="BMI"          value={patient.bmi}                                   color="#8b5cf6" />
              <MetricCard label="Cholesterol"  value={patient.cholesterol}              unit="mg/dL" color="#ef4444" />
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {[{ label: 'Smoker', val: patient.is_smoker }, { label: 'Diabetic', val: patient.is_diabetic }, { label: 'Hypertension', val: patient.has_hypertension }].map(({ label, val }) => (
                <span key={label} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 4, background: val ? '#450a0a' : '#1e2535', color: val ? '#fca5a5' : '#475569', border: `1px solid ${val ? '#ef444430' : '#2a3347'}` }}>
                  {label}: {val ? 'Yes' : 'No'}
                </span>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              Blood Pressure Trend <span style={{ color: '#334155', fontWeight: 400 }}>({records.length} visits)</span>
            </div>
            <div style={{ background: '#0f1117', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <BPTrendChart records={records} />
            </div>

            {records.some(r => r.notes || r.diagnosis) && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Visit Notes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...records].sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date)).filter(r => r.notes || r.diagnosis).map(r => (
                    <div key={r.id} style={{ background: '#0f1117', borderRadius: 6, padding: '10px 14px', borderLeft: '2px solid #2a3347' }}>
                      <div style={{ fontSize: 11, color: '#334155', marginBottom: 6 }}>
                        {new Date(r.visit_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} · {new Date(r.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {r.diagnosis && (
                        <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: r.notes ? 4 : 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#06b6d4', background: '#0c2233', padding: '1px 6px', borderRadius: 3, marginRight: 8, textTransform: 'uppercase' }}>Dx</span>
                          {r.diagnosis}
                        </div>
                      )}
                      {r.notes && (
                        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#8b5cf6', background: '#1a1033', padding: '1px 6px', borderRadius: 3, marginRight: 8, textTransform: 'uppercase' }}>Note</span>
                          {r.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analyses.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Risk Trend</div>
                <div style={{ background: '#0f1117', borderRadius: 8, padding: 14 }}>
                  <RiskTrendChart analyses={analyses} />
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              Analysis History <span style={{ color: '#334155', fontWeight: 400 }}>({analyses.length})</span>
            </div>
            {analyses.length === 0 ? (
              <div style={{ fontSize: 13, color: '#334155', padding: '12px 0' }}>No analysis results yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e2535' }}>
                    {['Model', 'Risk', 'Confidence', 'Detail', 'Date', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analyses.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #1a2030' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: '#1e2535', color: '#475569', border: '1px solid #2a3347' }}>
                          {a.model_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{a.risk_label ? <RiskBadge risk={a.risk_label} /> : <span style={{ color: '#334155' }}>—</span>}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13, color: '#94a3b8' }}>{a.confidence != null ? `${(a.confidence * 100).toFixed(0)}%` : '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#64748b' }}>
                        {a.model_type === 'linear_regression' && a.result?.predicted_systolic_bp != null ? (
                          <span>SBP: <span style={{ color: '#e2e8f0' }}>{a.result.predicted_systolic_bp} mmHg</span>{a.result?.predicted_diastolic_bp != null && <span> · DBP: <span style={{ color: '#e2e8f0' }}>{a.result.predicted_diastolic_bp} mmHg</span></span>}</span>
                        ) : a.model_type === 'logistic' && a.result?.prediction ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 3, background: a.result.prediction === 'Diabetic' ? '#450a0a' : '#052e16', color: a.result.prediction === 'Diabetic' ? '#fca5a5' : '#6ee7b7' }}>{a.result.prediction}</span>
                        ) : a.model_type === 'kmeans' && a.result?.profile ? (
                          <span>{a.result.profile}</span>
                        ) : <span style={{ color: '#334155' }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#334155' }}>{new Date(a.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#334155' }}>{a.notes || '—'}</td>
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
  const rows = data.map(row => headers.map(h => { const val = row[h] ?? ''; return typeof val === 'string' && val.includes(',') ? `"${val}"` : val }).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function patientToRow(p) {
  return { name: `${p.first_name} ${p.last_name}`, age: p.age, gender: p.gender, bmi: p.bmi, risk_level: p.risk_level, glucose: p.glucose_level, systolic_bp: p.blood_pressure_systolic, diastolic_bp: p.blood_pressure_diastolic, heart_rate: p.heart_rate, cholesterol: p.cholesterol, is_smoker: p.is_smoker, is_diabetic: p.is_diabetic, has_hypertension: p.has_hypertension }
}

export default function PatientsPage() {
  const toast = useToast()
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
  const [selected, setSelected] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [selectAllMode, setSelectAllMode] = useState(false)
  const [allIds, setAllIds] = useState([])

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

  const loadPatients = (currentPage) => {
    setLoading(true)
    const params = { page: currentPage, page_size: PAGE_SIZE }
    if (search) params.search = search
    if (riskFilter) params.risk_level = riskFilter
    getPatients(params)
      .then(res => {
        const data = res.data
        const total = data.count || 0
        const maxPage = Math.ceil(total / PAGE_SIZE) || 1
        if (currentPage > maxPage) { setPage(1) }
        else { setPatients(data.results || data); setCount(total) }
      })
      .catch(err => setError(err.userMessage || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPatients(page) }, [page, search, riskFilter])
  useEffect(() => { setSelectAllMode(false); setAllIds([]); setSelected(new Set()) }, [search, riskFilter, page])

  const totalPages = Math.ceil(count / PAGE_SIZE)

  const handlePatientUpdated = (updated) => setPatients(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
  const handlePatientDeleted = (id) => { setPatients(prev => prev.filter(p => p.id !== id)); setCount(c => c - 1); setSelectedPatientId(null) }

  const toggleSelect = (id) => {
    setSelectAllMode(false); setAllIds([])
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const toggleSelectAll = () => {
    if (selectAllMode) { setSelectAllMode(false); setAllIds([]); setSelected(new Set()) }
    else if (selected.size === sortedPatients.length && sortedPatients.length > 0) { setSelected(new Set()) }
    else { setSelected(new Set(sortedPatients.map(p => p.id))) }
  }

  const activateSelectAllPages = async () => {
    const params = {}
    if (search) params.search = search
    if (riskFilter) params.risk_level = riskFilter
    const res = await getAllPatients(params)
    const all = res.data.results || res.data
    setAllIds(all.map(p => p.id)); setSelectAllMode(true)
  }

  const clearSelection = () => { setSelected(new Set()); setSelectAllMode(false); setAllIds([]) }

  const handleExportAll = async () => {
    try {
      const params = {}
      if (search) params.search = search
      if (riskFilter) params.risk_level = riskFilter
      const res = await getAllPatients(params)
      exportCSV((res.data.results || res.data).map(patientToRow), `patients_${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success('Export ready', 'CSV file has been downloaded.')
    } catch {
      toast.error('Export failed', 'Could not export patients.')
    }
  }

  const handleBulkExport = async () => {
    try {
      if (selectAllMode) {
        const params = {}
        if (search) params.search = search
        if (riskFilter) params.risk_level = riskFilter
        const res = await getAllPatients(params)
        exportCSV((res.data.results || res.data).map(patientToRow), `patients_all_${new Date().toISOString().slice(0, 10)}.csv`)
      } else {
        exportCSV(sortedPatients.filter(p => selected.has(p.id)).map(patientToRow), `patients_selected_${new Date().toISOString().slice(0, 10)}.csv`)
      }
      toast.success('Export ready', 'CSV file has been downloaded.')
    } catch {
      toast.error('Export failed', 'Could not export selected patients.')
    }
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    const idsToDelete = selectAllMode ? allIds : [...selected]
    try {
      await bulkDeletePatients(idsToDelete)
      setPatients(prev => prev.filter(p => !idsToDelete.includes(p.id)))
      setCount(c => c - idsToDelete.length)
      clearSelection()
      setShowBulkConfirm(false)
      toast.success(`${idsToDelete.length} patient${idsToDelete.length !== 1 ? 's' : ''} deleted`, 'Records have been permanently removed.')
    } catch {
      toast.error('Bulk delete failed', 'Could not delete the selected patients.')
    } finally {
      setBulkDeleting(false)
    }
  }

  const selectedCount = selectAllMode ? count : selected.size
  const inputBase = { background: '#161b27', border: '1px solid #2a3347', borderRadius: 7, color: '#e2e8f0', fontSize: 13, outline: 'none', fontFamily: 'inherit' }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 22, borderBottom: '1px solid #1e2535', paddingBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Patients</h1>
        <p style={{ fontSize: 13, color: '#475569', marginTop: 3, marginBottom: 0 }}>{count} total in the system</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#334155' }} />
          <input type="text" placeholder="Search by name or email…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ ...inputBase, width: '100%', padding: '8px 12px 8px 32px' }} />
        </div>
        <select value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(1) }}
          style={{ ...inputBase, padding: '8px 12px', cursor: 'pointer', color: riskFilter ? '#e2e8f0' : '#334155' }}>
          <option value="">All Risk Levels</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <button onClick={handleExportAll}
          style={{ ...inputBase, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', cursor: 'pointer', color: '#475569', whiteSpace: 'nowrap' }}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Bulk toolbar */}
      {(selected.size > 0 || selectAllMode) && (
        <div style={{ padding: '10px 14px', marginBottom: 10, background: '#1a2030', border: '1px solid #2a3347', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!selectAllMode && selected.size === sortedPatients.length && count > PAGE_SIZE && (
            <div style={{ padding: '6px 10px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 5, fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>All <strong style={{ color: '#e2e8f0' }}>{PAGE_SIZE}</strong> on this page selected.</span>
              <button onClick={activateSelectAllPages} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 12, fontWeight: 600, padding: 0 }}>
                Select all {count} patients →
              </button>
            </div>
          )}
          {selectAllMode && (
            <div style={{ padding: '6px 10px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 5, fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>All <strong style={{ color: '#3b82f6' }}>{count}</strong> patients selected.</span>
              <button onClick={clearSelection} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 12, fontWeight: 600, padding: 0 }}>Clear</button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#64748b', flex: 1 }}><span style={{ fontWeight: 600, color: '#e2e8f0' }}>{selectedCount}</span> patient{selectedCount !== 1 ? 's' : ''} selected</span>
            <button onClick={handleBulkExport} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'transparent', border: '1px solid #2a3347', borderRadius: 6, color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Download size={12} /> Export
            </button>
            <button onClick={() => setShowBulkConfirm(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Trash2 size={12} /> Delete
            </button>
            <button onClick={clearSelection} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: 4 }}><X size={15} /></button>
          </div>
        </div>
      )}

      {showBulkConfirm && (
        <div style={{ background: '#1a0a0a', border: '1px solid #450a0a', borderRadius: 8, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#fca5a5', flex: 1 }}>Permanently delete <strong>{selectedCount}</strong> patient{selectedCount !== 1 ? 's' : ''} and all their records?</span>
          <button onClick={handleBulkDelete} disabled={bulkDeleting} style={{ padding: '6px 14px', background: '#dc2626', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 600, cursor: bulkDeleting ? 'not-allowed' : 'pointer', opacity: bulkDeleting ? 0.7 : 1, fontFamily: 'inherit' }}>
            {bulkDeleting ? 'Deleting…' : 'Confirm'}
          </button>
          <button onClick={() => setShowBulkConfirm(false)} disabled={bulkDeleting} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #2a3347', borderRadius: 6, color: '#64748b', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#334155', fontSize: 14 }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontSize: 14 }}>{error}</div>
        ) : patients.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#334155', fontSize: 14 }}>No patients found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2535' }}>
                <th style={{ padding: '11px 14px', width: 40 }}>
                  <input type="checkbox"
                    checked={selectAllMode || (selected.size === sortedPatients.length && sortedPatients.length > 0)}
                    ref={el => { if (el) el.indeterminate = !selectAllMode && selected.size > 0 && selected.size < sortedPatients.length }}
                    onChange={toggleSelectAll}
                    style={{ width: 14, height: 14, accentColor: '#3b82f6', cursor: 'pointer' }}
                  />
                </th>
                {[{ label: 'Name', key: 'first_name' }, { label: 'Age', key: 'age' }, { label: 'Gender', key: 'gender' }, { label: 'BMI', key: 'bmi' }, { label: 'Risk', key: 'risk_level' }, { label: 'Status', key: '' }].map(({ label, key }) => (
                  <th key={label} onClick={() => key && handleSort(key)} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: sortKey === key ? '#3b82f6' : '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>
                    {label}{key && <span style={{ marginLeft: 4, opacity: sortKey === key ? 1 : 0.3 }}>{sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPatients.map((p, i) => {
                const isSelected = selectAllMode || selected.has(p.id)
                return (
                  <tr key={p.id}
                    style={{ borderBottom: '1px solid #151c28', background: isSelected ? 'rgba(59,130,246,0.07)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(59,130,246,0.05)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                  >
                    <td style={{ padding: '11px 14px' }} onClick={e => { e.stopPropagation(); toggleSelect(p.id) }}>
                      <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ width: 14, height: 14, accentColor: '#3b82f6', cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '11px 14px' }} onClick={() => setSelectedPatientId(p.id)}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#3b82f6' }}>{p.first_name} {p.last_name}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#64748b' }} onClick={() => setSelectedPatientId(p.id)}>{p.age}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#64748b' }} onClick={() => setSelectedPatientId(p.id)}>{p.gender}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#64748b' }} onClick={() => setSelectedPatientId(p.id)}>{p.bmi ?? '—'}</td>
                    <td style={{ padding: '11px 14px' }} onClick={() => setSelectedPatientId(p.id)}><RiskBadge risk={p.risk_level} /></td>
                    <td style={{ padding: '11px 14px' }} onClick={() => setSelectedPatientId(p.id)}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: p.is_active ? '#10b981' : '#334155', background: p.is_active ? '#052e16' : '#1a2030', padding: '2px 7px', borderRadius: 3 }}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '5px 9px', background: '#161b27', border: '1px solid #2a3347', borderRadius: 6, color: page === 1 ? '#2a3347' : '#64748b', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
            <ChevronLeft size={13} />
          </button>
          <span style={{ fontSize: 12, color: '#334155' }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ padding: '5px 9px', background: '#161b27', border: '1px solid #2a3347', borderRadius: 6, color: page === totalPages ? '#2a3347' : '#64748b', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      {selectedPatientId && (
        <PatientModal
          patientId={selectedPatientId}
          onClose={() => setSelectedPatientId(null)}
          onPatientUpdated={handlePatientUpdated}
          onPatientDeleted={handlePatientDeleted}
          toast={toast}
        />
      )}
    </div>
  )
}