import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const adminClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/admin`,
  headers: { 'Content-Type': 'application/json' },
})

adminClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

async function adminFetch(path, options = {}) {
  try {
    const method = (options.method || 'GET').toLowerCase()
    const body = options.body ? JSON.parse(options.body) : undefined
    const res = await adminClient[method](path, body)
    return {
      json: () => Promise.resolve(res.data),
      ok: true,
      status: res.status,
    }
  } catch (error) {
    const status = error.response?.status || 500
    const data = error.response?.data || {}
    return {
      json: () => Promise.resolve(data),
      ok: false,
      status,
    }
  }
}

function StatCard({ label, value, sub, color = '#3b82f6' }) {
  return (
    <div style={{
      background: '#161b27', border: '1px solid #2a3347',
      borderRadius: 10, padding: '18px 20px',
    }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const MODEL_LABELS = {
  rule_based:        'Rule Based',
  linear_regression: 'Linear Regression',
  kmeans:            'KMeans',
  logistic:          'Logistic Regression',
  decision_tree:     'Decision Tree',
  isolation_forest:  'Isolation Forest',
}

const MODEL_COLORS = {
  rule_based:        '#06b6d4',
  linear_regression: '#3b82f6',
  kmeans:            '#8b5cf6',
  logistic:          '#10b981',
  decision_tree:     '#f59e0b',
  isolation_forest:  '#ef4444', 
}

function ConfidenceBar({ value }) {
  if (value == null) return <span style={{ fontSize: 12, color: '#475569' }}>—</span>
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#1e2535', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 600, minWidth: 32 }}>{pct}%</span>
    </div>
  )
}

const ACTION_STYLES = {
  create: { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', border: 'rgba(16,185,129,0.3)'  },
  update: { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6', border: 'rgba(59,130,246,0.3)'  },
  delete: { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.3)'   },
}

const NAV_ITEMS = [
  { key: 'overview',  label: 'Overview',    icon: '' },
  { key: 'ml',        label: 'ML Health',   icon: '' },
  { key: 'users',     label: 'Users',       icon: '' },
  { key: 'reports',   label: 'Reports',     icon: '' },
  { key: 'audit',     label: 'Audit Log',   icon: '' },
]

export default function AdminPage() {
  const navigate = useNavigate()
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}')

  const [activeSection, setActiveSection] = useState('overview')

  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [reports, setReports] = useState([])
  const [mlHealth, setMlHealth] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingReports, setLoadingReports] = useState(true)
  const [loadingML, setLoadingML] = useState(true)
  const [loadingAudit, setLoadingAudit] = useState(true)
  const [togglingId, setTogglingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [selectedReport, setSelectedReport] = useState(null)
  const [auditFilter, setAuditFilter] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)

  useEffect(() => {
    adminFetch('/stats/').then(r => r.json()).then(setStats).finally(() => setLoadingStats(false))
    adminFetch('/users/').then(r => r.json()).then(setUsers).finally(() => setLoadingUsers(false))
    adminFetch('/reports/').then(r => r.json()).then(setReports).finally(() => setLoadingReports(false))
    adminFetch('/ml-health/').then(r => r.json()).then(setMlHealth).finally(() => setLoadingML(false))
    adminFetch('/audit-log/').then(r => r.json()).then(setAuditLog).finally(() => setLoadingAudit(false))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
    navigate('/admin-panel/login')
  }

  const toggleActive = async (user) => {
    setTogglingId(user.id)
    try {
      const res = await adminFetch(`/users/${user.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !user.is_active }),
      })
      const updated = await res.json()
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: updated.is_active } : u))
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await adminFetch(`/users/${id}/`, { method: 'DELETE' })
      setUsers(prev => prev.filter(u => u.id !== id))
      setConfirmDelete(null)
    } finally {
      setDeletingId(null)
    }
  }

  const fmt = (iso) => iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const fmtDateTime = (iso) => iso
    ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  const filteredAudit = auditFilter ? auditLog.filter(l => l.action === auditFilter) : auditLog

  // ── Section renderers ──────────────────────────────────────────────

  const renderOverview = () => (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>System Overview</div>

      {loadingStats ? (
        <div style={{ color: '#64748b' }}>Loading stats…</div>
      ) : stats && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            System Totals
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
            <StatCard label="Total Users"     value={stats.totals.users}    color="#3b82f6" sub={`+${stats.last_30_days.new_users} this month`} />
            <StatCard label="Total Patients"  value={stats.totals.patients} color="#10b981" sub={`+${stats.last_30_days.new_patients} this month`} />
            <StatCard label="Total Analyses"  value={stats.totals.analyses} color="#8b5cf6" sub={`+${stats.last_30_days.new_analyses} this month`} />
            <StatCard label="Medical Records" value={stats.totals.records}  color="#f59e0b" />
            <StatCard label="Batch Reports"   value={stats.totals.reports}  color="#06b6d4" />
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            Risk Distribution (system-wide)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <StatCard label="High Risk"   value={stats.risk_distribution.HIGH}   color="#ef4444" />
            <StatCard label="Medium Risk" value={stats.risk_distribution.MEDIUM} color="#f59e0b" />
            <StatCard label="Low Risk"    value={stats.risk_distribution.LOW}    color="#10b981" />
          </div>
        </>
      )}
    </div>
  )

  const renderML = () => (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>ML Model Health</div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>
        Accuracy metrics sourced from the most recent completed batch upload.
      </div>
      <div style={{ background: '#161b27', border: '1px solid #2a3347', borderRadius: 10, overflow: 'hidden' }}>
        {loadingML ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Loading ML health…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a3347' }}>
                {['Model', 'Total Runs', 'Avg Confidence', 'Train Acc', 'Test Acc', 'Last Run', 'High', 'Medium', 'Low'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mlHealth.map((m, i) => {
                const hasAccuracy = m.accuracy_train != null || m.accuracy_test != null
                const gap = m.accuracy_train != null && m.accuracy_test != null
                  ? m.accuracy_train - m.accuracy_test
                  : null
                const testColor = gap == null
                  ? '#64748b'
                  : gap <= 0.10 ? '#10b981' : '#f59e0b'

                return (
                  <tr key={m.model_type} style={{ borderBottom: '1px solid #1e2535', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>

                    {/* Model badge */}
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: `${MODEL_COLORS[m.model_type]}18`, color: MODEL_COLORS[m.model_type], border: `1px solid ${MODEL_COLORS[m.model_type]}40` }}>
                        {MODEL_LABELS[m.model_type] || m.model_type}
                      </span>
                    </td>

                    {/* Total runs */}
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: m.total_runs === 0 ? '#475569' : '#e2e8f0' }}>{m.total_runs}</span>
                      {m.total_runs === 0 && <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 6, fontWeight: 600 }}>UNUSED</span>}
                    </td>

                    {/* Avg confidence */}
                    <td style={{ padding: '11px 14px', minWidth: 140 }}><ConfidenceBar value={m.avg_confidence} /></td>

                    {/* Train accuracy */}
                    <td style={{ padding: '11px 14px', minWidth: 90 }}>
                      {!hasAccuracy ? (
                        <span style={{ fontSize: 11, color: '#334155', fontStyle: 'italic' }}>no data</span>
                      ) : m.accuracy_train == null ? (
                        <span style={{ fontSize: 12, color: '#475569' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                            {(m.accuracy_train * 100).toFixed(1)}%
                          </span>
                          <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                            {m.metric_label} train
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Test accuracy */}
                    <td style={{ padding: '11px 14px', minWidth: 90 }}>
                      {!hasAccuracy ? (
                        <span style={{ fontSize: 11, color: '#334155', fontStyle: 'italic' }}>no data</span>
                      ) : m.accuracy_test == null ? (
                        <span style={{ fontSize: 12, color: '#475569' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: testColor }}>
                            {(m.accuracy_test * 100).toFixed(1)}%
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                              {m.metric_label} test
                            </span>
                            {gap != null && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: testColor }}>
                                {gap <= 0.10 ? '✓' : '△'}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Last run */}
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>{fmtDateTime(m.last_run)}</td>

                    {/* Risk counts */}
                    <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: m.risk_counts.HIGH > 0 ? '#ef4444' : '#475569' }}>{m.risk_counts.HIGH || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: m.risk_counts.MEDIUM > 0 ? '#f59e0b' : '#475569' }}>{m.risk_counts.MEDIUM || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: m.risk_counts.LOW > 0 ? '#10b981' : '#475569' }}>{m.risk_counts.LOW || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 14, paddingLeft: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>✓</span>
          <span style={{ fontSize: 11, color: '#475569' }}>Test within 10% of train (good fit)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>△</span>
          <span style={{ fontSize: 11, color: '#475569' }}>Gap &gt;10% (possible overfit)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#334155', fontStyle: 'italic' }}>no data</span>
          <span style={{ fontSize: 11, color: '#475569' }}>— upload a CSV to populate</span>
        </div>
      </div>
    </div>
  )

  const renderUsers = () => (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>All Users ({users.length})</div>
      <div style={{ background: '#161b27', border: '1px solid #2a3347', borderRadius: 10, overflow: 'hidden' }}>
        {loadingUsers ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Loading users…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a3347' }}>
                {['Username', 'Email', 'Patients', 'Joined', 'Last Login', 'Last Upload', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #1e2535', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{u.username}</div>
                    {u.is_staff && <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 3 }}>STAFF</span>}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#94a3b8' }}>{u.email || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{u.patient_count}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>{fmt(u.date_joined)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>{fmt(u.last_login)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>{fmt(u.last_upload)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={togglingId === u.id || u.id === adminUser.id}
                      style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4, border: 'none', cursor: (togglingId === u.id || u.id === adminUser.id) ? 'not-allowed' : 'pointer', background: u.is_active ? '#064e3b' : '#1e2535', color: u.is_active ? '#10b981' : '#64748b', fontFamily: 'inherit', opacity: togglingId === u.id ? 0.6 : 1 }}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {u.id !== adminUser.id && (
                      <button
                        onClick={() => setConfirmDelete(u)}
                        style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  const renderReports = () => (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Batch Reports ({reports.length})</div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>Click a row to view ETL and ML details.</div>
      <div style={{ background: '#161b27', border: '1px solid #2a3347', borderRadius: 10, overflow: 'hidden' }}>
        {loadingReports ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Loading reports…</div>
        ) : reports.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>No reports yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a3347' }}>
                {['File', 'Owner', 'Status', 'Total Rows', 'Linked', 'Unlinked', 'Date'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  style={{ borderBottom: '1px solid #1e2535', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                >
                  <td style={{ padding: '11px 14px' }}><div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{r.file_name}</div></td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#94a3b8' }}>{r.owner}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: r.status === 'completed' ? '#064e3b' : r.status === 'partial' ? '#451a03' : '#1a0f0f', color: r.status === 'completed' ? '#10b981' : r.status === 'partial' ? '#f59e0b' : '#ef4444' }}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{r.total_rows}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#10b981' }}>{r.linked_patients}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: r.unlinked_rows > 0 ? '#f59e0b' : '#64748b' }}>{r.unlinked_rows}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>{fmt(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  const renderAudit = () => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
          Audit Log ({filteredAudit.length}{auditFilter ? ' filtered' : ''})
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['', 'create', 'update', 'delete'].map(f => (
            <button
              key={f}
              onClick={() => setAuditFilter(f)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                background: auditFilter === f
                  ? f === '' ? '#2a3347' : f === 'create' ? 'rgba(16,185,129,0.2)' : f === 'update' ? 'rgba(59,130,246,0.2)' : 'rgba(239,68,68,0.2)'
                  : '#1e2535',
                color: auditFilter === f
                  ? f === '' ? '#e2e8f0' : f === 'create' ? '#10b981' : f === 'update' ? '#3b82f6' : '#ef4444'
                  : '#64748b',
              }}
            >
              {f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#161b27', border: '1px solid #2a3347', borderRadius: 10, overflow: 'hidden' }}>
        {loadingAudit ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Loading audit log…</div>
        ) : filteredAudit.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>No audit entries yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a3347' }}>
                {['Action', 'User', 'Patient', 'Patient ID', 'Timestamp'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAudit.map((log, i) => {
                const s = ACTION_STYLES[log.action] || ACTION_STYLES.update
                return (
                  <tr
                    key={log.id}
                    onClick={() => log.details && Object.keys(log.details).length > 0 ? setSelectedLog(log) : null}
                    style={{ borderBottom: '1px solid #1e2535', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', cursor: log.details && Object.keys(log.details).length > 0 ? 'pointer' : 'default', transition: 'background 0.15s' }}
                    onMouseEnter={e => { if (log.details && Object.keys(log.details).length > 0) e.currentTarget.style.background = 'rgba(59,130,246,0.07)' }}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                  >
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: 'uppercase' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>{log.user}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#e2e8f0' }}>{log.object_str}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#475569' }}>#{log.object_id}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {fmtDateTime(log.timestamp)}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '1px 6px', borderRadius: 3, border: '1px solid rgba(59,130,246,0.2)' }}>VIEW</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  const SECTIONS = { overview: renderOverview, ml: renderML, users: renderUsers, reports: renderReports, audit: renderAudit }

  // ── Layout ─────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0d14', overflow: 'hidden' }}>

      {/* Sidebar */}
      <div style={{
        width: 220, flexShrink: 0,
        background: '#0d1117', borderRight: '1px solid #1e2535',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1e2535' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}> Admin Panel</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{adminUser.username}</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(item => {
            const isActive = activeSection === item.key
            return (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8, border: 'none',
                  background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color: isActive ? '#60a5fa' : '#64748b',
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', width: '100%',
                  transition: 'all 0.15s',
                  borderLeft: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '16px 10px', borderTop: '1px solid #1e2535' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: '1px solid rgba(239,68,68,0.2)',
              background: 'rgba(239,68,68,0.06)',
              color: '#ef4444', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{
          padding: '16px 28px', borderBottom: '1px solid #1e2535',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#0d1117', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
              {NAV_ITEMS.find(n => n.key === activeSection)?.icon}{' '}
              {NAV_ITEMS.find(n => n.key === activeSection)?.label}
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Patient Diagnostic Dashboard — Admin</div>
          </div>
        </div>

        {/* Scrollable section content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {SECTIONS[activeSection]?.()}
        </div>
      </div>

      {/* ── Modals (unchanged) ── */}

      {selectedReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '40px 24px' }} onClick={() => setSelectedReport(null)}>
          <div style={{ background: '#161b27', border: '1px solid #2a3347', borderRadius: 12, padding: 28, width: '100%', maxWidth: 680, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{selectedReport.file_name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Uploaded by <span style={{ color: '#94a3b8' }}>{selectedReport.owner}</span> · {fmt(selectedReport.created_at)}</div>
              </div>
              <button onClick={() => setSelectedReport(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>ETL Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              {[{ label: 'Total Rows', value: selectedReport.total_rows, color: '#3b82f6' }, { label: 'Linked', value: selectedReport.linked_patients, color: '#10b981' }, { label: 'Unlinked', value: selectedReport.unlinked_rows, color: selectedReport.unlinked_rows > 0 ? '#f59e0b' : '#64748b' }].map(({ label, value, color }) => (
                <div key={label} style={{ background: '#0f1117', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>
            {selectedReport.etl_report && Object.keys(selectedReport.etl_report).length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>ETL Details</div>
                <div style={{ background: '#0f1117', borderRadius: 8, padding: 14, fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: 20, maxHeight: 180, overflowY: 'auto' }}>
                  {JSON.stringify(selectedReport.etl_report, null, 2)}
                </div>
              </>
            )}
            {selectedReport.ml_results && Object.keys(selectedReport.ml_results).length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>ML Results</div>
                <div style={{ background: '#0f1117', borderRadius: 8, padding: 14, fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto' }}>
                  {JSON.stringify(selectedReport.ml_results, null, 2)}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#161b27', border: '1px solid #7f1d1d', borderRadius: 12, padding: 28, maxWidth: 380, width: '100%' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fca5a5', marginBottom: 10 }}>Delete {confirmDelete.username}?</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>This will permanently delete the user and all their patients, records, and analyses.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handleDelete(confirmDelete.id)} disabled={deletingId === confirmDelete.id} style={{ padding: '8px 18px', background: '#dc2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: deletingId === confirmDelete.id ? 0.7 : 1 }}>
                {deletingId === confirmDelete.id ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #2a3347', borderRadius: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '40px 24px' }} onClick={() => setSelectedLog(null)}>
          <div style={{ background: '#161b27', border: '1px solid #2a3347', borderRadius: 12, padding: 28, width: '100%', maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {(() => { const s = ACTION_STYLES[selectedLog.action] || ACTION_STYLES.update; return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: 'uppercase' }}>{selectedLog.action}</span> })()}
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{selectedLog.object_str}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>by <span style={{ color: '#94a3b8' }}>{selectedLog.user}</span> · {fmtDateTime(selectedLog.timestamp)}</div>
              </div>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>
            {selectedLog.details?.changes && Object.keys(selectedLog.details.changes).length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Fields Changed ({Object.keys(selectedLog.details.changes).length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(selectedLog.details.changes).map(([field, { from, to }]) => (
                    <div key={field} style={{ background: '#0f1117', borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: '120px 1fr 24px 1fr', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{field.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: 4, textDecoration: 'line-through', wordBreak: 'break-all' }}>{from === 'None' || from === '' ? <em style={{ opacity: 0.5 }}>empty</em> : from}</span>
                      <span style={{ textAlign: 'center', color: '#475569', fontSize: 14 }}>→</span>
                      <span style={{ fontSize: 12, color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '2px 8px', borderRadius: 4, wordBreak: 'break-all' }}>{to === 'None' || to === '' ? <em style={{ opacity: 0.5 }}>empty</em> : to}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {selectedLog.details?.fields && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Patient Created</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(selectedLog.details.fields).map(([field, value]) => (
                    <div key={field} style={{ background: '#0f1117', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{field.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 13, color: '#e2e8f0' }}>{value || <em style={{ color: '#475569' }}>empty</em>}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}