import { useState, useEffect } from 'react'
import { analyseDataset, getReports, getReportDetail, createPatient, analysePatient, deleteReport } from '../api'
import { Upload, FileText, X, AlertCircle, Eye, UserPlus, Trash2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

function Section({ title, children }) {
  return (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

function StatMini({ label, value, color = '#3b82f6' }) {
  return (
    <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ETLDetail({ label, items, color = '#f59e0b', columns, renderRow }) {
  const [open, setOpen] = useState(false)
  if (!items || items.length === 0) return null
  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color, fontFamily: 'inherit', padding: 0,
        }}
      >
        <span style={{
          display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s', fontSize: 10,
        }}>▶</span>
        {label} ({items.length})
      </button>
      {open && (
        <div style={{
          marginTop: 8, background: 'var(--bg-base)', borderRadius: 8,
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {columns.map(c => (
                  <th key={c} style={{
                    padding: '7px 12px', textAlign: 'left',
                    fontSize: 10, color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.4px',
                  }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  {renderRow(item)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ETLReportDetail({ etl }) {
  if (!etl) return null
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
        <StatMini label="Total Rows"         value={etl.total_rows}         color="#3b82f6" />
        <StatMini label="Duplicates Removed" value={etl.dropped_duplicates} color="#f59e0b" />
        <StatMini label="Missing Filled"     value={etl.filled_missing}     color="#10b981" />
        <StatMini label="Outliers Capped"    value={etl.outliers_capped}    color="#06b6d4" />
      </div>

      {etl.warnings?.length > 0 && (
        <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 8 }}>
          ⚠ {etl.warnings.join(' · ')}
        </div>
      )}

      <ETLDetail
        label="Duplicate rows removed"
        items={etl.duplicate_details}
        color="#f59e0b"
        columns={['Row', 'Name', 'Date of Birth']}
        renderRow={item => (<>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)' }}>#{item.row}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)' }}>{item.name || '—'}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{item.dob || '—'}</td>
        </>)}
      />

      <ETLDetail
        label="Missing values filled with column median"
        items={etl.missing_details}
        color="#10b981"
        columns={['Row', 'Name', 'Column', 'Filled With']}
        renderRow={item => (<>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)' }}>#{item.row}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)' }}>{item.name || '—'}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{item.column}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: '#10b981', fontWeight: 600 }}>{item.filled_with}</td>
        </>)}
      />

      <ETLDetail
        label="Outliers capped to clinical bounds"
        items={etl.outlier_details}
        color="#06b6d4"
        columns={['Row', 'Name', 'Column', 'Original', 'Capped To', 'Bound']}
        renderRow={item => (<>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)' }}>#{item.row}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)' }}>{item.name || '—'}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{item.column}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{item.original}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: '#06b6d4', fontWeight: 600 }}>{item.capped_to}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{item.bound}</td>
        </>)}
      />

      <ETLDetail
        label="Rows removed (empty or no name)"
        items={etl.empty_row_details}
        color="#ef4444"
        columns={['Row', 'Reason']}
        renderRow={item => (<>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)' }}>#{item.row}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{item.reason}</td>
        </>)}
      />

      <ETLDetail
        label="Unparseable dates"
        items={etl.invalid_date_details}
        color="#8b5cf6"
        columns={['Row', 'Name', 'Value', 'Note']}
        renderRow={item => (<>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)' }}>#{item.row}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)' }}>{item.name || '—'}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444' }}>{item.value}</td>
          <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{item.reason}</td>
        </>)}
      />
    </div>
  )
}

function RiskBadge({ risk }) {
  const bgVar   = risk === 'LOW' || risk === 'Low Risk'      ? 'var(--risk-low-bg)'   : risk === 'MEDIUM' || risk === 'Moderate Risk' ? 'var(--risk-med-bg)'   : 'var(--risk-high-bg)'
  const textVar = risk === 'LOW' || risk === 'Low Risk'      ? 'var(--risk-low-text)' : risk === 'MEDIUM' || risk === 'Moderate Risk' ? 'var(--risk-med-text)' : 'var(--risk-high-text)'
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: bgVar, color: textVar }}>{risk}</span>
}

function ModelInfoBox({ info }) {
  if (!info) return null

  const SKIP = ['features', 'classes', 'cluster_labels', 'feature_importances', 'risk_thresholds', 'confusion_matrix']

  const accuracy_train = info.accuracy_train ?? info.accuracy ?? null
  const accuracy_test  = info.accuracy_test  ?? null
  const r2_train       = info.r2_score_train ?? info.r2_score ?? null
  const r2_test        = info.r2_score_test  ?? null

  const MANUAL = [
    'accuracy', 'accuracy_train', 'accuracy_test',
    'r2_score', 'r2_score_train', 'r2_score_test',
    'r2_score_dbp', 'r2_score_dbp_train', 'r2_score_dbp_test',
    'train_size', 'test_size',
  ]

  const hasSplit = info.train_size != null

  return (
    <div style={{
      background: 'var(--bg-base)', borderRadius: 8, padding: '10px 14px',
      fontSize: 11, color: 'var(--text-muted)', marginBottom: 12,
      display: 'flex', flexWrap: 'wrap', gap: '6px 20px',
      alignItems: 'center',
    }}>
      {Object.entries(info)
        .filter(([k]) => !SKIP.includes(k) && !MANUAL.includes(k))
        .map(([k, v]) => (
          <span key={k}>
            <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{k}: </span>
            <span style={{ color: 'var(--text-primary)' }}>
              {v === null || v === undefined ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
            </span>
          </span>
        ))}

      {hasSplit && info.test_size != null && (
        <span>
          <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>SPLIT: </span>
          <span style={{ color: 'var(--text-primary)' }}>{info.train_size} train / {info.test_size} test</span>
        </span>
      )}

      {accuracy_train != null && (
        <span>
          <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>ACCURACY: </span>
          <span style={{ color: 'var(--text-primary)' }}>{(accuracy_train * 100).toFixed(1)}% train</span>
          {accuracy_test != null && (
            <>
              <span style={{ color: 'var(--text-secondary)' }}> / </span>
              <span style={{ color: accuracy_test >= accuracy_train - 0.1 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                {(accuracy_test * 100).toFixed(1)}% test
              </span>
            </>
          )}
        </span>
      )}

      {r2_train != null && (
        <span>
          <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>R² SBP: </span>
          <span style={{ color: 'var(--text-primary)' }}>{r2_train} train</span>
          {r2_test != null && (
            <>
              <span style={{ color: 'var(--text-secondary)' }}> / </span>
              <span style={{ color: r2_test >= r2_train - 0.1 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                {r2_test} test
              </span>
            </>
          )}
        </span>
      )}

      {(info.r2_score_dbp_train ?? info.r2_score_dbp) != null && (
        <span>
          <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>R² DBP: </span>
          <span style={{ color: 'var(--text-primary)' }}>{info.r2_score_dbp_train ?? info.r2_score_dbp} train</span>
          {info.r2_score_dbp_test != null && (
            <>
              <span style={{ color: 'var(--text-secondary)' }}> / </span>
              <span style={{ color: info.r2_score_dbp_test >= (info.r2_score_dbp_train ?? info.r2_score_dbp) - 0.1 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                {info.r2_score_dbp_test} test
              </span>
            </>
          )}
        </span>
      )}

      {info.inertia_train != null && (
        <span>
          <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>INERTIA: </span>
          <span style={{ color: 'var(--text-primary)' }}>{info.inertia_train} train</span>
          {info.inertia_test != null && (
            <>
              <span style={{ color: 'var(--text-secondary)' }}> / </span>
              <span style={{ color: 'var(--text-primary)' }}>{info.inertia_test} test</span>
            </>
          )}
        </span>
      )}
    </div>
  )
}

function FeatureImportanceChart({ featureImportances }) {
  if (!featureImportances || Object.keys(featureImportances).length === 0) return null

  const FEATURE_LABELS = {
    age:                      'Age',
    bmi:                      'BMI',
    glucose_level:            'Glucose',
    blood_pressure_systolic:  'Systolic BP',
    blood_pressure_diastolic: 'Diastolic BP',
    heart_rate:               'Heart Rate',
    cholesterol:              'Cholesterol',
    is_smoker:                'Smoker',
    has_hypertension:         'Hypertension',
    is_diabetic:              'Diabetic',
  }

  const data = Object.entries(featureImportances)
    .map(([key, value]) => ({
      feature: FEATURE_LABELS[key] || key,
      importance: value,
      pct: (value * 100).toFixed(1),
    }))
    .sort((a, b) => b.importance - a.importance)

  const maxImp = data[0]?.importance || 1
  const getColor = (imp) => {
    const intensity = imp / maxImp
    if (intensity > 0.66) return '#8b5cf6'
    if (intensity > 0.33) return '#6d44c4'
    return '#4a2d8f'
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
        Feature Importance — Decision Tree
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 14 }}>
        Which features the model used most to classify patient risk. Higher = more influential.
      </div>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 90, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, maxImp * 1.1]}
            tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
            tickFormatter={v => `${(v * 100).toFixed(0)}%`}
          />
          <YAxis
            type="category"
            dataKey="feature"
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            width={85}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border)', borderRadius: 8 }}
            labelStyle={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12 }}
            formatter={(v) => [`${(v * 100).toFixed(1)}%`, 'Importance']}
            cursor={{ fill: 'rgba(139,92,246,0.06)' }}
          />
          <Bar dataKey="importance" radius={[0, 4, 4, 0]} label={{
            position: 'right',
            formatter: (v) => `${(v * 100).toFixed(1)}%`,
            fill: 'var(--text-muted)',
            fontSize: 11,
          }}>
            {data.map((entry, i) => (
              <Cell key={i} fill={getColor(entry.importance)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TrendTable({ data }) {
  return (
    <div>
      <ModelInfoBox info={data.model_info} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Patient', 'Predicted Systolic BP', 'Predicted Diastolic BP'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.predictions.map((val, i) => {
            const name = typeof val === 'object' ? val.patient_name : null
            const sbp  = typeof val === 'object' ? (val.predicted_bp ?? val.value ?? val.predicted_systolic_bp) : val
            const dbp  = typeof val === 'object' ? val.predicted_diastolic_bp : null
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>{name || `Patient ${i + 1}`}</td>
                <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{sbp != null ? Number(sbp).toFixed(1) : '—'} mmHg</td>
                <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{dbp != null ? Number(dbp).toFixed(1) : '—'} mmHg</td>
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
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Patient', 'Cluster', 'Risk Profile'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.predictions.map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>{p.patient_name || `Patient ${i + 1}`}</td>
              <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>{p.cluster_id}</td>
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
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Patient', 'Prediction', 'Diabetic %', 'Non-Diabetic %'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.predictions.map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>{p.patient_name || `Patient ${i + 1}`}</td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                  background: p.prediction === 'Diabetic' ? 'var(--risk-high-bg)' : 'var(--risk-low-bg)',
                  color: p.prediction === 'Diabetic' ? 'var(--risk-high-text)' : 'var(--risk-low-text)',
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
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Patient', 'Risk Label', 'Confidence'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.predictions.map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>{p.patient_name || `Patient ${i + 1}`}</td>
              <td style={{ padding: '8px 12px' }}><RiskBadge risk={p.risk_label} /></td>
              <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)' }}>{(p.confidence * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <FeatureImportanceChart featureImportances={data.model_info?.feature_importances} />
    </div>
  )
}

function RuleBasedTable({ data }) {
  return (
    <div>
      <ModelInfoBox info={data.model_info} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Patient', 'Risk Label', 'Risk Score', 'Confidence', 'Triggered Rules'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.predictions.map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>{p.patient_name || `Patient ${i + 1}`}</td>
              <td style={{ padding: '8px 12px' }}><RiskBadge risk={p.risk_label} /></td>
              <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{p.risk_score}</td>
              <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)' }}>{(p.confidence * 100).toFixed(0)}%</td>
              <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)', maxWidth: 300 }}>
                {p.triggered_rules?.length > 0 ? p.triggered_rules.join(' · ') : <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>None</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AnomalyTable({ data }) {
  const preds       = data.predictions || []
  const info        = data.model_info  || {}
  const anomalyCount = preds.filter(p => p.is_anomaly).length
  const normalCount  = preds.length - anomalyCount

  return (
    <div>
      <ModelInfoBox info={info} />

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 0, marginBottom: 16,
        background: 'var(--bg-base)', border: '1px solid var(--border)',
        borderRadius: 8, overflow: 'hidden',
      }}>
        {[
          { label: 'Total Patients', value: preds.length,  color: '#3b82f6' },
          { label: 'Anomalies',      value: anomalyCount,  color: '#ef4444' },
          { label: 'Normal',         value: normalCount,   color: '#10b981' },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: '12px 16px', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Patient', 'Status', 'Anomaly Score', 'Note'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preds.map((p, i) => (
            <tr key={i} style={{
              borderBottom: '1px solid var(--border)',
              background: p.is_anomaly ? 'rgba(239,68,68,0.04)' : 'transparent',
            }}>
              <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                {p.patient_name || `Patient ${i + 1}`}
              </td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 4,
                  background: p.is_anomaly ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.12)',
                  color: p.is_anomaly ? '#f87171' : '#10b981',
                  border: `1px solid ${p.is_anomaly ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                }}>
                  {p.status}
                </span>
              </td>
              <td style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 6, maxWidth: 120 }}>
                    <div style={{
                      height: 6, borderRadius: 4,
                      width: `${(p.anomaly_score ?? 0) * 100}%`,
                      background: p.is_anomaly ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : '#10b981',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: p.is_anomaly ? '#f87171' : 'var(--text-muted)', fontWeight: p.is_anomaly ? 600 : 400 }}>
                    {p.anomaly_score != null ? (p.anomaly_score * 100).toFixed(0) : '—'}%
                  </span>
                </div>
              </td>
              <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {p.is_anomaly ? 'Vitals statistically unusual — review recommended' : 'Within expected population range'}
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
    trend_prediction:   { label: 'Trend Prediction (Linear Regression)',     Component: TrendTable },
    clustering:         { label: 'Patient Clustering (KMeans)',              Component: ClusterTable },
    disease_prediction: { label: 'Disease Prediction (Logistic Regression)', Component: DiseaseTable },
    diagnosis_tree:     { label: 'Diagnosis Tree (Decision Tree)',           Component: DiagnosisTable },
    rule_based:         { label: 'Rule-Based Diagnosis Engine',              Component: RuleBasedTable },
    anomaly_detection:  { label: 'Anomaly Detection (Isolation Forest)',     Component: AnomalyTable },
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

function printAnalysisReport(reportData) {
  const etl = reportData.etl_report || {}
  const ml = reportData.ml_results || {}
  const results = ml.results || {}

  const statBox = (label, value, color) =>
    `<div class="stat"><div class="stat-val" style="color:${color}">${value ?? '—'}</div><div class="stat-label">${label}</div></div>`

  const modelTable = (title, rows) => rows ? `
    <h3>${title}</h3>
    <table>${rows}</table>` : ''

  const trendRows = results.trend_prediction?.predictions?.map((val, i) => {
    const name = typeof val === 'object' ? val.patient_name : `Patient ${i + 1}`
    const sbp = typeof val === 'object' ? (val.predicted_systolic_bp ?? val.predicted_bp ?? val.value) : val
    const dbp = typeof val === 'object' ? val.predicted_diastolic_bp : null
    return `<tr><td>${name}</td><td>${sbp != null ? Number(sbp).toFixed(1) : '—'} mmHg</td><td>${dbp != null ? Number(dbp).toFixed(1) : '—'} mmHg</td></tr>`
  }).join('') || ''

  const clusterRows = results.clustering?.predictions?.map((p, i) =>
    `<tr><td>${p.patient_name || `Patient ${i + 1}`}</td><td>${p.cluster_id}</td><td>${p.profile}</td></tr>`
  ).join('') || ''

  const diseaseRows = results.disease_prediction?.predictions?.map((p, i) =>
    `<tr><td>${p.patient_name || `Patient ${i + 1}`}</td><td>${p.prediction}</td><td>${(p.probability_diabetic * 100).toFixed(1)}%</td><td>${(p.probability_non_diabetic * 100).toFixed(1)}%</td></tr>`
  ).join('') || ''

  const diagnosisRows = results.diagnosis_tree?.predictions?.map((p, i) =>
    `<tr><td>${p.patient_name || `Patient ${i + 1}`}</td><td>${p.risk_label}</td><td>${(p.confidence * 100).toFixed(0)}%</td></tr>`
  ).join('') || ''

  const ruleRows = results.rule_based?.predictions?.map((p, i) =>
    `<tr><td>${p.patient_name || `Patient ${i + 1}`}</td><td>${p.risk_label}</td><td>${p.risk_score}</td><td>${(p.confidence * 100).toFixed(0)}%</td><td>${p.triggered_rules?.join(', ') || 'None'}</td></tr>`
  ).join('') || ''

  const anomalyRows = results.anomaly_detection?.predictions?.map((p, i) =>
    `<tr><td>${p.patient_name || `Patient ${i + 1}`}</td><td style="color:${p.is_anomaly ? '#dc2626' : '#16a34a'};font-weight:600">${p.status}</td><td>${p.anomaly_score != null ? (p.anomaly_score * 100).toFixed(0) + '%' : '—'}</td></tr>`
  ).join('') || ''

  const fi = results.diagnosis_tree?.model_info?.feature_importances
  const FEATURE_LABELS = {
    age: 'Age', bmi: 'BMI', glucose_level: 'Glucose',
    blood_pressure_systolic: 'Systolic BP', blood_pressure_diastolic: 'Diastolic BP',
    heart_rate: 'Heart Rate', cholesterol: 'Cholesterol',
    is_smoker: 'Smoker', has_hypertension: 'Hypertension',
  }
  const fiRows = fi
    ? Object.entries(fi)
        .sort(([, a], [, b]) => b - a)
        .map(([k, v]) => `<tr><td>${FEATURE_LABELS[k] || k}</td><td>${(v * 100).toFixed(1)}%</td></tr>`)
        .join('')
    : ''

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Analysis Report${reportData.file_name ? ' — ' + reportData.file_name : ''}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;padding:32px 40px}
    h2{font-size:18px;font-weight:700;margin-bottom:4px}
    h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
    .meta{font-size:12px;color:#64748b;margin-bottom:20px}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
    .stat{background:#f8fafc;border-radius:6px;padding:10px 14px;border:1px solid #e2e8f0}
    .stat-val{font-size:22px;font-weight:700}
    .stat-label{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;margin-top:2px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    thead tr{background:#f8fafc}
    th{padding:7px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#64748b;border-bottom:1px solid #e2e8f0}
    td{padding:7px 10px;font-size:12px;border-bottom:1px solid #f1f5f9}
    tr:last-child td{border-bottom:none}
    .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
  </style></head><body>
  <h2>Analysis Report${reportData.file_name ? ' — ' + reportData.file_name : ''}</h2>
  <div class="meta">
    Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    ${reportData.total_rows ? ` &nbsp;·&nbsp; ${reportData.total_rows} rows` : ''}
    ${reportData.notes ? ` &nbsp;·&nbsp; ${reportData.notes}` : ''}
  </div>
  <h3>ETL Pipeline</h3>
  <div class="stats">
    ${statBox('Total Rows', etl.total_rows, '#3b82f6')}
    ${statBox('Duplicates Removed', etl.dropped_duplicates, '#f59e0b')}
    ${statBox('Missing Filled', etl.filled_missing, '#10b981')}
    ${statBox('Outliers Capped', etl.outliers_capped, '#06b6d4')}
  </div>
  ${etl.warnings?.length ? `<div style="font-size:12px;color:#d97706;margin-bottom:16px">⚠ ${etl.warnings.join(' · ')}</div>` : ''}
  ${trendRows     ? modelTable('Trend Prediction (Linear Regression)',    `<thead><tr><th>Patient</th><th>Predicted Systolic BP</th><th>Predicted Diastolic BP</th></tr></thead><tbody>${trendRows}</tbody>`) : ''}
  ${clusterRows   ? modelTable('Patient Clustering (KMeans)',             `<thead><tr><th>Patient</th><th>Cluster</th><th>Risk Profile</th></tr></thead><tbody>${clusterRows}</tbody>`) : ''}
  ${diseaseRows   ? modelTable('Disease Prediction (Logistic Regression)',`<thead><tr><th>Patient</th><th>Prediction</th><th>Diabetic %</th><th>Non-Diabetic %</th></tr></thead><tbody>${diseaseRows}</tbody>`) : ''}
  ${diagnosisRows ? modelTable('Diagnosis Tree (Decision Tree)',          `<thead><tr><th>Patient</th><th>Risk Label</th><th>Confidence</th></tr></thead><tbody>${diagnosisRows}</tbody>`) : ''}
  ${fiRows        ? modelTable('Feature Importance (Decision Tree)',      `<thead><tr><th>Feature</th><th>Importance</th></tr></thead><tbody>${fiRows}</tbody>`) : ''}
  ${ruleRows      ? modelTable('Rule-Based Diagnosis Engine',             `<thead><tr><th>Patient</th><th>Risk</th><th>Score</th><th>Confidence</th><th>Triggered Rules</th></tr></thead><tbody>${ruleRows}</tbody>`) : ''}
  ${anomalyRows   ? modelTable('Anomaly Detection (Isolation Forest)',    `<thead><tr><th>Patient</th><th>Status</th><th>Anomaly Score</th></tr></thead><tbody>${anomalyRows}</tbody>`) : ''}
  <div class="footer"><span>Patient Diagnostic Dashboard</span><span>Confidential — For clinical use only</span></div>
  </body></html>`

  const win = window.open('', '_blank', 'width=900,height=950')
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print() }
}

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
        background: 'var(--bg-surface)', borderRadius: 12, width: '100%', maxWidth: 860,
        border: '1px solid var(--border)', padding: 24,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {loading ? 'Loading...' : report?.file_name}
            </div>
            {report && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {new Date(report.created_at).toLocaleString()} · {report.notes}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {report && (
              <button
                onClick={() => printAnalysisReport(report)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', background: 'rgba(6,182,212,0.1)',
                  border: '1px solid rgba(6,182,212,0.3)', borderRadius: 7,
                  color: '#06b6d4', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <FileText size={13} /> Print Report
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
              <X size={20} />
            </button>
          </div>
        </div>
        {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading report...</div>}
        {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
        {report && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>ETL Pipeline</div>
              <ETLReportDetail etl={report.etl_report} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              <StatMini label="Total Rows"      value={report.total_rows}      color="#3b82f6" />
              <StatMini label="Linked Patients" value={report.linked_patients} color="#10b981" />
              <StatMini label="Unlinked Rows"   value={report.unlinked_rows}   color="#f59e0b" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>ML Results</div>
            <MLResults mlResults={report.ml_results} />
          </>
        )}
      </div>
    </div>
  )
}

const EMPTY_FORM = {
  first_name: '', last_name: '', date_of_birth: '', gender: 'M',
  email: '', phone: '',
  blood_pressure_systolic: '', blood_pressure_diastolic: '',
  heart_rate: '', glucose_level: '', bmi: '', cholesterol: '',
  is_smoker: false, is_diabetic: false, has_hypertension: false,
}

function Field({ label, name, value, type = 'text', options, onChange, onBlur, error, required }) {
  const hasErr = !!error
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: hasErr ? '#f87171' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {options ? (
        <select
          name={name} value={value} onChange={onChange} onBlur={onBlur}
          style={{
            padding: '8px 10px', background: 'var(--bg-base)',
            border: `1px solid ${hasErr ? '#ef4444' : 'var(--border)'}`,
            borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
            outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type={type} name={name} value={value} onChange={onChange} onBlur={onBlur}
          style={{
            padding: '8px 10px', background: 'var(--bg-base)',
            border: `1px solid ${hasErr ? '#ef4444' : 'var(--border)'}`,
            borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
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
  const today = new Date().toISOString().slice(0, 10)

  if (!form.first_name.trim()) errors.first_name = 'Required.'
  else if (form.first_name.trim().length < 2) errors.first_name = 'At least 2 characters.'
  else if (form.first_name.trim().length > 50) errors.first_name = 'Max 50 characters.'
  else if (!/^[a-zA-Z\s\-']+$/.test(form.first_name)) errors.first_name = 'Letters, hyphens, and apostrophes only.'

  if (!form.last_name.trim()) errors.last_name = 'Required.'
  else if (form.last_name.trim().length < 2) errors.last_name = 'At least 2 characters.'
  else if (form.last_name.trim().length > 50) errors.last_name = 'Max 50 characters.'
  else if (!/^[a-zA-Z\s\-']+$/.test(form.last_name)) errors.last_name = 'Letters, hyphens, and apostrophes only.'

  if (!form.date_of_birth) errors.date_of_birth = 'Required.'
  else if (form.date_of_birth >= today) errors.date_of_birth = 'Must be in the past.'
  else {
    const age = (new Date() - new Date(form.date_of_birth)) / (1000 * 60 * 60 * 24 * 365)
    if (age > 120) errors.date_of_birth = 'Age cannot exceed 120 years.'
  }

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = 'Enter a valid email address.'

  if (form.phone) {
    if (!/^[0-9\s\+\-\(\)]+$/.test(form.phone)) errors.phone = 'Digits, spaces, +, -, or parentheses only.'
    else {
      const digits = form.phone.replace(/\D/g, '')
      if (digits.length < 7) errors.phone = 'Phone number is too short.'
      else if (digits.length > 15) errors.phone = 'Phone number is too long.'
    }
  }

  const numChecks = [
    { key: 'blood_pressure_systolic',  min: 60,  max: 250, label: 'Systolic BP' },
    { key: 'blood_pressure_diastolic', min: 40,  max: 150, label: 'Diastolic BP' },
    { key: 'heart_rate',               min: 30,  max: 220, label: 'Heart Rate' },
    { key: 'glucose_level',            min: 20,  max: 600, label: 'Glucose' },
    { key: 'bmi',                      min: 10,  max: 70,  label: 'BMI' },
    { key: 'cholesterol',              min: 50,  max: 500, label: 'Cholesterol' },
  ]
  numChecks.forEach(({ key, min, max, label }) => {
    const v = form[key]
    if (v !== '' && v !== null) {
      const n = parseFloat(v)
      if (isNaN(n)) errors[key] = 'Must be a number.'
      else if (n < min || n > max) errors[key] = `${label} must be ${min}–${max}.`
    }
  })

  const sys = parseFloat(form.blood_pressure_systolic)
  const dia = parseFloat(form.blood_pressure_diastolic)
  if (!isNaN(sys) && !isNaN(dia)) {
    if (dia >= sys) errors.blood_pressure_diastolic = 'Must be lower than systolic.'
    else if (sys - dia < 10) errors.blood_pressure_diastolic = 'Pulse pressure must be ≥ 10 mmHg.'
  }

  return errors
}

function ManualPatientForm({ onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)
  const [serverError, setServerError] = useState(null)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
    if (errors[name]) setErrors(prev => { const e = { ...prev }; delete e[name]; return e })
    if (serverError) setServerError(null)
  }

  const handleBlur = (e) => {
    const { name } = e.target
    setTouched(t => ({ ...t, [name]: true }))
    const fieldErrors = validateForm(form)
    if (fieldErrors[name]) setErrors(prev => ({ ...prev, [name]: fieldErrors[name] }))
  }

  const handleSubmit = async () => {
    const errs = validateForm(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const allTouched = Object.keys(form).reduce((acc, k) => ({ ...acc, [k]: true }), {})
      setTouched(allTouched)
      return
    }

    setSaving(true)
    setServerError(null)
    setSuccess(null)

    try {
      const payload = { ...form }
      ;['blood_pressure_systolic', 'blood_pressure_diastolic', 'heart_rate', 'glucose_level', 'bmi', 'cholesterol'].forEach(k => {
        payload[k] = payload[k] !== '' ? parseFloat(payload[k]) : null
      })
      if (!payload.email) payload.email = null
      if (!payload.phone) payload.phone = null

      const res = await createPatient(payload)
      const newPatient = res.data

      try { await analysePatient(newPatient.id) } catch { }

      setSuccess(`Patient ${form.first_name} ${form.last_name} created and analysed successfully!`)
      setForm(EMPTY_FORM)
      setErrors({})
      setTouched({})
      onSuccess?.()
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const mapped = {}
        Object.entries(data).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v[0] : v })
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
      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
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
        }}>✓ {success}</div>
      )}

      {sectionLabel('Personal Information')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="First Name"    name="first_name"    value={form.first_name}    onChange={handleChange} onBlur={handleBlur} error={errors.first_name}    required />
        <Field label="Last Name"     name="last_name"     value={form.last_name}     onChange={handleChange} onBlur={handleBlur} error={errors.last_name}     required />
        <Field label="Date of Birth" name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} onBlur={handleBlur} error={errors.date_of_birth} required />
        <Field label="Gender" name="gender" value={form.gender} onChange={handleChange} onBlur={handleBlur} error={errors.gender} required
          options={[{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }, { value: 'O', label: 'Other' }]}
        />
        <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} onBlur={handleBlur} error={errors.email} />
        <Field label="Phone" name="phone"               value={form.phone} onChange={handleChange} onBlur={handleBlur} error={errors.phone} />
      </div>

      {sectionLabel('Health Metrics')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Systolic BP (mmHg)"  name="blood_pressure_systolic"  type="number" value={form.blood_pressure_systolic}  onChange={handleChange} onBlur={handleBlur} error={errors.blood_pressure_systolic} />
        <Field label="Diastolic BP (mmHg)" name="blood_pressure_diastolic" type="number" value={form.blood_pressure_diastolic} onChange={handleChange} onBlur={handleBlur} error={errors.blood_pressure_diastolic} />
        <Field label="Heart Rate (bpm)"    name="heart_rate"               type="number" value={form.heart_rate}               onChange={handleChange} onBlur={handleBlur} error={errors.heart_rate} />
        <Field label="Glucose (mg/dL)"     name="glucose_level"            type="number" value={form.glucose_level}            onChange={handleChange} onBlur={handleBlur} error={errors.glucose_level} />
        <Field label="BMI"                 name="bmi"                      type="number" value={form.bmi}                      onChange={handleChange} onBlur={handleBlur} error={errors.bmi} />
        <Field label="Cholesterol (mg/dL)" name="cholesterol"              type="number" value={form.cholesterol}              onChange={handleChange} onBlur={handleBlur} error={errors.cholesterol} />
      </div>

      {sectionLabel('Lifestyle')}
      <div style={{ display: 'flex', gap: 28 }}>
        {[
          { label: 'Smoker', name: 'is_smoker' },
          { label: 'Diabetic', name: 'is_diabetic' },
          { label: 'Hypertension', name: 'has_hypertension' },
        ].map(({ label, name }) => (
          <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
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
          marginTop: 16, padding: '10px 14px', background: '#450a0a',
          borderRadius: 8, color: '#fca5a5', fontSize: 13,
        }}>{serverError}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button
          onClick={handleSubmit} disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', background: saving ? 'var(--bg-surface-alt)' : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            border: 'none', borderRadius: 8, color: saving ? 'var(--text-muted)' : 'white',
            fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}
        >
          <UserPlus size={14} />
          {saving ? 'Creating...' : 'Create Patient'}
        </button>
        <button
          onClick={() => { setForm(EMPTY_FORM); setErrors({}); setTouched({}); setServerError(null); setSuccess(null) }}
          style={{
            padding: '10px 20px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 8,
            color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Reset</button>
      </div>
    </div>
  )
}

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls']
const MAX_FILE_SIZE_MB = 10

export default function UploadPage({ uploadResult, setUploadResult }) {
  const [tab, setTab] = useState('csv')
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [openReportId, setOpenReportId] = useState(null)
  const [deletingReportId, setDeletingReportId] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadReports = () => {
    setReportsLoading(true)
    getReports()
      .then(res => setReports(res.data))
      .catch(() => {})
      .finally(() => setReportsLoading(false))
  }

  useEffect(() => { loadReports() }, [uploadResult])

  const validateFile = (f) => {
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext))
      return `Invalid file type "${ext}". Please upload a .csv, .xlsx, or .xls file.`
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024)
      return `File is too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum size is ${MAX_FILE_SIZE_MB} MB.`
    return null
  }

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const err = validateFile(f)
    if (err) { setError(err); setFile(null); return }
    setFile(f); setUploadResult(null); setError(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (!f) return
    const err = validateFile(f)
    if (err) { setError(err); return }
    setFile(f); setUploadResult(null); setError(null)
  }

  const handleUpload = async () => {
    if (!file) { setError('Please select a file before uploading.'); return }
    setLoading(true); setError(null); setUploadResult(null); setProgress(0)
    try {
      const res = await analyseDataset(file, setProgress)
      setUploadResult(res.data)
    } catch (err) {
      setError(err.userMessage || 'Upload failed. Please check your file and try again.')
    } finally {
      setLoading(false)
    }
  }

  const clearFile = () => { setFile(null); setUploadResult(null); setError(null); setProgress(0) }

  const handleDeleteReport = async () => {
    setDeleteLoading(true)
    try {
      await deleteReport(deletingReportId)
      setReports(prev => prev.filter(r => r.id !== deletingReportId))
      setDeletingReportId(null)
    } catch {
    } finally {
      setDeleteLoading(false)
    }
  }

  const tabStyle = (active) => ({
    padding: '9px 20px', borderRadius: 7, border: 'none',
    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
    color: active ? '#3b82f6' : 'var(--text-muted)',
    fontSize: 13, fontWeight: active ? 600 : 400,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
  })

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Add Patients</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Upload a CSV dataset or manually enter a patient</p>
      </div>

      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 9, padding: 4, width: 'fit-content',
      }}>
        <button style={tabStyle(tab === 'csv')}    onClick={() => setTab('csv')}>CSV Upload</button>
        <button style={tabStyle(tab === 'manual')} onClick={() => setTab('manual')}>Manual Entry</button>
      </div>

      {tab === 'csv' && (
        <>
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              style={{
                border: `2px dashed ${file ? '#3b82f6' : 'var(--border)'}`,
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
                  <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{file.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({(file.size / 1024).toFixed(1)} KB)</span>
                  <button onClick={e => { e.stopPropagation(); clearFile() }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload size={28} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>Drop your CSV or Excel file here</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>or click to browse · .csv, .xlsx, .xls · max {MAX_FILE_SIZE_MB} MB</div>
                </div>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || loading}
              style={{
                marginTop: 16, width: '100%', padding: '11px',
                background: !file || loading ? 'var(--bg-surface-alt)' : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                border: 'none', borderRadius: 8,
                color: !file || loading ? 'var(--text-muted)' : 'white',
                fontSize: 13, fontWeight: 600,
                cursor: !file || loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}
            >
              {loading ? `Analysing... ${progress}%` : 'Run ETL + ML Analysis'}
            </button>

            {loading && (
              <div style={{ marginTop: 10, background: 'var(--border)', borderRadius: 4, height: 4 }}>
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
              background: '#450a0a', border: '1px solid #ef4444',
              borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            }}>
              <AlertCircle size={16} color="#ef4444" />
              <span style={{ fontSize: 13, color: '#fca5a5' }}>{error}</span>
            </div>
          )}

          {uploadResult && (
            <div className="animate-fade-in">
              <Section title="ETL Pipeline Report">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <button
                    onClick={() => printAnalysisReport({ ...uploadResult, file_name: file?.name })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 14px', background: 'rgba(6,182,212,0.1)',
                      border: '1px solid rgba(6,182,212,0.3)', borderRadius: 7,
                      color: '#06b6d4', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <FileText size={13} /> Print Report
                  </button>
                </div>
                <ETLReportDetail etl={uploadResult.etl_report} />
              </Section>
              <MLResults mlResults={uploadResult.ml_results} />
            </div>
          )}

          <div className="card" style={{ padding: 24, marginTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Saved Analysis Reports</div>
            {reportsLoading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading reports...</div>
            ) : reports.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No reports saved yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['#', 'File', 'Status', 'Rows', 'Linked', 'Date', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>#{r.id}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)' }}>{r.file_name}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: r.status === 'completed' ? 'var(--risk-low-bg)' : 'var(--risk-med-bg)',
                          color: r.status === 'completed' ? 'var(--risk-low-text)' : 'var(--risk-med-text)',
                        }}>{r.status}</span>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>{r.total_rows}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13, color: '#10b981' }}>{r.linked_patients}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleString()}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => setOpenReportId(r.id)}
                            style={{
                              background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                              padding: '4px 10px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

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
            background: 'var(--bg-surface)', borderRadius: 12, padding: 28,
            border: '1px solid var(--border)', maxWidth: 400, width: '90%',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
              <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fca5a5', marginBottom: 6 }}>Delete this report?</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  The report log will be removed. Patient analysis results are kept in their medical history.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeletingReportId(null)}
                style={{
                  padding: '8px 16px', background: 'transparent',
                  border: '1px solid var(--border)', borderRadius: 7,
                  color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >Cancel</button>
              <button
                onClick={handleDeleteReport} disabled={deleteLoading}
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