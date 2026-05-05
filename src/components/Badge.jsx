import { normalizeAuthorizationStatus, sc } from '../lib/utils'
import { LIFECYCLE_BADGE_STYLES, PA_BADGE_STYLES, PA_COLORS } from '../lib/constants'

export function Badge({ value }) {
  if (!value || value === '--') {
    return (
      <span className="bdg" style={{ background: '#64748b15', color: '#64748b', border: '1px solid #64748b25' }}>
        --
      </span>
    )
  }
  const semanticStyle = PA_BADGE_STYLES[value] || LIFECYCLE_BADGE_STYLES[value]
  if (semanticStyle) {
    return (
      <span className="bdg" style={{ background: semanticStyle.background, color: semanticStyle.color, border: `1px solid ${semanticStyle.border}`, letterSpacing: '0.01em' }}>
        {value}
      </span>
    )
  }
  const color = sc(value)
  return (
    <span className="bdg" style={{ background: `${color}20`, color, border: `1px solid ${color}35`, letterSpacing: '0.01em' }}>
      {value}
    </span>
  )
}

export function OfficePill({ office, previousOffice }) {
  const norm = normalizeOfficeFn(office)
  const showPreviousOffice = Boolean(
    previousOffice
    && previousOffice !== office
    && !(office === 'FLOWOOD' && previousOffice === 'JACKSON')
  )

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', minHeight: 28 }}>
      <span className={officePillClassName(norm)}>{norm || ''}</span>
      <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 600, visibility: showPreviousOffice ? 'visible' : 'hidden' }}>
        Prev. {showPreviousOffice ? previousOffice : ' '}
      </span>
    </span>
  )
}

export function officePillClassName(office) {
  const norm = normalizeOfficeFn(office)
  const officeKey = String(norm || '').trim().toUpperCase()
  if (officeKey === 'MERIDIAN') return 'office-pill office-pill-meridian'
  if (officeKey === 'FOREST') return 'office-pill office-pill-forest'
  return 'office-pill'
}

function normalizeOfficeFn(o) {
  const office = String(o || '').trim().toUpperCase()
  if (office === 'JACKSON') return 'FLOWOOD'
  if (office === 'SCHOOL') return 'DAY TREATMENT'
  if (office === 'NEWTON') return 'FOREST'
  return office
}

export function StagePill({ stage }) {
  const COLORS = {
    'New Referral': '#6366f1', 'Intake': '#8b5cf6', 'Ready for Interview': '#22c55e', 'Initial Assessment': '#f59e0b', 'Moved to Initial Assessment': '#f59e0b',
    'PA Submitted': '#fb923c', 'PA In Review': '#fb923c', 'PA Approved': '#22c55e',
    'Active Client': '#22c55e', 'Referred Out': '#64748b', 'Reauth Needed': '#f59e0b', 'Discharged': '#64748b',
  }
  if (!stage) return <span style={{ color: 'var(--dim)' }}>--</span>
  const c = COLORS[stage] || '#64748b'
  const unifiedStageFamily = ['New Referral', 'Intake', 'Ready for Interview', 'Initial Assessment', 'Moved to Initial Assessment', 'Active Client'].includes(stage)
  if (unifiedStageFamily) {
    return (
      <span
        className="stage-badge action-btn"
        style={{ background: `${c}20`, color: c, borderColor: `${c}35` }}
      >
        <span>{stage}</span>
      </span>
    )
  }
  return (
    <span style={{ background: `${c}20`, color: c, border: `1px solid ${c}35`, borderRadius: 6, padding: '2px 9px', fontSize: '10.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {stage}
    </span>
  )
}

export function PaStatusBadge({ status }) {
  const s = normalizeAuthorizationStatus(status) || 'Pending Submission'
  const c = PA_COLORS[s] || '#64748b'
  const style = PA_BADGE_STYLES[s] || {
    color: c,
    background: `${c}20`,
    border: `${c}35`,
  }
  return (
    <span className="bdg" style={{ background: style.background, color: style.color, border: `1px solid ${style.border}` }}>
      {s}
    </span>
  )
}

export function ProgressRing({ value, size = 52 }) {
  const radius = 18
  const circ = 2 * Math.PI * radius
  const col = value >= 80 ? '#22c55e' : value >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size} viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={radius} fill="none" stroke="#1a2840" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke={col}
        strokeWidth="4"
        strokeDasharray={`${value / 100 * circ} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="800" fill={col} fontFamily="DM Sans,system-ui,sans-serif">
        {value}%
      </text>
    </svg>
  )
}
