import { formatActivityLogDisplay } from '../../lib/activityLogs'
import { ClipboardCheck, FileText, ShieldCheck, User, UserRoundX } from 'lucide-react'

function formatRelativeTime(value) {
  if (!value) return 'Just now'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Just now'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

function formatFullTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

function formatEntityType(type) {
  if (!type) return ''
  return String(type).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function cleanActorName(value) {
  const text = String(value || '').trim()
  if (!text || text.toLowerCase() === 'unknown staff member') return ''
  return text
}

function buildActorLine(log) {
  const details = log.details_json && typeof log.details_json === 'object' ? log.details_json : {}
  const preferredName =
    cleanActorName(log.user_name) ||
    cleanActorName(log.display_name) ||
    cleanActorName(log.full_name) ||
    cleanActorName(log.actor) ||
    cleanActorName(details.actor_name) ||
    cleanActorName(details.user_name)
  const actorName =
    (preferredName && preferredName !== 'Signed-in user' ? preferredName : cleanActorName(log.user_email)) ||
    preferredName ||
    'Signed-in user'

  return log.user_role ? `${actorName} (${log.user_role})` : actorName
}

function getActivityVisual(log) {
  const action = String(log?.action || '').toLowerCase()
  const entityType = String(log?.entity_type || '').toLowerCase()
  const changedFields = Array.isArray(log?.details_json?.changed_fields) ? log.details_json.changed_fields.join(' ').toLowerCase() : ''

  if (action.includes('user') || action.includes('session')) return { Icon: User, tone: 'user' }
  if (action.includes('document') || changedFields.includes('paperwork') || changedFields.includes('diagnosis')) return { Icon: FileText, tone: 'document' }
  if (action.includes('insurance') || changedFields.includes('insurance')) return { Icon: ShieldCheck, tone: 'insurance' }
  if (action.includes('non') || action.includes('referred') || action.includes('follow') || changedFields.includes('non')) return { Icon: UserRoundX, tone: 'followup' }
  if (entityType === 'assessment' || action.includes('assessment') || action.includes('interview') || action.includes('authorization') || action.includes('treatment') || action.includes('bcba')) return { Icon: ClipboardCheck, tone: 'assessment' }
  return { Icon: ClipboardCheck, tone: 'default' }
}

export function ActivityLogTechnicalDetails({ log }) {
  const details = log.details_json && typeof log.details_json === 'object' ? log.details_json : null
  if (!details || Object.keys(details).length === 0) return null

  return (
    <details className="activity-log-technical">
      <summary>Show technical details</summary>
      <pre>{JSON.stringify(details, null, 2)}</pre>
    </details>
  )
}

export function ActivityLogItem({ log, index, canShowTechnicalDetails = false, compact = false }) {
  const display = formatActivityLogDisplay(log)
  const actorLine = buildActorLine(log)

  return (
    <div
      className="activity-log-item"
      key={`${log.created_at || 'log'}-${log.entity_id || index}-${index}`}
      style={{
        background: 'linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0))',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: compact ? '12px 14px' : '14px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>
            {display.actionLabel}
          </span>
          {display.entityType && (
            <span className="activity-log-badge">
              {formatEntityType(display.entityType)}
            </span>
          )}
          {display.office && (
            <span className="activity-log-badge">
              {display.office}
            </span>
          )}
        </div>
        <span
          title={formatFullTimestamp(log.created_at)}
          style={{ fontSize: 11, color: 'var(--dim)', flexShrink: 0, cursor: 'default' }}
        >
          {formatRelativeTime(log.created_at)}
        </span>
      </div>

      {display.entityName && (
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, overflowWrap: 'anywhere' }}>
          {display.entityName}
        </div>
      )}

      {display.summary && (
        <div className="activity-log-summary" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: display.chips.length ? 8 : 4 }}>
          {display.summary}
        </div>
      )}

      {display.chips.length > 0 && (
        <div className="activity-log-chips" aria-label="Updated areas">
          {display.chips.map(chip => (
            <span key={chip} className="activity-log-chip">{chip}</span>
          ))}
          {display.hiddenChipCount > 0 && (
            <span className="activity-log-chip activity-log-chip-muted">+{display.hiddenChipCount} more updates</span>
          )}
        </div>
      )}

      <div className="activity-log-actor" style={{ marginTop: 8, fontSize: 11, color: 'var(--dim)' }}>
        {actorLine}
      </div>

      {canShowTechnicalDetails && <ActivityLogTechnicalDetails log={log} />}
    </div>
  )
}

function ActivityLogSkeleton({ count }) {
  return Array.from({ length: count }).map((_, index) => (
    <div
      key={index}
      style={{
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface2)',
        padding: '14px 16px',
      }}
    >
      <div style={{ height: 10, width: '36%', background: 'rgba(148,163,184,0.18)', borderRadius: 999, marginBottom: 10 }} />
      <div style={{ height: 12, width: '72%', background: 'rgba(148,163,184,0.14)', borderRadius: 999, marginBottom: 10 }} />
      <div style={{ height: 10, width: '54%', background: 'rgba(148,163,184,0.12)', borderRadius: 999 }} />
    </div>
  ))
}

function LatestActivityEvent({ log, index }) {
  const display = formatActivityLogDisplay(log)
  const { Icon, tone } = getActivityVisual(log)
  const title = display.entityName || display.actionLabel
  const summary = display.entityName ? display.summary || display.actionLabel : display.summary

  return (
    <div className={`latest-event latest-event-${tone}`} key={`${log.created_at || 'log'}-${log.entity_id || index}-${index}`}>
      <div className="latest-event-icon" aria-hidden="true">
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className="latest-event-body">
        <div className="latest-event-title">{title}</div>
        {summary ? <div className="latest-event-summary">{summary}</div> : null}
      </div>
      <div className="latest-event-time" title={formatFullTimestamp(log.created_at)}>
        {formatRelativeTime(log.created_at)}
      </div>
    </div>
  )
}

export function RecentActivityCard({
  logs,
  loading,
  onViewAll,
  title = 'Recent Activity',
  emptyText = 'No recent activity yet.',
  skeletonCount = 4,
  className = '',
}) {
  return (
    <div className={className}>
      <div className="latest-activity-header">
        <div>
          <div className="latest-activity-title">{title}</div>
          <div className="latest-activity-subtitle">A quick view of recent client movement.</div>
        </div>
        {onViewAll ? (
          <button
            type="button"
            className="latest-activity-link"
            onClick={onViewAll}
          >
            View all activity
          </button>
        ) : null}
      </div>

      <div className="card latest-activity-card">
        {loading ? (
          <ActivityLogSkeleton count={skeletonCount} />
        ) : logs.length === 0 ? (
          <div className="latest-activity-empty">
            {emptyText}
          </div>
        ) : (
          <>
            {logs.map((log, index) => (
              <LatestActivityEvent key={`${log.created_at || 'log'}-${log.entity_id || index}-${index}`} log={log} index={index} />
            ))}
          </>
        )}
        {onViewAll && logs.length > 0 ? (
          <button type="button" className="latest-activity-footer-link" onClick={onViewAll}>
            View all activity
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function ActivityLogList({ logs, loading, emptyText = 'No recent activity yet.', canShowTechnicalDetails = false }) {
  if (loading) {
    return (
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ActivityLogSkeleton count={6} />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--dim)' }}>
        {emptyText}
      </div>
    )
  }

  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {logs.map((log, index) => (
        <ActivityLogItem
          key={`${log.created_at || 'log'}-${log.entity_id || index}-${index}`}
          log={log}
          index={index}
          canShowTechnicalDetails={canShowTechnicalDetails}
        />
      ))}
    </div>
  )
}
