import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  FlaskConical,
  Upload,
  Activity,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'patients',  label: 'Patients',  icon: Users },
  { id: 'analysis',  label: 'ML Analysis', icon: FlaskConical },
  { id: 'upload',    label: 'Upload Data', icon: Upload },
]

export default function Sidebar({ activePage, onNavigate, onLogout, user }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside style={{
      width: collapsed ? 72 : 220,
      height: '100vh',
      background: '#161b27',
      borderRight: '1px solid #2a3347',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      transition: 'width 0.2s ease'
    }}>

      {/* HEADER */}
      <div style={{
        padding: '20px 12px',
        borderBottom: '1px solid #2a3347'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={18} color="white" />
            </div>

            {!collapsed && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                  MediDash
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  Diagnostic AI
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button onClick={() => setCollapsed(true)} style={toggleBtnStyle}>
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {collapsed && (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => setCollapsed(false)} style={toggleBtnStyle}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* NAV */}
      <nav style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 8px'
      }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activePage === id
          return (
            <button
              key={id}
              title={collapsed ? label : ''}
              onClick={() => onNavigate(id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                marginBottom: 6,
                background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: active ? '#3b82f6' : '#94a3b8',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                transition: 'background 0.15s'
              }}
            >
              <Icon size={16} />
              {!collapsed && label}
            </button>
          )
        })}
      </nav>

      {/* FOOTER */}
      <div style={{ borderTop: '1px solid #2a3347', padding: '12px 8px' }}>

        {/* User info — expanded */}
        {!collapsed && user && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            marginBottom: 8,
            borderRadius: 8,
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.12)'
          }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: 'white',
              flexShrink: 0
            }}>
              {user.username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#e2e8f0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {user.username}
              </div>
              <div style={{
                fontSize: 10,
                color: '#64748b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
              </div>
            </div>
          </div>
        )}

        {/* User avatar — collapsed */}
        {collapsed && user && (
          <div
            title={user.username}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: 'white',
              margin: '0 auto 8px'
            }}
          >
            {user.username?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}

        {/* Sign out */}
        <button
          title={collapsed ? 'Sign out' : ''}
          onClick={onLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: '#64748b',
            fontSize: 13,
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
            e.currentTarget.style.color = '#f87171'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#64748b'
          }}
        >
          <LogOut size={16} />
          {!collapsed && 'Sign out'}
        </button>

        {!collapsed && (
          <div style={{ fontSize: 11, color: '#334155', marginTop: 8, paddingLeft: 12 }}>
            v1.0.0 · DRF Backend
          </div>
        )}
      </div>

    </aside>
  )
}

const toggleBtnStyle = {
  border: 'none',
  background: 'transparent',
  color: '#94a3b8',
  cursor: 'pointer',
  padding: 6,
  borderRadius: 6
}