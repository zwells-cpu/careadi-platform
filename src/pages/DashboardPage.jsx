import { Badge, OfficePill, ProgressRing } from '../components/Badge'
import { ActivityLogList, RecentActivityCard } from '../components/dashboard/RecentActivityCard'
import { useActivityLogs } from '../hooks/useActivityLogs'
import { formatDisplayDate, isActiveReferralWork, needsInsuranceVerification, pct } from '../lib/utils'
import { ChevronRight, ClipboardList, Clock, ShieldCheck, UserRoundX } from 'lucide-react'

export function DashboardPage({ refs, assessData = [], setSelectedId, openModulePage, activityRefreshKey = 0, profileRole = '', canAccessOperations = false }) {
  const { logs, loading: activityLoading } = useActivityLogs(20, activityRefreshKey)
  const overviewActivityExclusions = new Set(['user_signed_in', 'user_signed_out', 'session_timeout'])
  const recentLogs = logs.filter((log) => !overviewActivityExclusions.has(log.action)).slice(0, 4)
  const role = String(profileRole || '').toLowerCase()
  const isIntakeView = role === 'intake'
  const canShowOversight = role === 'admin'
  const active = refs.filter((r) => isActiveReferralWork(r, assessData))
  const nr = refs.filter((r) => r.status === 'non-responsive' || r.status === 'referred-out')
  const pending = active.filter((r) => !['signed', 'completed'].includes((r.intake_paperwork || '').toLowerCase()))
  const noIns = active.filter((r) => needsInsuranceVerification(r.insurance_verified))
  const aging14 = active.filter((r) => {
    const received = r.referral_received_date || r.date_received
    if (!received) return false
    const ageInDays = Math.floor((Date.now() - new Date(received).getTime()) / 86400000)
    return Number.isFinite(ageInDays) && ageInDays >= 14
  }).length
  const recent = active.slice(0, 5)
  const openReferral = (id) => {
    setSelectedId(id)
    openModulePage('intake', 'all')
  }

  const priorityQueueItems = [
    {
      label: 'Paperwork Still Needed',
      value: pending.length,
      actionLabel: 'Help families finish paperwork',
      cta: 'Review paperwork',
      tone: 'yellow',
      icon: ClipboardList,
      action: () => openModulePage('intake', 'pending', { target: 'pending-docs', key: 'total-pending', label: 'Pending Documents' }),
    },
    {
      label: 'Insurance Needs Verification',
      value: noIns.length,
      actionLabel: 'Confirm coverage details',
      cta: 'Verify insurance',
      tone: 'blue',
      icon: ShieldCheck,
      intakePriority: 2,
      defaultPriority: 2,
      action: () => openModulePage('intake', 'insurance', { target: 'insurance-verification', key: 'unverified', label: 'Unverified Insurance' }),
    },
    ...(canAccessOperations ? [{
      label: 'Stalled Over 14 Days',
      value: aging14,
      actionLabel: 'Check what is holding things up',
      cta: 'Review stalled referrals',
      tone: 'orange',
      icon: Clock,
      intakePriority: 4,
      defaultPriority: 3,
      action: () => openModulePage('operations', 'aging', { target: 'referral-aging', key: 'aging-14-plus', label: 'Aging 14+ Days' }),
    }] : []),
  ].map((item, index) => ({
    intakePriority: index + 1,
    defaultPriority: index + 1,
    ...item,
  })).sort((a, b) => (isIntakeView ? a.intakePriority - b.intakePriority : a.defaultPriority - b.defaultPriority))

  return (
    <>
      <section className="priority-queue" aria-labelledby="priority-queue-title">
        <div className="priority-queue-header">
          <div>
            <h2 id="priority-queue-title" className="priority-queue-title">Today's Priority Queue</h2>
            <p className="priority-queue-subtitle">Start with the items most likely to move a family forward today.</p>
          </div>
        </div>

        <div className="priority-queue-list">
          {priorityQueueItems.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.label} className={`priority-card priority-card-${item.tone}`}>
                <div className="priority-card-head">
                  <div className="priority-card-icon" aria-hidden="true">
                    <Icon size={28} strokeWidth={1.9} />
                  </div>
                  <div className="priority-card-count">
                    <span>{item.value}</span>
                    <small>to review</small>
                  </div>
                </div>
                <div className="priority-card-main">
                  <div className="priority-card-action">{item.label}</div>
                  <div className="priority-card-task">{item.actionLabel}</div>
                  <button className="btn-sm priority-card-button" type="button" onClick={item.action}>
                    {item.cta}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <div className={`dashboard-operations-grid${canShowOversight ? ' dashboard-operations-grid-admin' : ''}`}>
        <section className="intake-work-queue">
          <div className="work-queue-header">
            <div>
              <div className="work-queue-title">Current Intake Work Queue</div>
              <div className="work-queue-subtitle">Active families intake staff may need to review next.</div>
            </div>
            <button
              type="button"
              className="btn-sm work-queue-view-all"
              onClick={() => openModulePage('intake', 'all', { target: 'all-referrals', key: 'active-referrals', label: 'Active Referrals' })}
            >
              View All Intakes
              <ChevronRight size={15} strokeWidth={2.1} />
            </button>
          </div>
          <div className="card work-queue-card">
            <div className="table-wrap work-queue-table-wrap">
              <table className="work-queue-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Office</th>
                    <th>Assigned Staff</th>
                    <th>Paperwork Status</th>
                    <th>Insurance Status</th>
                    <th>Intake Progress</th>
                    <th>Next Step</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="row-hover" onClick={() => openReferral(r.id)}>
                      <td>
                        <div className="work-queue-client-name">{r.first_name} {r.last_name}</div>
                        <div className="work-queue-client-date">{r.date_received ? formatDisplayDate(r.date_received) : ''}</div>
                      </td>
                      <td><OfficePill office={r.office} previousOffice={r.previous_office} /></td>
                      <td className="work-queue-personnel">{r.intake_personnel || '--'}</td>
                      <td className="work-queue-status-cell"><Badge value={r.intake_paperwork} /></td>
                      <td className="work-queue-status-cell"><Badge value={r.insurance_verified} /></td>
                      <td className="work-queue-progress-cell"><ProgressRing value={pct(r)} /></td>
                      <td>
                        <button
                          type="button"
                          className="work-queue-action"
                          onClick={(event) => {
                            event.stopPropagation()
                            openReferral(r.id)
                          }}
                        >
                          Open Client
                          <ChevronRight size={14} strokeWidth={2.2} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {canShowOversight ? (
          <RecentActivityCard
            logs={recentLogs}
            loading={activityLoading}
            onViewAll={() => openModulePage('dashboard', 'activity')}
            title="Latest Updates"
            emptyText="No family updates yet. New intake and assessment updates will appear here."
            skeletonCount={4}
            className="latest-activity-panel"
          />
        ) : null}
      </div>

    </>
  )
}

export function ActivityLogPage({ activityRefreshKey = 0, canShowTechnicalDetails = false }) {
  const { logs, loading } = useActivityLogs(null, activityRefreshKey)

  return (
    <>
      <div className="pg-hdr">
        <div className="pg-hdr-title">Activity Log</div>
        <div className="pg-hdr-sub">Full system activity history across referrals and assessments</div>
      </div>

      <ActivityLogList
        logs={logs}
        loading={loading}
        emptyText="No recent activity yet."
        canShowTechnicalDetails={canShowTechnicalDetails}
      />
    </>
  )
}
