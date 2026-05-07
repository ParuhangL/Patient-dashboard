import { useEffect, useState } from 'react'
import { getDashboardSummary } from '../api'
import { Users, ClipboardList, FlaskConical, Activity, Droplets, Heart, CalendarDays } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'

const RISK_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' }

const RANGE_OPTIONS = [
  { label: '30d',  value: 30 },
  { label: '90d',  value: 90 },
  { label: '365d', value: 365 },
  { label: 'All',  value: null },
]

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>
          {value ?? '—'}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [days, setDays] = useState(null) // null = All time

  useEffect(() => {
    setLoading(true)
    setError(null)
    getDashboardSummary(days)
      .then(res => setData(res.data))
      .catch(err => setError(err.userMessage || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [days])

  const { summary, risk_distribution, condition_prevalence } = data || {}
  const pieData  = (risk_distribution  || []).map(r => ({ name: r.risk,      value: r.count }))
  const condData = (condition_prevalence || []).map(c => ({ name: c.condition, count: c.count }))

  return (
    <div className="animate-fade-in">
      {/* Header + range toggle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Overview of all patients and diagnostic results
          </p>
        </div>

        {/* Date range toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: '#0f1117', border: '1px solid #2a3347',
          borderRadius: 8, padding: 3,
        }}>
          {RANGE_OPTIONS.map(opt => {
            const active = days === opt.value
            return (
              <button
                key={opt.label}
                onClick={() => setDays(opt.value)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: active ? '#2563eb' : 'transparent',
                  color: active ? '#fff' : '#64748b',
                  fontSize: 12, fontWeight: active ? 600 : 400,
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
        <div style={{ color: '#64748b', padding: 60, textAlign: 'center' }}>Loading dashboard...</div>
      ) : error ? (
        <div style={{ color: '#ef4444', padding: 60, textAlign: 'center' }}>Error: {error}</div>
      ) : (
        <>
          {/* Row 1 — Count cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <StatCard icon={Users}         label="Total Patients"  value={summary.total_patients} color="#3b82f6" />
            <StatCard icon={ClipboardList} label="Medical Records" value={summary.total_records}  color="#10b981" />
            <StatCard icon={FlaskConical}  label="Analyses Run"    value={summary.total_analyses} color="#f59e0b" />
          </div>

          {/* Row 2 — Avg metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            <StatCard icon={Activity}     label="Avg Systolic BP" value={summary.avg_bp_systolic ?? '—'} sub="mmHg"  color="#ef4444" />
            <StatCard icon={Droplets}     label="Avg Glucose"     value={summary.avg_glucose     ?? '—'} sub="mg/dL" color="#8b5cf6" />
            <StatCard icon={Heart}        label="Avg BMI"         value={summary.avg_bmi         ?? '—'} sub="kg/m²" color="#ec4899" />
            <StatCard icon={CalendarDays} label="Avg Age"         value={summary.avg_age ? `${summary.avg_age} yrs` : '—'} sub="years" color="#06b6d4" />
          </div>

          {/* Row 3 — Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Risk Pie */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>
                Risk Distribution
              </div>
              {pieData.every(d => d.value === 0) ? (
                <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
                  No risk data for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false} labelLine={false}>
                      {pieData.map(entry => (
                        <Cell key={entry.name} fill={RISK_COLORS[entry.name] || '#64748b'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Condition Prevalence Bar */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>
                Condition Prevalence
              </div>
              {condData.every(d => d.count === 0) ? (
                <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
                  No condition data for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={condData} margin={{ top: 4, right: 16, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: '#1e2535', border: '1px solid #2a3347', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Row 4 — System Status */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>System Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Backend API',  status: 'Online',    color: '#10b981' },
                { label: 'Database',     status: 'Connected', color: '#10b981' },
                { label: 'ML Models',    status: 'Ready',     color: '#3b82f6' },
                { label: 'ETL Pipeline', status: 'Ready',     color: '#3b82f6' },
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: '#1e2535', borderRadius: 8,
                }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>{item.label}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: item.color,
                    background: `${item.color}20`, padding: '2px 8px', borderRadius: 4,
                  }}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}