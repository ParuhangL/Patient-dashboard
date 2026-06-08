import { useEffect, useState } from 'react'
import { getAnalyses } from '../api'
import { Search, Download } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { createPortal } from 'react-dom'

function RiskBadge({ risk }) {
  const cls = risk === 'HIGH' ? 'badge-high' : risk === 'MEDIUM' ? 'badge-medium' : 'badge-low'
  return <span className={cls}>{risk}</span>
}

function StatCard({ label, value, color = '#3b82f6' }) {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
  )
}

const MODEL_LABELS = {
  decision_tree:    ' Decision Tree',
  logistic:         ' Logistic Regression',
  linear_regression:' Linear Regression',
  kmeans:           ' KMeans',
  rule_based:       ' Rule Based',
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
            Diastolic: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
              {`${dbp} mmHg`}
            </span>
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
  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))

  if (data.length === 0) return (
    <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
      No risk label data yet
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} label={false} labelLine={false}>
          {data.map(entry => (
            <Cell key={entry.name} fill={RISK_COLORS[entry.name]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} />
        <Legend />
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
    <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
      No confidence data yet
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit="%" domain={[0, 100]} />
        <Tooltip
          contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8 }}
          labelStyle={{ color: '#e2e8f0' }}
          formatter={(v) => [`${v}%`, 'Avg Confidence']}
        />
        <Bar dataKey="avg_confidence" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// REPLACE the entire RiskScatterChart function:
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
    <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
      No scatter data yet
    </div>
  )

  return (
    <>
      {/* Legend */}
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
          <XAxis
            dataKey="confidence"
            name="Confidence"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            type="number"
            domain={[0, 100]}
            tickCount={6}
            tickFormatter={v => `${v}%`}
          />
          <YAxis
            dataKey="risk"
            name="Risk"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={v => ['', 'Non-Diabetic', 'MED', 'Diabetic'][v] || ''}
            domain={[0, 4]}
            ticks={[1, 2, 3]}
          />
          <ZAxis range={[40, 40]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0' }}
            itemStyle={{ color: '#94a3b8' }}
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
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modelFilter, setModelFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15
  const [expandedChart, setExpandedChart] = useState(null) // 'risk' | 'confidence' | 'scatter'

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

          // Handle both paginated {results:[]} and plain array responses
          if (data.results) {
            all = [...all, ...data.results]
            hasMore = !!data.next
            nextPage++
          } else {
            // Plain array — no pagination on backend
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

    fetchAll()
  }, [])

  // Client-side filter + search
  const filtered = analyses.filter(a => {
    const nameMatch = !search || (a.patient_name || '').toLowerCase().includes(search.toLowerCase())
    const modelMatch = !modelFilter || a.model_type === modelFilter
    const riskMatch = !riskFilter || a.risk_label === riskFilter
    return nameMatch && modelMatch && riskMatch
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Stats
  const total = analyses.length
  const highRisk = analyses.filter(a => a.risk_label === 'HIGH').length
  const diabetic = analyses.filter(a => a.result?.prediction === 'Diabetic').length
  const modelCounts = analyses.reduce((acc, a) => {
    acc[a.model_type] = (acc[a.model_type] || 0) + 1
    return acc
  }, {})
  const sorted = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])
  const topModel = sorted.length > 1 && sorted[0][1] === sorted[1][1] ? null : sorted[0]?.[0]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>ML Analysis</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          All analysis results across all patients and models
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Results"   value={total}    color="#3b82f6" />
        <StatCard label="High Risk"       value={highRisk} color="#ef4444" />
        <StatCard label="Diabetic Flags"  value={diabetic} color="#f59e0b" />
        <StatCard label="Most Used Model" value={topModel ? MODEL_LABELS[topModel]?.split(' ')[1] : 'All Equal'} color="#10b981" />
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
                style={{
                  background: '#161b27', border: '1px solid #2a3347',
                  borderRadius: 14, padding: 32,
                  width: '100%', maxWidth: 900,
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
                    {expandedChart === 'risk'       && 'Risk Distribution'}
                    {expandedChart === 'confidence' && 'Avg Confidence by Model'}
                    {expandedChart === 'scatter'    && 'Confidence vs Risk — Decision Tree & Logistic Regression'}
                  </div>
                  <button
                    onClick={() => setExpandedChart(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 22, lineHeight: 1 }}
                  >×</button>
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

      {/* Export button — exports current filtered results */}
        <button
          onClick={() => exportCSV(
            filtered.map(a => ({
              patient: a.patient_name,
              model: a.model_type,
              risk_label: a.risk_label,
              confidence: a.confidence != null ? `${(a.confidence * 100).toFixed(0)}%` : '',
              date: new Date(a.created_at).toLocaleDateString(),
              notes: a.notes || '',
            })),
            `analyses_${new Date().toISOString().slice(0,10)}.csv`
          )}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', background: '#161b27',
            border: '1px solid #2a3347', borderRadius: 8,
            color: '#94a3b8', fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap',
            transition: 'all 0.15s',
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