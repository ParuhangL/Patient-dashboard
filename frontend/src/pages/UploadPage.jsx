import { useState, useEffect } from 'react'
import { analyseDataset, getReports, getReportDetail, createPatient, analysePatient, deleteReport  } from '../api'
import { Upload, FileText, X, AlertCircle, Eye, UserPlus, Trash2 } from 'lucide-react'

// ── Shared helpers ────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

function StatMini({ label, value, color = '#3b82f6' }) {
  return (
    <div style={{ background: '#0f1117', borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function RiskBadge({ risk }) {
  const map = {
    HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low',
    'High Risk': 'badge-high', 'Moderate Risk': 'badge-medium', 'Low Risk': 'badge-low',
  }
  return <span className={map[risk] || 'badge-low'}>{risk}</span>
}

function ModelInfoBox({ info }) {
  if (!info) return null
  return (
    <div style={{
      background: '#0f1117', borderRadius: 8, padding: '10px 14px',
      fontSize: 11, color: '#64748b', marginBottom: 12,
      display: 'flex', flexWrap: 'wrap', gap: '6px 20px',
    }}>
      {Object.entries(info)
        .filter(([k]) => !['features', 'classes', 'cluster_labels', 'feature_importances'].includes(k))
        .map(([k, v]) => (
          <span key={k}>
            <span style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{k}: </span>
            <span style={{ color: '#94a3b8' }}>{String(v)}</span>
          </span>
        ))}
    </div>
  )
}

function TrendTable({ data }) {
  return (
    <div>
      <ModelInfoBox info={data.model_info} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2a3347' }}>
            {['Patient', 'Predicted Systolic BP'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.predictions.map((val, i) => {
            const name = typeof val === 'object' ? val.patient_name : null
            const bp   = typeof val === 'object' ? val.value : val
            return (
              <tr key={i} style={{ borderBottom: '1px solid #1e2535' }}>
                <td style={{ padding: '8px 12px', fontSize: 13, color: '#94a3b8' }}>{name || `Patient ${i + 1}`}</td>
                <td style={{ padding: '8px 12px', fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{bp.toFixed(1)} mmHg</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ClusterTable({ data }) {
  return (
    <div>
      <ModelInfoBox info={data.model_info} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2a3347' }}>
            {['Patient', 'Cluster', 'Risk Profile'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.predictions.map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1e2535' }}>
              <td style={{ padding: '8px 12px', fontSize: 13, color: '#94a3b8' }}>{p.patient_name || `Patient ${i + 1}`}</td>
              <td style={{ padding: '8px 12px', fontSize: 13, color: '#94a3b8' }}>{p.cluster_id}</td>
              <td style={{ padding: '8px 12px' }}><RiskBadge risk={p.profile} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DiseaseTable({ data }) {
  return (
    <div>
      <ModelInfoBox info={data.model_info} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2a3347' }}>
            {['Patient', 'Prediction', 'Diabetic %', 'Non-Diabetic %'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.predictions.map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1e2535' }}>
              <td style={{ padding: '8px 12px', fontSize: 13, color: '#94a3b8' }}>{p.patient_name || `Patient ${i + 1}`}</td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                  background: p.prediction === 'Diabetic' ? '#7f1d1d' : '#064e3b',
                  color: p.prediction === 'Diabetic' ? '#fca5a5' : '#6ee7b7',
                }}>{p.prediction}</span>
              </td>
              <td style={{ padding: '8px 12px', fontSize: 13, color: '#f59e0b' }}>{(p.probability_diabetic * 100).toFixed(1)}%</td>
              <td style={{ padding: '8px 12px', fontSize: 13, color: '#10b981' }}>{(p.probability_non_diabetic * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DiagnosisTable({ data }) {
  return (
    <div>
      <ModelInfoBox info={data.model_info} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2a3347' }}>
            {['Patient', 'Risk Label', 'Confidence'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.predictions.map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1e2535' }}>
              <td style={{ padding: '8px 12px', fontSize: 13, color: '#94a3b8' }}>{p.patient_name || `Patient ${i + 1}`}</td>
              <td style={{ padding: '8px 12px' }}><RiskBadge risk={p.risk_label} /></td>
              <td style={{ padding: '8px 12px', fontSize: 13, color: '#e2e8f0' }}>{(p.confidence * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RuleBasedTable({ data }) {
  return (
    <div>
      <ModelInfoBox info={data.model_info} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2a3347' }}>
            {['Patient', 'Risk Label', 'Risk Score', 'Confidence', 'Triggered Rules'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.predictions.map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1e2535' }}>
              <td style={{ padding: '8px 12px', fontSize: 13, color: '#94a3b8' }}>{p.patient_name || `Patient ${i + 1}`}</td>
              <td style={{ padding: '8px 12px' }}><RiskBadge risk={p.risk_label} /></td>
              <td style={{ padding: '8px 12px', fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{p.risk_score}</td>
              <td style={{ padding: '8px 12px', fontSize: 13, color: '#e2e8f0' }}>{(p.confidence * 100).toFixed(0)}%</td>
              <td style={{ padding: '8px 12px', fontSize: 12, color: '#64748b', maxWidth: 300 }}>
                {p.triggered_rules?.length > 0 ? p.triggered_rules.join(' · ') : <span style={{ color: '#475569', fontStyle: 'italic' }}>None</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MLResults({ mlResults }) {
  const mlComponents = {
    trend_prediction:   { label: '📈 Trend Prediction (Linear Regression)',     Component: TrendTable },
    clustering:         { label: '🔵 Patient Clustering (KMeans)',              Component: ClusterTable },
    disease_prediction: { label: '🧬 Disease Prediction (Logistic Regression)', Component: DiseaseTable },
    diagnosis_tree:     { label: '🌳 Diagnosis Tree (Decision Tree)',           Component: DiagnosisTable },
    rule_based:         { label: '📋 Rule-Based Diagnosis Engine',              Component: RuleBasedTable },
  }
  return (
    <>
      {Object.entries(mlComponents).map(([key, { label, Component }]) => {
        const data = mlResults?.results?.[key]
        if (!data) return null
        return (
          <Section key={key} title={label}>
            <Component data={data} />
          </Section>
        )
      })}
    </>
  )
}

// ── Report Detail Modal ───────────────────────────────────────────────────────
function ReportModal({ reportId, onClose }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getReportDetail(reportId)
      .then(res => setReport(res.data))
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false))
  }, [reportId])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto', padding: '40px 24px',
    }} onClick={onClose}>
      <div style={{
        background: '#161b27', borderRadius: 12, width: '100%', maxWidth: 860,
        border: '1px solid #2a3347', padding: 24,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
              {loading ? 'Loading...' : report?.file_name}
            </div>
            {report && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {new Date(report.created_at).toLocaleString()} · {report.notes}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        {loading && <div style={{ color: '#64748b', fontSize: 13 }}>Loading report...</div>}
        {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
        {report && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>ETL Pipeline</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <StatMini label="Total Rows"         value={report.etl_report?.total_rows}         color="#3b82f6" />
                <StatMini label="Duplicates Removed" value={report.etl_report?.dropped_duplicates} color="#f59e0b" />
                <StatMini label="Missing Filled"     value={report.etl_report?.filled_missing}     color="#10b981" />
                <StatMini label="Outliers Capped"    value={report.etl_report?.outliers_capped}    color="#06b6d4" />
              </div>
              {report.etl_report?.warnings?.length > 0 && (
                <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 8 }}>⚠ {report.etl_report.warnings.join(' · ')}</div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              <StatMini label="Total Rows"      value={report.total_rows}      color="#3b82f6" />
              <StatMini label="Linked Patients" value={report.linked_patients} color="#10b981" />
              <StatMini label="Unlinked Rows"   value={report.unlinked_rows}   color="#f59e0b" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>ML Results</div>
            <MLResults mlResults={report.ml_results} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Manual Patient Form ───────────────────────────────────────────────────────
const EMPTY_FORM = {
  first_name: '', last_name: '', date_of_birth: '', gender: 'M',
  email: '', phone: '',
  blood_pressure_systolic: '', blood_pressure_diastolic: '',
  heart_rate: '', glucose_level: '', bmi: '', cholesterol: '',
  is_smoker: false, is_diabetic: false, has_hypertension: false,
}

function Field({ label, name, value, type = 'text', options, onChange, error, required }) {
  const hasErr = !!error
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: hasErr ? '#f87171' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {options ? (
        <select
          name={name} value={value} onChange={onChange}
          style={{
            padding: '8px 10px', background: '#0f1117',
            border: `1px solid ${hasErr ? '#ef4444' : '#2a3347'}`,
            borderRadius: 6, color: '#e2e8f0', fontSize: 13,
            outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type={type} name={name} value={value} onChange={onChange}
          style={{
            padding: '8px 10px', background: '#0f1117',
            border: `1px solid ${hasErr ? '#ef4444' : '#2a3347'}`,
            borderRadius: 6, color: '#e2e8f0', fontSize: 13,
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
          }}
        />
      )}
      {hasErr && <span style={{ fontSize: 11, color: '#f87171' }}>{error}</span>}
    </div>
  )
}

function validateForm(form) {
  const errors = {}
  if (!form.first_name.trim()) errors.first_name = 'Required'
  else if (form.first_name.trim().length < 2) errors.first_name = 'At least 2 characters'
  else if (!/^[a-zA-Z\s\-']+$/.test(form.first_name)) errors.first_name = 'Letters only'

  if (!form.last_name.trim()) errors.last_name = 'Required'
  else if (form.last_name.trim().length < 2) errors.last_name = 'At least 2 characters'
  else if (!/^[a-zA-Z\s\-']+$/.test(form.last_name)) errors.last_name = 'Letters only'

  if (!form.date_of_birth) errors.date_of_birth = 'Required'
  else {
    const dob = new Date(form.date_of_birth)
    const today = new Date()
    if (dob > today) errors.date_of_birth = 'Cannot be in the future'
    else {
      const age = (today - dob) / (1000 * 60 * 60 * 24 * 365)
      if (age > 130) errors.date_of_birth = 'Invalid date of birth'
    }
  }

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = 'Invalid email address'

  if (form.phone && !/^[\d\s\-\+\(\)]{7,20}$/.test(form.phone))
    errors.phone = '7–20 digits, spaces, dashes allowed'

  const numChecks = [
    { key: 'blood_pressure_systolic',  min: 50,  max: 300, label: 'Systolic BP' },
    { key: 'blood_pressure_diastolic', min: 30,  max: 200, label: 'Diastolic BP' },
    { key: 'heart_rate',               min: 20,  max: 300, label: 'Heart rate' },
    { key: 'glucose_level',            min: 20,  max: 600, label: 'Glucose' },
    { key: 'bmi',                      min: 10,  max: 80,  label: 'BMI' },
    { key: 'cholesterol',              min: 50,  max: 700, label: 'Cholesterol' },
  ]
  numChecks.forEach(({ key, min, max, label }) => {
    const v = form[key]
    if (v !== '' && v !== null) {
      const n = parseFloat(v)
      if (isNaN(n)) errors[key] = 'Must be a number'
      else if (n < min || n > max) errors[key] = `${label} must be ${min}–${max}`
    }
  })

  const sys = parseFloat(form.blood_pressure_systolic)
  const dia = parseFloat(form.blood_pressure_diastolic)
  if (!isNaN(sys) && !isNaN(dia)) {
    if (dia >= sys) errors.blood_pressure_diastolic = 'Must be lower than systolic'
    else if (sys - dia < 10) errors.blood_pressure_diastolic = 'Pulse pressure must be ≥ 10 mmHg'
  }

  return errors
}

function ManualPatientForm({ onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)
  const [serverError, setServerError] = useState(null)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
    // Clear field error on change
    if (errors[name]) setErrors(prev => { const e = { ...prev }; delete e[name]; return e })
  }

  const handleSubmit = async () => {
    const errs = validateForm(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    setServerError(null)
    setSuccess(null)

    try {
      const payload = { ...form }
      ;['blood_pressure_systolic','blood_pressure_diastolic','heart_rate','glucose_level','bmi','cholesterol'].forEach(k => {
        payload[k] = payload[k] !== '' ? parseFloat(payload[k]) : null
      })
      if (!payload.email) payload.email = null
      if (!payload.phone) payload.phone = null

      const res = await createPatient(payload)

      const newPatient = res.data

      try {
        await analysePatient(newPatient.id)
      } catch {
        // Analysis failure shouldn't block success message
      }

      setSuccess(`Patient ${form.first_name} ${form.last_name} created and analysed successfully!`)
      setForm(EMPTY_FORM)
      setErrors({})
      onSuccess?.()


    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        // Map backend field errors onto form fields
        const mapped = {}
        Object.entries(data).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v[0] : v
        })
        setErrors(mapped)
        setServerError('Please fix the errors above.')
      } else {
        setServerError(err.userMessage || 'Failed to create patient.')
      }
    } finally {
      setSaving(false)
    }
  }

  const sectionLabel = (text) => (
    <div style={{
      fontSize: 11, fontWeight: 600, color: '#475569',
      textTransform: 'uppercase', letterSpacing: '0.5px',
      marginTop: 20, marginBottom: 10,
    }}>{text}</div>
  )

  return (
    <div>
      {success && (
        <div style={{
          padding: '10px 16px', background: '#064e3b', border: '1px solid #10b981',
          borderRadius: 8, color: '#6ee7b7', fontSize: 13, marginBottom: 16,
        }}>
          ✓ {success}
        </div>
      )}

      {sectionLabel('Personal Information')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="First Name" name="first_name" value={form.first_name} onChange={handleChange} error={errors.first_name} required />
        <Field label="Last Name"  name="last_name"  value={form.last_name}  onChange={handleChange} error={errors.last_name}  required />
        <Field label="Date of Birth" name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} error={errors.date_of_birth} required />
        <Field label="Gender" name="gender" value={form.gender} onChange={handleChange} error={errors.gender} required
          options={[{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }, { value: 'O', label: 'Other' }]}
        />
        <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} />
        <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} error={errors.phone} />
      </div>

      {sectionLabel('Health Metrics')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Systolic BP (mmHg)"  name="blood_pressure_systolic"  type="number" value={form.blood_pressure_systolic}  onChange={handleChange} error={errors.blood_pressure_systolic} />
        <Field label="Diastolic BP (mmHg)" name="blood_pressure_diastolic" type="number" value={form.blood_pressure_diastolic} onChange={handleChange} error={errors.blood_pressure_diastolic} />
        <Field label="Heart Rate (bpm)"    name="heart_rate"               type="number" value={form.heart_rate}               onChange={handleChange} error={errors.heart_rate} />
        <Field label="Glucose (mg/dL)"     name="glucose_level"            type="number" value={form.glucose_level}            onChange={handleChange} error={errors.glucose_level} />
        <Field label="BMI"                 name="bmi"                      type="number" value={form.bmi}                      onChange={handleChange} error={errors.bmi} />
        <Field label="Cholesterol (mg/dL)" name="cholesterol"              type="number" value={form.cholesterol}              onChange={handleChange} error={errors.cholesterol} />
      </div>

      {sectionLabel('Lifestyle')}
      <div style={{ display: 'flex', gap: 28 }}>
        {[
          { label: 'Smoker', name: 'is_smoker' },
          { label: 'Diabetic', name: 'is_diabetic' },
          { label: 'Hypertension', name: 'has_hypertension' },
        ].map(({ label, name }) => (
          <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#94a3b8' }}>
            <input
              type="checkbox" name={name} checked={form[name]} onChange={handleChange}
              style={{ width: 15, height: 15, accentColor: '#3b82f6', cursor: 'pointer' }}
            />
            {label}
          </label>
        ))}
      </div>

      {serverError && (
        <div style={{
          marginTop: 16, padding: '10px 14px', background: '#7f1d1d',
          borderRadius: 8, color: '#fca5a5', fontSize: 13,
        }}>{serverError}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', background: saving ? '#1e2535' : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            border: 'none', borderRadius: 8, color: saving ? '#475569' : 'white',
            fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}
        >
          <UserPlus size={14} />
          {saving ? 'Creating...' : 'Create Patient'}
        </button>
        <button
          onClick={() => { setForm(EMPTY_FORM); setErrors({}); setServerError(null); setSuccess(null) }}
          style={{
            padding: '10px 20px', background: 'transparent',
            border: '1px solid #2a3347', borderRadius: 8,
            color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UploadPage({ uploadResult, setUploadResult }) {
  const [tab, setTab] = useState('csv') // 'csv' | 'manual'
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [openReportId, setOpenReportId] = useState(null)

  const loadReports = () => {
    setReportsLoading(true)
    getReports()
      .then(res => setReports(res.data))
      .catch(() => {})
      .finally(() => setReportsLoading(false))
  }

  useEffect(() => { loadReports() }, [uploadResult])

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (f) { setFile(f); setUploadResult(null); setError(null) }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setUploadResult(null); setError(null) }
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true); setError(null); setUploadResult(null); setProgress(0)
    try {
      const res = await analyseDataset(file, setProgress)
      setUploadResult(res.data)
    } catch (err) {
      setError(err.userMessage || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const clearFile = () => { setFile(null); setUploadResult(null); setError(null); setProgress(0) }

  const tabStyle = (active) => ({
    padding: '9px 20px', borderRadius: 7, border: 'none',
    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
    color: active ? '#3b82f6' : '#64748b',
    fontSize: 13, fontWeight: active ? 600 : 400,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
  })

const [deletingReportId, setDeletingReportId] = useState(null)
const [deleteLoading, setDeleteLoading] = useState(false)

  const handleDeleteReport = async () => {
    setDeleteLoading(true)
    try {
      await deleteReport(deletingReportId)
      setReports(prev => prev.filter(r => r.id !== deletingReportId))
      setDeletingReportId(null)
    } catch {
      // handle silently
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Add Patients</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Upload a CSV dataset or manually enter a patient</p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        background: '#161b27', border: '1px solid #2a3347',
        borderRadius: 9, padding: 4, width: 'fit-content',
      }}>
        <button style={tabStyle(tab === 'csv')}    onClick={() => setTab('csv')}>
          📂 CSV Upload
        </button>
        <button style={tabStyle(tab === 'manual')} onClick={() => setTab('manual')}>
          ✍️ Manual Entry
        </button>
      </div>

      {/* CSV Tab */}
      {tab === 'csv' && (
        <>
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              style={{
                border: `2px dashed ${file ? '#3b82f6' : '#2a3347'}`,
                borderRadius: 10, padding: '40px 24px', textAlign: 'center',
                cursor: 'pointer', background: file ? 'rgba(59,130,246,0.04)' : 'transparent',
                transition: 'all 0.2s',
              }}
              onClick={() => document.getElementById('file-input').click()}
            >
              <input id="file-input" type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
              {file ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <FileText size={20} color="#3b82f6" />
                  <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>{file.name}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>({(file.size / 1024).toFixed(1)} KB)</span>
                  <button onClick={e => { e.stopPropagation(); clearFile() }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}>
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload size={28} color="#64748b" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>Drop your CSV or Excel file here</div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>or click to browse</div>
                </div>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || loading}
              style={{
                marginTop: 16, width: '100%', padding: '11px',
                background: !file || loading ? '#1e2535' : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                border: 'none', borderRadius: 8,
                color: !file || loading ? '#475569' : 'white',
                fontSize: 13, fontWeight: 600,
                cursor: !file || loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}
            >
              {loading ? `Analysing... ${progress}%` : 'Run ETL + ML Analysis'}
            </button>

            {loading && (
              <div style={{ marginTop: 10, background: '#1e2535', borderRadius: 4, height: 4 }}>
                <div style={{
                  height: 4, borderRadius: 4, width: `${progress}%`,
                  background: 'linear-gradient(90deg, #3b82f6, #06b6d4)', transition: 'width 0.3s',
                }} />
              </div>
            )}
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#7f1d1d', border: '1px solid #ef4444',
              borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            }}>
              <AlertCircle size={16} color="#ef4444" />
              <span style={{ fontSize: 13, color: '#fca5a5' }}>{error}</span>
            </div>
          )}

          {uploadResult && (
            <div className="animate-fade-in">
              <Section title="✅ ETL Pipeline Report">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: uploadResult.etl_report?.warnings?.length > 0 ? 12 : 0 }}>
                  <StatMini label="Total Rows"         value={uploadResult.etl_report?.total_rows}         color="#3b82f6" />
                  <StatMini label="Duplicates Removed" value={uploadResult.etl_report?.dropped_duplicates} color="#f59e0b" />
                  <StatMini label="Missing Filled"     value={uploadResult.etl_report?.filled_missing}     color="#10b981" />
                  <StatMini label="Outliers Capped"    value={uploadResult.etl_report?.outliers_capped}    color="#06b6d4" />
                </div>
                {uploadResult.etl_report?.warnings?.length > 0 && (
                  <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 8 }}>
                    ⚠ {uploadResult.etl_report.warnings.join(' · ')}
                  </div>
                )}
              </Section>
              <MLResults mlResults={uploadResult.ml_results} />
            </div>
          )}

          {/* Past Reports */}
          <div className="card" style={{ padding: 24, marginTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>📋 Saved Analysis Reports</div>
            {reportsLoading ? (
              <div style={{ color: '#64748b', fontSize: 13 }}>Loading reports...</div>
            ) : reports.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: 13 }}>No reports saved yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a3347' }}>
                    {['#', 'File', 'Status', 'Rows', 'Linked', 'Date', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #1e2535' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#475569' }}>#{r.id}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13, color: '#e2e8f0' }}>{r.file_name}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: r.status === 'completed' ? '#064e3b' : '#78350f',
                          color: r.status === 'completed' ? '#6ee7b7' : '#fcd34d',
                        }}>{r.status}</span>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 13, color: '#94a3b8' }}>{r.total_rows}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13, color: '#10b981' }}>{r.linked_patients}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#475569' }}>{new Date(r.created_at).toLocaleString()}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setOpenReportId(r.id)}
                              style={{
                                background: 'none', border: '1px solid #2a3347', borderRadius: 6,
                                padding: '4px 10px', color: '#64748b', cursor: 'pointer', fontSize: 12,
                                display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                              }}
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              onClick={() => setDeletingReportId(r.id)}
                              style={{
                                background: 'none', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6,
                                padding: '4px 10px', color: '#ef4444', cursor: 'pointer', fontSize: 12,
                                display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                              }}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </td>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Manual Entry Tab */}
      {tab === 'manual' && (
        <div className="card" style={{ padding: 24 }}>
          <ManualPatientForm onSuccess={loadReports} />
        </div>
      )}

      {openReportId && (
        <ReportModal reportId={openReportId} onClose={() => setOpenReportId(null)} />
      )}

            {deletingReportId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setDeletingReportId(null)}>
          <div style={{
            background: '#161b27', borderRadius: 12, padding: 28,
            border: '1px solid #2a3347', maxWidth: 400, width: '90%',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
              <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fca5a5', marginBottom: 6 }}>
                  Delete this report?
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                  The report log will be removed. Patient analysis results are kept in their medical history.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeletingReportId(null)}
                style={{
                  padding: '8px 16px', background: 'transparent',
                  border: '1px solid #2a3347', borderRadius: 7,
                  color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteReport}
                disabled={deleteLoading}
                style={{
                  padding: '8px 16px', background: '#dc2626', border: 'none',
                  borderRadius: 7, color: 'white', fontSize: 13, fontWeight: 600,
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  opacity: deleteLoading ? 0.7 : 1, fontFamily: 'inherit',
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}