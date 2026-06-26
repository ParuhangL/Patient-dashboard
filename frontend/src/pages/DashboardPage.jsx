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
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
        {value ?? '—'}
        {unit && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>}
      </span>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-surface-alt)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '8px 12px', fontSize: 13,
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{payload[0].value}</div>
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

      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 32, flexWrap: 'wrap', gap: 12,
        borderBottom: '1px solid var(--border)', paddingBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, marginBottom: 0 }}>
            Patient overview and diagnostic summary
          </p>
        </div>

        <div style={{
          display: 'flex', gap: 2,
          background: 'var(--bg-base)', border: '1px solid var(--border)',
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
                  background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: active ? '#93c5fd' : 'var(--text-secondary)',
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
        <div style={{ color: 'var(--text-secondary)', padding: '60px 0', textAlign: 'center', fontSize: 14 }}>
          Loading...
        </div>
      ) : error ? (
        <div style={{ color: '#ef4444', padding: '60px 0', textAlign: 'center', fontSize: 14 }}>
          {error}
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 0,
            marginBottom: 28,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
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
                    width: 1, background: 'var(--border)',
                    margin: '16px 0', alignSelf: 'stretch',
                  }} />
                )
              }
              return (
                <div key={item.label} style={{
                  padding: '18px 20px',
                  borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                }}>
                  <MetricBlock label={item.label} value={item.value} unit={item.unit} />
                </div>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 16 }}>

            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Risk distribution
              </div>

              {pieData.every(d => d.value === 0) ? (
                <div style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
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

                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12 }}>
                    {pieData.map(entry => (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: RISK_COLORS[entry.name] || '#334155', flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {entry.name} <span style={{ color: 'var(--text-secondary)' }}>{entry.value}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Condition prevalence
              </div>

              {condData.every(d => d.count === 0) ? (
                <div style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
                  No data for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={condData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
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