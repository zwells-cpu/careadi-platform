import { MODULES } from '../lib/constants'
import { LaunchWeekSupportCard } from './LaunchWeekSupportCard'
import { ThemeToggle } from './ThemeToggle'
import { canAccessOperations, isAdmin } from '../lib/profileUtils'
import {
  Activity,
  ArrowRight,
  ClipboardList,
  ClipboardPenLine,
  FilePlus2,
  Home,
  Info,
  LayoutDashboard,
  Lock,
  MessagesSquare,
  TrendingUp,
  Zap,
} from 'lucide-react'

function getGreeting(name) {
  const hour = new Date().getHours()
  const firstName = name?.split(' ')[0] || 'there'
  if (hour < 12) return `Good morning, ${firstName} 👋`
  if (hour < 17) return `Good afternoon, ${firstName} 👋`
  return `Good evening, ${firstName} 👋`
}

const MODULE_SUBTITLES = {
  dashboard: 'At-a-glance intake metrics, alerts, and action-ready insights.',
  intake: 'Manage referrals, update status, and keep families moving.',
  assessment: 'Track assessments, interviews, and service readiness.',
  operations: 'Monitor referral aging, volume, and intake performance.',
  about: 'Office locations, portal details, and internal resources.',
}

const SIDEBAR_NAV = [
  { id: 'home',       label: 'Home',                 icon: Home },
  { id: 'dashboard',  label: 'Dashboard',            icon: LayoutDashboard, module: 'dashboard' },
  { id: 'intake',     label: 'Intake',               icon: ClipboardList,   module: 'intake' },
  { id: 'assessment', label: 'Initial Assessments',  icon: ClipboardPenLine,module: 'assessment' },
  { id: 'operations', label: 'Operational Insights', icon: TrendingUp,      module: 'operations', requiresAccess: 'operations' },
  { id: 'about',      label: 'About',                icon: Info,            module: 'about' },
  { id: 'activity',   label: 'Activity Log',         icon: Activity,        module: 'dashboard', subpage: 'activity', requiresAccess: 'activity' },
]

const MODULE_ICON = {
  dashboard:  LayoutDashboard,
  intake:     ClipboardList,
  assessment: ClipboardPenLine,
  operations: TrendingUp,
  about:      Info,
}

export function HomePage({
  onEnterModule,
  onAddReferral,
  onScheduleParentInterview,
  theme,
  setTheme,
  topRightContent = null,
  displayName = '',
  onEnterSubpage,
  supportUserContext,
  profile,
}) {
  const handleSidebarNav = (item) => {
    if (item.id === 'home') return
    if (item.subpage && onEnterSubpage) {
      onEnterSubpage(item.module, item.subpage)
    } else if (item.module) {
      onEnterModule(item.module)
    }
  }

  return (
    <div className="hp-layout">

      {/* ── Sidebar ── */}
      <aside className="hp-sidebar">

        <div className="hp-sidebar-brand">
          <div className="hp-sidebar-logo">
            <img src="/bsom-logo.jpg" alt="BSOM" />
          </div>
          <div>
            <div className="hp-sidebar-brand-name">BSOM</div>
            <div className="hp-sidebar-brand-sub">Intake Portal</div>
          </div>
        </div>

        <nav className="hp-sidebar-nav">
          <div className="hp-sidebar-section-label">Navigate</div>
          {SIDEBAR_NAV.filter(item =>
            !item.requiresAccess
            || (item.requiresAccess === 'operations' && canAccessOperations(profile))
            || (item.requiresAccess === 'activity' && isAdmin(profile))
          ).map(item => {
            const Icon = item.icon
            return (
              <div
                key={item.id}
                className={`hp-sidebar-item${item.id === 'home' ? ' hp-sidebar-item--active' : ''}`}
                onClick={() => handleSidebarNav(item)}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </div>
            )
          })}
        </nav>

        <LaunchWeekSupportCard className="hp-sidebar-support" userContext={supportUserContext} />

        <div className="hp-sidebar-notice">
          <Lock size={11} />
          <span>Internal staff portal · Authorized access only</span>
        </div>

      </aside>

      {/* ── Main content ── */}
      <main className="hp-main">

        <div className="hp-topbar">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          {topRightContent}
        </div>

        <div className="hp-body">

          {/* Hero */}
          <div className="hp-hero">
            <div className="hp-eyebrow">Behavioral Solutions of Mississippi</div>
            <h1 className="hp-title">Intake Portal</h1>
            {displayName && (
              <p className="hp-greeting">{getGreeting(displayName)}</p>
            )}
          </div>

          {/* Portal modules */}
          <div className="hp-modules">
            <div className="hp-modules-heading">Portal Modules</div>
          <div className="hp-modules-helper">Choose a workspace to continue intake operations.</div>
          <div className="hp-module-grid">

              {MODULES.filter(m => m.id !== 'operations' || canAccessOperations(profile)).map(m => {
                const Icon = MODULE_ICON[m.id]
                const isSecondary = m.id === 'about'
                return (
                  <div
                    key={m.id}
                    className={`hp-module-card${isSecondary ? ' hp-module-card--secondary' : ''}`}
                    style={{ '--card-color': m.color }}
                    onClick={() => onEnterModule(m.id)}
                  >
                    <div className="hp-module-icon">
                      {Icon && <Icon size={20} />}
                    </div>
                    <div className="hp-module-name">{m.name}</div>
                    <div className="hp-module-desc">{MODULE_SUBTITLES[m.id] || m.desc}</div>
                    <div className="hp-module-cta">
                      Open <ArrowRight size={12} />
                    </div>
                  </div>
                )
              })}

              {/* Quick Actions card */}
              <div
                className="hp-module-card hp-module-card--actions hp-module-card--secondary"
                style={{ '--card-color': 'var(--accent)' }}
              >
                <div className="hp-module-icon">
                  <Zap size={20} />
                </div>
                <div className="hp-module-name">Quick Actions</div>
                <div className="hp-module-desc">
                  Add a referral or schedule a parent interview from one place.
                </div>
                <div className="hp-quick-actions">
                  <button
                    className="quick-action-btn quick-action-btn-primary"
                    onClick={onAddReferral}
                  >
                    <span className="quick-action-btn-icon" aria-hidden="true">
                      <FilePlus2 size={14} />
                    </span>
                    <span>Add New Referral</span>
                  </button>
                  <button
                    className="quick-action-btn quick-action-btn-secondary"
                    onClick={onScheduleParentInterview}
                  >
                    <span className="quick-action-btn-icon" aria-hidden="true">
                      <MessagesSquare size={14} />
                    </span>
                    <span>Schedule Parent Interview</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

    </div>
  )
}
