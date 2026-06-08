import { useEffect, useState } from 'react'
import { getDashboardSummary } from '../api'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'

const RISK_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' }

const RANGE_OPTIONS = [
  { label: '30d',  value: 30 },
  { label: '90d',  value: 90 },
  { label: '365d', value: 365 },
  { label: 'All',  value: null },
]

function MetricBlock({ label, value, unit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontSize: 26, fontWeight: 600, color: '#e2e8f0', lineHeight: 1 }}>
        {value ?? '—'}
        {unit && <span style={{ fontSize: 13, fontWeight: 400, color: '#64748b', marginLeft: 4 }}>{unit}</span>}
      </span>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1e2535', border: '1px solid #2a3347',
      borderRadius: 6, padding: '8px 12px', fontSize: 13,
    }}>
      <div style={{ color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{payload[0].value}</div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [days, setDays] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getDashboardSummary(days)
      .then(res => setData(res.data))
      .catch(err => setError(err.userMessage || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [days])

  const { summary, risk_distribution, condition_prevalence } = data || {}
  const pieData  = (risk_distribution   || []).map(r => ({ name: r.risk,      value: r.count }))
  const condData = (condition_prevalence || []).map(c => ({ name: c.condition, count: c.count }))

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 32, flexWrap: 'wrap', gap: 12,
        borderBottom: '1px solid #1e2535', paddingBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 3, marginBottom: 0 }}>
            Patient overview and diagnostic summary
          </p>
        </div>

        <div style={{
          display: 'flex', gap: 2,
          background: '#0f1117', border: '1px solid #1e2535',
          borderRadius: 6, padding: 3,
        }}>
          {RANGE_OPTIONS.map(opt => {
            const active = days === opt.value
            return (
              <button
                key={opt.label}
                onClick={() => setDays(opt.value)}
                style={{
                  padding: '5px 12px', borderRadius: 4, border: 'none',
                  background: active ? '#1e2d45' : 'transparent',
                  color: active ? '#93c5fd' : '#475569',
                  fontSize: 12, fontWeight: active ? 500 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center', fontSize: 14 }}>
          Loading...
        </div>
      ) : error ? (
        <div style={{ color: '#ef4444', padding: '60px 0', textAlign: 'center', fontSize: 14 }}>
          {error}
        </div>
      ) : (
        <>
          {/* Stats strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 0,
            marginBottom: 28,
            background: '#111827',
            border: '1px solid #1e2535',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {[
              { label: 'Patients',   value: summary.total_patients },
              { label: 'Records',    value: summary.total_records },
              { label: 'Analyses',   value: summary.total_analyses },
              null,
              { label: 'Systolic BP', value: summary.avg_bp_systolic, unit: 'mmHg' },
              { label: 'Glucose',     value: summary.avg_glucose,     unit: 'mg/dL' },
              { label: 'BMI',         value: summary.avg_bmi,         unit: 'kg/m²' },
            ].map((item, i) => {
              if (item === null) {
                return (
                  <div key={`divider-${i}`} style={{
                    width: 1, background: '#2a3347',
                    margin: '16px 0', alignSelf: 'stretch',
                  }} />
                )
              }
              return (
                <div key={item.label} style={{
                  padding: '18px 20px',
                  borderRight: i < 6 ? '1px solid #1e2535' : 'none',
                }}>
                  <MetricBlock label={item.label} value={item.value} unit={item.unit} />
                </div>
              )
            })}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 16 }}>

            {/* Risk Distribution */}
            <div style={{
              background: '#111827', border: '1px solid #1e2535',
              borderRadius: 8, padding: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8', marginBottom: 20 }}>
                Risk distribution
              </div>

              {pieData.every(d => d.value === 0) ? (
                <div style={{ color: '#334155', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
                  No data for this period
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={70} innerRadius={36}
                        label={false} labelLine={false}
                      >
                        {pieData.map(entry => (
                          <Cell key={entry.name} fill={RISK_COLORS[entry.name] || '#334155'} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12 }}>
                    {pieData.map(entry => (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: RISK_COLORS[entry.name] || '#334155', flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          {entry.name} <span style={{ color: '#94a3b8' }}>{entry.value}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Condition Prevalence */}
            <div style={{
              background: '#111827', border: '1px solid #1e2535',
              borderRadius: 8, padding: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8', marginBottom: 20 }}>
                Condition prevalence
              </div>

              {condData.every(d => d.count === 0) ? (
                <div style={{ color: '#334155', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
                  No data for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={condData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#475569', fontSize: 12 }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#475569', fontSize: 12 }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}