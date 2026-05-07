import { useEffect, useState } from 'react'
import { getPatients, getAllPatients, getPatient, getRecords, getPatientAnalyses, updatePatient, deletePatient, createRecord, analysePatient, bulkDeletePatients } from '../api'
import { Search, ChevronLeft, ChevronRight, X, Download, Pencil, Trash2, Save, AlertTriangle, PlusCircle, CheckCircle, RefreshCw, FileText } from 'lucide-react'
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

function RiskTrendChart({ analyses }) {
  const RISK_SCORE = { LOW: 1, MEDIUM: 2, HIGH: 3 }
  const RISK_COLOR = { 1: '#10b981', 2: '#f59e0b', 3: '#ef4444' }
  const RISK_LABEL = { 1: 'LOW', 2: 'MEDIUM', 3: 'HIGH' }

  const data = [...analyses]
    .filter(a => a.risk_label && a.model_type === 'rule_based')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(a => ({
      date: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: RISK_SCORE[a.risk_label] ?? null,
    }))

  if (data.length < 2)
    return <div style={{ fontSize: 13, color: '#64748b', padding: '12px 0' }}>Not enough analyses yet — re-analyse after editing metrics to build a trend.</div>

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis
          domain={[0.5, 3.5]} ticks={[1, 2, 3]}
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={v => RISK_LABEL[v] ?? ''}
        />
        <Tooltip
          contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8 }}
          labelStyle={{ color: '#e2e8f0' }}
          formatter={v => [RISK_LABEL[v], 'Risk Level']}
        />
        <Line
          type="stepAfter"
          dataKey="score"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={(props) => {
            const { cx, cy, payload } = props
            return <circle key={payload.date} cx={cx} cy={cy} r={5} fill={RISK_COLOR[payload.score]} stroke="#161b27" strokeWidth={2} />
          }}
          activeDot={{ r: 7 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── PDF Export ────────────────────────────────────────────────────────────
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
      <text x="${PAD}" y="14" font-size="9" fill="#3b82f6">■ Systolic</text>
      <text x="${PAD + 70}" y="14" font-size="9" fill="#06b6d4">■ Diastolic</text>
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
    return `<tr>
      <td style="padding:8px 10px;font-size:12px">${a.model_type.replace('_',' ').toUpperCase()}</td>
      <td style="padding:8px 10px">${a.risk_label ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;background:${rb};color:${rc}">${a.risk_label}</span>` : '—'}</td>
      <td style="padding:8px 10px;font-size:12px">${a.confidence != null ? `${(a.confidence * 100).toFixed(0)}%` : '—'}</td>
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
  ${analyses.length > 0 ? `<h3>Analysis History</h3><table><thead><tr><th>Model</th><th>Risk</th><th>Confidence</th><th>Date</th><th>Notes</th></tr></thead><tbody>${analysisRows}</tbody></table>` : ''}
  <div class="footer"><span>Patient Diagnostic Dashboard</span><span>Confidential — For clinical use only</span></div>
  </body></html>`

  const win = window.open('', '_blank', 'width=800,height=900')
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print() }
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

  const previewAge = computeAge(form.date_of_birth)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Date of Birth
          </label>
          <input
            type="date"
            name="date_of_birth"
            value={form.date_of_birth}
            onChange={(e) => {
              const val = e.target.value
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

function AddVisitForm({ patientId, onSaved, onCancel }) {
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    visit_date: today,
    diagnosis: '',
    notes: '',
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    heart_rate: '',
    glucose_level: '',
    bmi: '',
    temperature: '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)

  const NUM_FIELDS = ['blood_pressure_systolic', 'blood_pressure_diastolic', 'heart_rate', 'glucose_level', 'bmi', 'temperature']

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n })
  }

  const handleSubmit = async () => {
    setSaving(true)
    setErrors({})
    try {
      const payload = { ...form, patient: patientId }
      NUM_FIELDS.forEach(k => {
        payload[k] = payload[k] !== '' ? parseFloat(payload[k]) : null
      })
      const res = await createRecord(payload)
      setSuccess(true)
      setTimeout(() => onSaved(res.data), 900)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const mapped = {}
        Object.entries(data).forEach(([key, msgs]) => {
          mapped[key] = Array.isArray(msgs) ? msgs.join(' ') : String(msgs)
        })
        setErrors(mapped)
      } else {
        setErrors({ non_field_errors: 'Failed to save visit. Please try again.' })
      }
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = (hasError) => ({
    width: '100%', padding: '8px 10px',
    background: '#0f1117',
    border: `1px solid ${hasError ? '#ef4444' : '#2a3347'}`,
    borderRadius: 6, color: '#e2e8f0',
    fontSize: 13, outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
  })

  const sectionLabel = (text) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 10 }}>
      {text}
    </div>
  )

  const FieldError = ({ name }) =>
    errors[name]
      ? <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2, display: 'block' }}>{errors[name]}</span>
      : null

  if (success) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 20px' }}>
        <CheckCircle size={44} color="#10b981" />
        <div style={{ fontSize: 15, fontWeight: 600, color: '#10b981' }}>Visit recorded successfully</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>Updating BP trend chart…</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        fontSize: 12, color: '#475569', marginBottom: 16,
        padding: '8px 12px', background: '#0f1117',
        borderRadius: 6, borderLeft: '3px solid #2a3347',
      }}>
        Vitals recorded here will update the patient's baseline metrics. Use <strong style={{ color: '#e2e8f0' }}>Edit Patient</strong> to update cholesterol.
      </div>

      {sectionLabel('Visit Details')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Visit Date <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="date"
            name="visit_date"
            value={form.visit_date}
            onChange={handleChange}
            max={today}
            style={inputStyle(!!errors.visit_date)}
          />
          <FieldError name="visit_date" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Diagnosis</label>
          <input
            type="text"
            name="diagnosis"
            value={form.diagnosis}
            onChange={handleChange}
            placeholder="e.g. Type 2 Diabetes, Hypertension"
            style={inputStyle(!!errors.diagnosis)}
          />
          <FieldError name="diagnosis" />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
        <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Clinical Notes</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={3}
          placeholder="Observations, patient complaints, medications prescribed…"
          style={{ ...inputStyle(!!errors.notes), resize: 'vertical', lineHeight: 1.5 }}
        />
        <FieldError name="notes" />
      </div>

      {sectionLabel('Vitals at This Visit')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { label: 'Systolic BP (mmHg)', name: 'blood_pressure_systolic', placeholder: '120' },
          { label: 'Diastolic BP (mmHg)', name: 'blood_pressure_diastolic', placeholder: '80' },
          { label: 'Heart Rate (bpm)', name: 'heart_rate', placeholder: '72' },
          { label: 'Glucose (mg/dL)', name: 'glucose_level', placeholder: '95' },
          { label: 'BMI', name: 'bmi', placeholder: '24.5' },
          { label: 'Temperature (°C)', name: 'temperature', placeholder: '36.6' },
        ].map(({ label, name, placeholder }) => (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
            <input
              type="number"
              name={name}
              value={form[name]}
              onChange={handleChange}
              placeholder={placeholder}
              step="0.1"
              style={inputStyle(!!errors[name])}
            />
            <FieldError name={name} />
          </div>
        ))}
      </div>

      {errors.non_field_errors && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#7f1d1d', borderRadius: 8, color: '#fca5a5', fontSize: 13 }}>
          {errors.non_field_errors}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', background: '#059669', border: 'none',
            borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1, fontFamily: 'inherit',
          }}
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save Visit'}
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
  const [mode, setMode] = useState('view')
  const [reanalysing, setReanalysing] = useState(false)
  const [reanalyseMsg, setReanalyseMsg] = useState(null)

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

  const handleReanalyse = async () => {
    setReanalysing(true)
    setReanalyseMsg(null)
    try {
      await analysePatient(patient.id)
      const aRes = await getPatientAnalyses(patient.id)
      setAnalyses(aRes.data.analyses || [])
      setReanalyseMsg({ type: 'success', text: 'Re-analysis complete — results updated.' })
    } catch {
      setReanalyseMsg({ type: 'error', text: 'Re-analysis failed. Please try again.' })
    } finally {
      setReanalysing(false)
      setTimeout(() => setReanalyseMsg(null), 4000)
    }
  }

  const handleSaved = async (updated) => {
    try {
      const pRes = await getPatient(patientId)
      setPatient(pRes.data)
      onPatientUpdated?.(pRes.data)
    } catch {
      setPatient(updated)
      onPatientUpdated?.(updated)
    }
    setMode('view')
  }

  const handleDeleted = () => {
    onPatientDeleted?.(patientId)
    onClose()
  }

  const handleVisitAdded = async (newRecord) => {
    setRecords(prev => [newRecord, ...prev])
    try {
      const pRes = await getPatient(patientId)
      setPatient(pRes.data)
      onPatientUpdated?.(pRes.data)
    } catch {
      // non-critical
    }
    setMode('view')
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {patient && mode === 'view' && (
              <>
                <RiskBadge risk={patient.risk_level} />

                <button
                  onClick={handleReanalyse}
                  disabled={reanalysing}
                  title="Re-run ML analysis using current patient metrics"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px',
                    background: reanalysing ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.1)',
                    border: '1px solid rgba(139,92,246,0.3)', borderRadius: 7,
                    color: '#8b5cf6', fontSize: 12, fontWeight: 600,
                    cursor: reanalysing ? 'not-allowed' : 'pointer',
                    opacity: reanalysing ? 0.7 : 1, fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  <RefreshCw size={13} style={{ animation: reanalysing ? 'spin 0.8s linear infinite' : 'none' }} />
                  {reanalysing ? 'Analysing…' : 'Re-analyse'}
                </button>

                <button
                  onClick={() => exportPatientPDF(patient, records, analyses)}
                  title="Export patient report as PDF"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', background: 'rgba(6,182,212,0.1)',
                    border: '1px solid rgba(6,182,212,0.3)', borderRadius: 7,
                    color: '#06b6d4', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  <FileText size={13} /> Export PDF
                </button>

                <button
                  onClick={() => setMode('add_visit')}
                  title="Add a new visit"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.3)', borderRadius: 7,
                    color: '#10b981', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <PlusCircle size={13} /> Add Visit
                </button>

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

        {patient && mode === 'edit' && (
          <EditPatientForm patient={patient} onSave={handleSaved} onCancel={() => setMode('view')} />
        )}

        {patient && mode === 'add_visit' && (
          <AddVisitForm patientId={patient.id} onSaved={handleVisitAdded} onCancel={() => setMode('view')} />
        )}

        {patient && mode === 'delete' && (
          <DeleteConfirm patient={patient} onConfirm={handleDeleted} onCancel={() => setMode('view')} />
        )}

        {patient && mode === 'view' && (
          <>
            {reanalyseMsg && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13,
                background: reanalyseMsg.type === 'success' ? '#052e16' : '#7f1d1d',
                color: reanalyseMsg.type === 'success' ? '#4ade80' : '#fca5a5',
                border: `1px solid ${reanalyseMsg.type === 'success' ? '#16a34a40' : '#ef444440'}`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {reanalyseMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                {reanalyseMsg.text}
              </div>
            )}

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

            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              Blood Pressure Trend ({records.length} visits)
            </div>
            <div style={{ background: '#0f1117', borderRadius: 8, padding: '16px', marginBottom: 16 }}>
              <BPTrendChart records={records} />
            </div>

            {records.some(r => r.notes || r.diagnosis) && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  Visit Notes
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...records]
                    .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))
                    .filter(r => r.notes || r.diagnosis)
                    .map(r => (
                      <div key={r.id} style={{
                        background: '#0f1117', borderRadius: 8,
                        padding: '12px 14px', borderLeft: '3px solid #2a3347',
                      }}>
                        <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>
                          {new Date(r.visit_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          {' · '}
                          {new Date(r.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {r.diagnosis && (
                          <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: r.notes ? 6 : 0 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 600, color: '#06b6d4',
                              background: '#0c2233', padding: '1px 6px', borderRadius: 3,
                              marginRight: 8, textTransform: 'uppercase', letterSpacing: '0.4px',
                            }}>Dx</span>
                            {r.diagnosis}
                          </div>
                        )}
                        {r.notes && (
                          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 600, color: '#8b5cf6',
                              background: '#1a1033', padding: '1px 6px', borderRadius: 3,
                              marginRight: 8, textTransform: 'uppercase', letterSpacing: '0.4px',
                            }}>Note</span>
                            {r.notes}
                          </div>
                        )}
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {analyses.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                  Risk Trend Over Time
                </div>
                <div style={{ background: '#0f1117', borderRadius: 8, padding: '16px' }}>
                  <RiskTrendChart analyses={analyses} />
                </div>
              </div>
            )}

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

// ── CSV Export helper ─────────────────────────────────────────────────────
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

function patientToRow(p) {
  return {
    name: `${p.first_name} ${p.last_name}`,
    age: p.age,
    gender: p.gender,
    bmi: p.bmi,
    risk_level: p.risk_level,
    glucose: p.glucose_level,
    systolic_bp: p.blood_pressure_systolic,
    diastolic_bp: p.blood_pressure_diastolic,
    heart_rate: p.heart_rate,
    cholesterol: p.cholesterol,
    is_smoker: p.is_smoker,
    is_diabetic: p.is_diabetic,
    has_hypertension: p.has_hypertension,
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────
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
  const [selected, setSelected] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)

  // ── Select-all-pages state ──
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
        if (currentPage > maxPage) {
          setPage(1)
        } else {
          setPatients(data.results || data)
          setCount(total)
        }
      })
      .catch(err => setError(err.userMessage || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPatients(page) }, [page, search, riskFilter])

  // Clear cross-page selection whenever filters or page changes
  useEffect(() => {
    setSelectAllMode(false)
    setAllIds([])
    setSelected(new Set())
  }, [search, riskFilter, page])

  const totalPages = Math.ceil(count / PAGE_SIZE)

  const handlePatientUpdated = (updated) => {
    setPatients(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
  }

  const handlePatientDeleted = (id) => {
    setPatients(prev => prev.filter(p => p.id !== id))
    setCount(c => c - 1)
    setSelectedPatientId(null)
  }

  const toggleSelect = (id) => {
    // Toggling a row manually exits select-all-pages mode
    setSelectAllMode(false)
    setAllIds([])
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectAllMode) {
      // Deselect everything including cross-page
      setSelectAllMode(false)
      setAllIds([])
      setSelected(new Set())
    } else if (selected.size === sortedPatients.length && sortedPatients.length > 0) {
      // All on this page already selected → deselect all
      setSelected(new Set())
    } else {
      // Select all rows on current page
      setSelected(new Set(sortedPatients.map(p => p.id)))
    }
  }

  const activateSelectAllPages = async () => {
    const params = {}
    if (search) params.search = search
    if (riskFilter) params.risk_level = riskFilter
    const res = await getAllPatients(params)
    const all = res.data.results || res.data
    setAllIds(all.map(p => p.id))
    setSelectAllMode(true)
  }

  const clearSelection = () => {
    setSelected(new Set())
    setSelectAllMode(false)
    setAllIds([])
  }

  // Export ALL matching patients (respects active filters, always fetches every page)
  const handleExportAll = async () => {
    try {
      const params = {}
      if (search) params.search = search
      if (riskFilter) params.risk_level = riskFilter
      const res = await getAllPatients(params)
      const all = res.data.results || res.data
      exportCSV(all.map(patientToRow), `patients_${new Date().toISOString().slice(0, 10)}.csv`)
    } catch {
      // silent — wire a toast here later
    }
  }

  const handleBulkExport = async () => {
    if (selectAllMode) {
      // Fetch full data for all matching patients
      const params = {}
      if (search) params.search = search
      if (riskFilter) params.risk_level = riskFilter
      const res = await getAllPatients(params)
      const all = res.data.results || res.data
      exportCSV(all.map(patientToRow), `patients_all_${new Date().toISOString().slice(0, 10)}.csv`)
    } else {
      const toExport = sortedPatients.filter(p => selected.has(p.id))
      exportCSV(toExport.map(patientToRow), `patients_selected_${new Date().toISOString().slice(0, 10)}.csv`)
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
    } catch {
      // keep confirm open so user can retry
    } finally {
      setBulkDeleting(false)
    }
  }

  const selectedCount = selectAllMode ? count : selected.size

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

        {/* Export CSV — always fetches all pages */}
        <button
          onClick={handleExportAll}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', background: '#161b27', border: '1px solid #2a3347',
            borderRadius: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a3347'; e.currentTarget.style.color = '#94a3b8' }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* ── Bulk Action Toolbar ── */}
      {(selected.size > 0 || selectAllMode) && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          padding: '10px 16px', marginBottom: 12,
          background: '#1e2535', border: '1px solid #2a3347',
          borderRadius: 8, gap: 8,
        }}>
          {/* Prompt to select all pages — only shown when whole current page is ticked and more pages exist */}
          {!selectAllMode && selected.size === sortedPatients.length && count > PAGE_SIZE && (
            <div style={{
              padding: '7px 12px', background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6,
              fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span>
                All <strong style={{ color: '#e2e8f0' }}>{PAGE_SIZE}</strong> patients on this page are selected.
              </span>
              <button
                onClick={activateSelectAllPages}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#3b82f6', fontSize: 12, fontWeight: 600, padding: 0,
                }}
              >
                Select all {count} patients →
              </button>
            </div>
          )}

          {/* Cross-page active banner */}
          {selectAllMode && (
            <div style={{
              padding: '7px 12px', background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6,
              fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span>All <strong style={{ color: '#3b82f6' }}>{count}</strong> patients are selected.</span>
              <button
                onClick={clearSelection}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 12, fontWeight: 600, padding: 0 }}
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Action row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#94a3b8', flex: 1 }}>
              <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{selectedCount}</span>{' '}
              patient{selectedCount !== 1 ? 's' : ''} selected
            </span>

            <button
              onClick={handleBulkExport}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', background: 'transparent',
                border: '1px solid #2a3347', borderRadius: 7,
                color: '#94a3b8', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a3347'; e.currentTarget.style.color = '#94a3b8' }}
            >
              <Download size={13} /> Export Selected
            </button>

            <button
              onClick={() => setShowBulkConfirm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7,
                color: '#ef4444', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Trash2 size={13} /> Delete Selected
            </button>

            <button
              onClick={clearSelection}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, display: 'flex', alignItems: 'center' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm */}
      {showBulkConfirm && (
        <div style={{
          background: '#1a0f0f', border: '1px solid #7f1d1d',
          borderRadius: 10, padding: '16px 20px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#fca5a5', flex: 1 }}>
            Permanently delete <strong>{selectedCount}</strong> patient{selectedCount !== 1 ? 's' : ''} and all their records?
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            style={{
              padding: '7px 16px', background: '#dc2626', border: 'none',
              borderRadius: 7, color: 'white', fontSize: 12, fontWeight: 600,
              cursor: bulkDeleting ? 'not-allowed' : 'pointer',
              opacity: bulkDeleting ? 0.7 : 1, fontFamily: 'inherit',
            }}
          >
            {bulkDeleting ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button
            onClick={() => setShowBulkConfirm(false)}
            disabled={bulkDeleting}
            style={{
              padding: '7px 14px', background: 'transparent',
              border: '1px solid #2a3347', borderRadius: 7,
              color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      )}

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
                <th style={{ padding: '12px 16px', width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectAllMode || (selected.size === sortedPatients.length && sortedPatients.length > 0)}
                    ref={el => {
                      if (el) el.indeterminate = !selectAllMode && selected.size > 0 && selected.size < sortedPatients.length
                    }}
                    onChange={toggleSelectAll}
                    style={{ width: 15, height: 15, accentColor: '#3b82f6', cursor: 'pointer' }}
                  />
                </th>
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
              {sortedPatients.map((p, i) => {
                const isSelected = selectAllMode || selected.has(p.id)
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: '1px solid #1e2535',
                      background: isSelected
                        ? 'rgba(59,130,246,0.08)'
                        : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(59,130,246,0.07)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                  >
                    <td
                      style={{ padding: '12px 16px' }}
                      onClick={e => { e.stopPropagation(); toggleSelect(p.id) }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ width: 15, height: 15, accentColor: '#3b82f6', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px' }} onClick={() => setSelectedPatientId(p.id)}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#3b82f6' }}>{p.first_name} {p.last_name}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }} onClick={() => setSelectedPatientId(p.id)}>{p.age}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }} onClick={() => setSelectedPatientId(p.id)}>{p.gender}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }} onClick={() => setSelectedPatientId(p.id)}>{p.bmi ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }} onClick={() => setSelectedPatientId(p.id)}><RiskBadge risk={p.risk_level} /></td>
                    <td style={{ padding: '12px 16px' }} onClick={() => setSelectedPatientId(p.id)}>
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
                )
              })}
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