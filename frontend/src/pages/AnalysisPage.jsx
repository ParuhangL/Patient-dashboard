import { useEffect, useState } from 'react'
import { getAnalyses, getReports } from '../api'
import { Search, Download } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { createPortal } from 'react-dom'

function RiskBadge({ risk }) {
  const cls = risk === 'HIGH' ? 'badge-high' : risk === 'MEDIUM' ? 'badge-medium' : 'badge-low'
  return <span className={cls}>{risk}</span>
}

const MODEL_LABELS = {
  decision_tree:     ' Decision Tree',
  logistic:          ' Logistic Regression',
  linear_regression: ' Linear Regression',
  kmeans:            ' KMeans',
  rule_based:        ' Rule Based',
}

const MODEL_COLORS = {
  decision_tree:     '#8b5cf6',
  logistic:          '#06b6d4',
  linear_regression: '#3b82f6',
  kmeans:            '#f59e0b',
  rule_based:        '#10b981',
}

function ResultDetail({ result, modelType }) {
  if (!result || typeof result !== 'object') return <span style={{ color: '#475569' }}>—</span>

  if (modelType === 'logistic') {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
          background: result.prediction === 'Diabetic' ? '#7f1d1d' : '#064e3b',
          color: result.prediction === 'Diabetic' ? '#fca5a5' : '#6ee7b7',
        }}>{result.prediction}</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          Diabetic: {result.probability_diabetic != null ? `${(result.probability_diabetic * 100).toFixed(1)}%` : '—'}
        </span>
      </div>
    )
  }

  if (modelType === 'decision_tree') {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {result.probabilities && Object.entries(result.probabilities).map(([k, v]) => (
          <span key={k} style={{ fontSize: 11, color: '#64748b' }}>
            {k}: <span style={{ color: '#94a3b8' }}>{(v * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>
    )
  }

  if (modelType === 'linear_regression') {
    const sbp = result.predicted_systolic_bp ?? result.predicted_bp
    const dbp = result.predicted_diastolic_bp
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          Systolic: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
            {sbp != null ? `${sbp} mmHg` : '—'}
          </span>
        </span>
        {dbp != null && (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Diastolic: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{`${dbp} mmHg`}</span>
          </span>
        )}
      </div>
    )
  }

  if (modelType === 'kmeans') {
    return (
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
        background: result.profile === 'High Risk' ? '#7f1d1d' : result.profile === 'Moderate Risk' ? '#78350f' : '#064e3b',
        color: result.profile === 'High Risk' ? '#fca5a5' : result.profile === 'Moderate Risk' ? '#fcd34d' : '#6ee7b7',
      }}>
        {result.profile || `Cluster ${result.cluster_id}`}
      </span>
    )
  }

  return <span style={{ fontSize: 12, color: '#64748b' }}>{JSON.stringify(result).slice(0, 60)}...</span>
}

const RISK_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' }

function RiskPieChart({ analyses, height = 200 }) {
  const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 }
  analyses.forEach(a => { if (a.risk_label) counts[a.risk_label]++ })
  const data = Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))

  if (data.length === 0) return (
    <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No risk label data yet</div>
  )

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} label={false} labelLine={false}>
          {data.map(entry => <Cell key={entry.name} fill={RISK_COLORS[entry.name]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function ConfidenceBarChart({ analyses, modelCounts, height = 200 }) {
  const modelTotals = {}
  const modelConfSum = {}
  analyses.forEach(a => {
    if (a.confidence != null) {
      modelTotals[a.model_type] = (modelTotals[a.model_type] || 0) + 1
      modelConfSum[a.model_type] = (modelConfSum[a.model_type] || 0) + a.confidence
    }
  })
  const data = Object.keys(modelTotals).map(m => ({
    name: MODEL_LABELS[m]?.split(' ')[1] || m,
    avg_confidence: Math.round((modelConfSum[m] / modelTotals[m]) * 100),
    color: MODEL_COLORS[m] || '#3b82f6',
  }))

  if (data.length === 0) return (
    <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No confidence data yet</div>
  )

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit="%" domain={[0, 100]} />
        <Tooltip
          contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8 }}
          formatter={(v) => [`${v}%`, 'Avg Confidence']}
        />
        <Bar dataKey="avg_confidence" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function RiskScatterChart({ analyses, height = 200 }) {
  const MODEL_SCATTER_COLORS = { decision_tree: '#8b5cf6', logistic: '#06b6d4' }

  const data = analyses
    .filter(a => a.confidence != null && a.risk_label && ['decision_tree', 'logistic'].includes(a.model_type))
    .map(a => {
      let risk
      if (a.model_type === 'logistic') {
        risk = a.risk_label === 'Diabetic' ? 3 : 1
      } else {
        risk = a.risk_label === 'LOW' ? 1 : a.risk_label === 'MEDIUM' ? 2 : 3
      }
      return {
        confidence: Math.round(a.confidence * 100) + (Math.random() * 4 - 2),
        risk: risk + (Math.random() * 0.3 - 0.15),
        riskLabel: a.risk_label,
        model: a.model_type,
        fill: MODEL_SCATTER_COLORS[a.model_type],
      }
    })

  if (data.length === 0) return (
    <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No scatter data yet</div>
  )

  return (
    <>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        {Object.entries(MODEL_SCATTER_COLORS).map(([model, color]) => (
          <div key={model} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{MODEL_LABELS[model]}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 4, right: 8, left: 20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
          <XAxis dataKey="confidence" name="Confidence" tick={{ fill: '#94a3b8', fontSize: 11 }} type="number" domain={[0, 100]} tickCount={6} tickFormatter={v => `${v}%`} />
          <YAxis dataKey="risk" name="Risk" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => ['', 'Non-Diabetic', 'MED', 'Diabetic'][v] || ''} domain={[0, 4]} ticks={[1, 2, 3]} />
          <ZAxis range={[40, 40]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8 }}
            formatter={(v, name) => {
              if (name === 'Risk') return [['', 'Non-Diabetic', 'Medium Risk', 'Diabetic'][Math.round(v)] || Math.round(v), 'Risk']
              if (name === 'Confidence') return [`${Number(v).toFixed(1)}%`, 'Confidence']
              return [v, name]
            }}
          />
          <Scatter
            data={data}
            shape={(props) => {
              const { cx, cy, payload } = props
              return <circle cx={cx} cy={cy} r={3} fill={payload.fill} fillOpacity={0.7} />
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </>
  )
}

// ── Confusion Matrix components ───────────────────────────────────────────────

function BinaryConfusionMatrix({ cm, label, color }) {
  // cm = { TP, FP, TN, FN, labels }
  if (!cm) return null
  const { TP, FP, TN, FN } = cm
  const total = TP + FP + TN + FN
  const accuracy  = total > 0 ? ((TP + TN) / total * 100).toFixed(1) : '—'
  const precision = (TP + FP) > 0 ? (TP / (TP + FP) * 100).toFixed(1) : '—'
  const recall    = (TP + FN) > 0 ? (TP / (TP + FN) * 100).toFixed(1) : '—'

  const cells = [
    { label: 'TN', value: TN, desc: 'True Negative',  bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)',  textColor: '#10b981' },
    { label: 'FP', value: FP, desc: 'False Positive', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)',   textColor: '#f87171' },
    { label: 'FN', value: FN, desc: 'False Negative', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)',   textColor: '#f87171' },
    { label: 'TP', value: TP, desc: 'True Positive',  bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)',  textColor: '#10b981' },
  ]

  return (
    <div className="card" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 3, height: 18, borderRadius: 2, background: color }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{label}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Binary · Test set · {total} samples</div>
        </div>
      </div>

      {/* Axis labels */}
      <div style={{ display: 'flex', marginBottom: 4 }}>
        <div style={{ width: 90 }} />
        <div style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Predicted: Non-Diabetic
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Predicted: Diabetic
        </div>
      </div>

      {/* Matrix grid */}
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Row labels */}
        <div style={{ width: 90, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10 }}>
            <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', writingMode: 'initial' }}>
              Actual: Non-Diabetic
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10 }}>
            <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Actual: Diabetic
            </span>
          </div>
        </div>

        {/* 2×2 grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {cells.map(c => (
            <div key={c.label} style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 8,
              padding: '16px 12px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.textColor, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.textColor, marginTop: 4 }}>{c.label}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics strip */}
      <div style={{ display: 'flex', gap: 0, marginTop: 16, background: '#0f1117', borderRadius: 8, overflow: 'hidden', border: '1px solid #1e2535' }}>
        {[
          { label: 'Accuracy',  value: `${accuracy}%`  },
          { label: 'Precision', value: `${precision}%` },
          { label: 'Recall',    value: `${recall}%`    },
        ].map((m, i) => (
          <div key={m.label} style={{
            flex: 1, padding: '10px 12px', textAlign: 'center',
            borderRight: i < 2 ? '1px solid #1e2535' : 'none',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{m.value}</div>
            <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MulticlassConfusionMatrix({ cm, label, color }) {
  // cm = { matrix: [[...],[...],[...]], labels: ['LOW','MEDIUM','HIGH'] }
  if (!cm || !cm.matrix) return null
  const { matrix, labels } = cm
  const total = matrix.flat().reduce((a, b) => a + b, 0)
  const correct = matrix.reduce((sum, row, i) => sum + row[i], 0)
  const accuracy = total > 0 ? (correct / total * 100).toFixed(1) : '—'

  // Color intensity per cell — max value for scaling
  const maxVal = Math.max(...matrix.flat(), 1)

  const cellColor = (actual, predicted, value) => {
    if (actual === predicted) {
      // Diagonal = correct prediction — green
      const intensity = value / maxVal
      return {
        bg: `rgba(16,185,129,${0.08 + intensity * 0.35})`,
        border: `rgba(16,185,129,${0.2 + intensity * 0.4})`,
        text: '#10b981',
      }
    }
    // Off-diagonal = error — red, scaled by magnitude
    const intensity = value / maxVal
    return {
      bg: intensity > 0 ? `rgba(239,68,68,${0.05 + intensity * 0.25})` : '#0f1117',
      border: intensity > 0 ? `rgba(239,68,68,${0.15 + intensity * 0.3})` : '#1e2535',
      text: intensity > 0 ? '#f87171' : '#334155',
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 3, height: 18, borderRadius: 2, background: color }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{label}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>3-class · Test set · {total} samples · Diagonal = correct</div>
        </div>
      </div>

      {/* Predicted header row */}
      <div style={{ display: 'flex', marginBottom: 6 }}>
        <div style={{ width: 80 }} />
        {labels.map(l => (
          <div key={l} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Pred: {l}
          </div>
        ))}
      </div>

      {/* Matrix rows */}
      {matrix.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <div style={{ width: 80, fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', paddingRight: 10 }}>
            Act: {labels[i]}
          </div>
          {row.map((val, j) => {
            const c = cellColor(i, j, val)
            return (
              <div key={j} style={{
                flex: 1, background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 6, padding: '12px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: c.text, lineHeight: 1 }}>{val}</div>
              </div>
            )
          })}
        </div>
      ))}

      {/* Accuracy strip */}
      <div style={{ marginTop: 16, background: '#0f1117', borderRadius: 8, border: '1px solid #1e2535', padding: '10px 16px', textAlign: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{accuracy}%</span>
        <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginLeft: 8 }}>Test Accuracy</span>
      </div>
    </div>
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
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AnalysisPage() {
  const [analyses, setAnalyses]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [modelFilter, setModelFilter]   = useState('')
  const [riskFilter, setRiskFilter]     = useState('')
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(1)
  const PAGE_SIZE = 15
  const [expandedChart, setExpandedChart] = useState(null)
  const [latestReport, setLatestReport] = useState(null)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        let all = []
        let nextPage = 1
        let hasMore = true

        while (hasMore) {
          const res = await getAnalyses({ page: nextPage, page_size: 100 })
          const data = res.data
          if (data.results) {
            all = [...all, ...data.results]
            hasMore = !!data.next
            nextPage++
          } else {
            all = data
            hasMore = false
          }
        }
        setAnalyses(all)
      } catch (err) {
        setError(err.userMessage || 'Failed to load analyses')
      } finally {
        setLoading(false)
      }
    }

    const fetchLatestReport = async () => {
      try {
        const res = await getReports()
        const reports = res.data
        if (reports && reports.length > 0) {
          // Most recent report is first (ordered by -created_at on backend)
          setLatestReport(reports[0])
        }
      } catch {
        // Silently ignore — confusion matrix is optional
      }
    }

    fetchAll()
    fetchLatestReport()
  }, [])

  // Extract confusion matrices from the latest batch report
  const logisticCM = latestReport?.ml_results?.results?.disease_prediction?.model_info?.confusion_matrix || null
  const treeCM     = latestReport?.ml_results?.results?.diagnosis_tree?.model_info?.confusion_matrix     || null

  const filtered = analyses.filter(a => {
    const nameMatch  = !search      || (a.patient_name || '').toLowerCase().includes(search.toLowerCase())
    const modelMatch = !modelFilter || a.model_type === modelFilter
    const riskMatch  = !riskFilter  || a.risk_label === riskFilter
    return nameMatch && modelMatch && riskMatch
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const total      = analyses.length
  const highRisk   = analyses.filter(a => a.risk_label === 'HIGH').length
  const diabetic   = analyses.filter(a => a.result?.prediction === 'Diabetic').length
  const modelCounts = analyses.reduce((acc, a) => {
    acc[a.model_type] = (acc[a.model_type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>ML Analysis</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          All analysis results across all patients and models
        </p>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, marginBottom: 24, background: '#111827', border: '1px solid #1e2535', borderRadius: 8, overflow: 'hidden' }}>
        {[
          { label: 'Total Results',  value: total,    color: '#3b82f6' },
          { label: 'High Risk',      value: highRisk, color: '#ef4444' },
          { label: 'Diabetic Flags', value: diabetic, color: '#f59e0b' },
        ].map((item, i) => (
          <div key={item.label} style={{ padding: '16px 20px', borderRight: i < 2 ? '1px solid #1e2535' : 'none' }}>
            <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: item.color, lineHeight: 1 }}>{item.value ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Model breakdown bar */}
      {Object.keys(modelCounts).length > 0 && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            Results by Model
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(modelCounts).map(([model, count]) => (
              <div key={model} style={{ flex: 1, minWidth: 120 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{MODEL_LABELS[model] || model}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{count}</span>
                </div>
                <div style={{ background: '#1e2535', borderRadius: 4, height: 6 }}>
                  <div style={{
                    height: 6, borderRadius: 4,
                    width: `${(count / total) * 100}%`,
                    background: MODEL_COLORS[model] || '#3b82f6',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      {analyses.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { key: 'risk',       label: 'Risk Distribution' },
              { key: 'confidence', label: 'Avg Confidence by Model' },
              { key: 'scatter',    label: 'Confidence vs Risk · Decision Tree & Logistic Only' },
            ].map(({ key, label }) => (
              <div
                key={key}
                className="card"
                onClick={() => setExpandedChart(key)}
                style={{ padding: 20, cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#2a3347'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {label}
                  </div>
                  <span style={{ fontSize: 10, color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
                    EXPAND
                  </span>
                </div>
                {key === 'risk'       && <RiskPieChart analyses={analyses} />}
                {key === 'confidence' && <ConfidenceBarChart analyses={analyses} modelCounts={modelCounts} />}
                {key === 'scatter'    && <RiskScatterChart analyses={analyses} />}
              </div>
            ))}
          </div>

          {/* Expanded Chart Modal */}
          {expandedChart && createPortal(
            <div
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '40px 32px',
              }}
              onClick={() => setExpandedChart(null)}
            >
              <div
                style={{ background: '#161b27', border: '1px solid #2a3347', borderRadius: 14, padding: 32, width: '100%', maxWidth: 900 }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
                    {expandedChart === 'risk'       && 'Risk Distribution'}
                    {expandedChart === 'confidence' && 'Avg Confidence by Model'}
                    {expandedChart === 'scatter'    && 'Confidence vs Risk — Decision Tree & Logistic Regression'}
                  </div>
                  <button onClick={() => setExpandedChart(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 22, lineHeight: 1 }}>×</button>
                </div>
                {expandedChart === 'risk'       && <RiskPieChart analyses={analyses} height={420} />}
                {expandedChart === 'confidence' && <ConfidenceBarChart analyses={analyses} modelCounts={modelCounts} height={420} />}
                {expandedChart === 'scatter'    && <RiskScatterChart analyses={analyses} height={420} />}
              </div>
            </div>,
            document.body
          )}
        </>
      )}

      {/* ── Confusion Matrices ─────────────────────────────────────────────── */}
      {(logisticCM || treeCM) && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Confusion Matrices</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
              Computed on the 20% held-out test set from the most recent batch upload
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: logisticCM && treeCM ? '1fr 1fr' : '1fr', gap: 16 }}>
            {logisticCM && (
              <BinaryConfusionMatrix
                cm={logisticCM}
                label="Logistic Regression — Diabetes Prediction"
                color={MODEL_COLORS.logistic}
              />
            )}
            {treeCM && (
              <MulticlassConfusionMatrix
                cm={treeCM}
                label="Decision Tree — Risk Classification"
                color={MODEL_COLORS.decision_tree}
              />
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search by patient name..."
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
          value={modelFilter}
          onChange={e => { setModelFilter(e.target.value); setPage(1) }}
          style={{
            padding: '9px 14px', background: '#161b27', border: '1px solid #2a3347',
            borderRadius: 8, color: modelFilter ? '#e2e8f0' : '#64748b',
            fontSize: 13, outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="">All Models</option>
          {Object.entries(MODEL_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
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
      </div>

      {/* Export */}
      <button
        onClick={() => exportCSV(
          filtered.map(a => ({
            patient:    a.patient_name,
            model:      a.model_type,
            risk_label: a.risk_label,
            confidence: a.confidence != null ? `${(a.confidence * 100).toFixed(0)}%` : '',
            date:       new Date(a.created_at).toLocaleDateString(),
            notes:      a.notes || '',
          })),
          `analyses_${new Date().toISOString().slice(0, 10)}.csv`
        )}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '9px 14px', background: '#161b27',
          border: '1px solid #2a3347', borderRadius: 8,
          color: '#94a3b8', fontSize: 13, cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s',
          marginBottom: 16,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a3347'; e.currentTarget.style.color = '#94a3b8' }}
      >
        <Download size={14} />
        Export CSV
      </button>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading analyses...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{error}</div>
        ) : paginated.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No results found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a3347' }}>
                {['Patient', 'Model', 'Risk Label', 'Confidence', 'Detail', 'Date'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: 11, fontWeight: 600, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((a, i) => (
                <tr key={a.id} style={{
                  borderBottom: '1px solid #1e2535',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>
                    {a.patient_name || <span style={{ color: '#475569' }}>Unknown</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      background: '#1e2535', color: MODEL_COLORS[a.model_type] || '#94a3b8',
                      border: '1px solid #2a3347',
                    }}>
                      {MODEL_LABELS[a.model_type] || a.model_type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {a.risk_label ? <RiskBadge risk={a.risk_label} /> : <span style={{ color: '#475569' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#e2e8f0' }}>
                    {a.confidence != null ? `${(a.confidence * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <ResultDetail result={a.result} modelType={a.model_type} />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#475569' }}>
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '6px 14px', background: '#161b27', border: '1px solid #2a3347',
                borderRadius: 6, color: page === 1 ? '#475569' : '#94a3b8',
                cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit',
              }}
            >Prev</button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '6px 14px', background: '#161b27', border: '1px solid #2a3347',
                borderRadius: 6, color: page === totalPages ? '#475569' : '#94a3b8',
                cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit',
              }}
            >Next</button>
          </div>
        </div>
      )}
    </div>
  )
}