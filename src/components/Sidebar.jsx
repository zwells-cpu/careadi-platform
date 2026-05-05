import { MODULES, MODULE_NAV } from '../lib/constants'
import { LaunchWeekSupportCard } from './LaunchWeekSupportCard'

export function Sidebar({ module, subpage, setSubpage, goHome, pendingCount, unverifiedCount, supportUserContext, canViewActivityLog = false, canAccessOperations = false }) {
  const m = MODULES.find(x => x.id === module)
  const navItems = (MODULE_NAV[module] || []).filter(n => !(n.id === 'activity' && !canViewActivityLog))

  const badgeFor = (id) => {
    if (id === 'pending') return pendingCount > 0 ? pendingCount : null
    if (id === 'insurance') return unverifiedCount > 0 ? unverifiedCount : null
    return null
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header sidebar-home-btn" onClick={goHome}>
        <div className="sidebar-logo">
          <img src="/bsom-logo.jpg" alt="BSOM" onError={e => { e.target.style.display = 'none' }} />
        </div>
        <div>
          <div className="sidebar-title">BSOM Intake Portal</div>
          <div className="sidebar-sub">{m?.name}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {navItems.map(n => {
          const badge = badgeFor(n.id)
          const Icon = n.icon
          return (
            <div
              key={n.id}
              className={`nav-item ${subpage === n.id ? 'active' : ''}`}
              onClick={() => setSubpage(n.id)}
            >
              {Icon ? <span className="nav-icon"><Icon size={16} strokeWidth={1.8} /></span> : null}
              <span>{n.label}</span>
              {badge && <span className="nav-badge">{badge}</span>}
            </div>
          )
        })}

        <div className="nav-section-label" style={{ marginTop: 16 }}>Modules</div>
        {MODULES.filter(x => x.id !== module && (x.id !== 'operations' || canAccessOperations)).map(x => (
          <div
            key={x.id}
            className="nav-item"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('enter-module', { detail: x.id }))
            }}
          >
            <span style={{ fontSize: 12 }}>{x.name}</span>
          </div>
        ))}
      </nav>

      <LaunchWeekSupportCard className="sidebar-support" userContext={supportUserContext} />

      <div className="sidebar-footer">
        <div className="back-btn" onClick={goHome}>{'\u2190'} Back to Portal Home</div>
      </div>
    </aside>
  )
}
