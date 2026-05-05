import { useState } from 'react'
import { Badge, OfficePill } from '../components/Badge'
import { ActiveFilterBanner, ClickableStatCard } from '../components/StatFilterControls'
import { isStatFilterTarget, matchesStatFilter, toggleStatFilter } from '../lib/statFilters'
import { getInsuranceVerificationLabel, getInsuranceVerificationStatus, getReferralStage, isActiveReferralWork, isReferralTransitioned, displayStaffName, formatDisplayDate, formatInsurance, normalizeAutismDx, normalizeStaffName } from '../lib/utils'
import { ArrowRight, CheckCircle, ChevronRight, FileText, FileWarning, ShieldCheck, UserRoundX, Users } from 'lucide-react'

// ══════════════════════════════════════
// INTAKE DASHBOARD
// ══════════════════════════════════════
export function IntakeDashboard({ refs, assessData = [], onSelectRef, openModulePage }) {
  return <RedesignedIntakeDashboard refs={refs} assessData={assessData} onSelectRef={onSelectRef} openModulePage={openModulePage} />
}

function RedesignedIntakeDashboard({ refs, assessData = [], onSelectRef, openModulePage }) {
  const [queueFilter, setQueueFilter] = useState('all')
  const active = refs.filter(r => isActiveReferralWork(r, assessData))
  const transitioned = refs.filter(r => r.status === 'active' && isReferralTransitioned(r, assessData))
  const nr = refs.filter(r => r.status === 'non-responsive' || r.status === 'referred-out')
  const pending = active.filter(r => !['signed', 'completed'].includes((r.intake_paperwork || '').toLowerCase()))
  const signed = active.filter(r => (r.intake_paperwork || '').toLowerCase().includes('signed'))
  const noIns = active.filter(r => getInsuranceVerificationStatus(r) !== 'YES')
  const noDx = active.filter(r => normalizeAutismDx(r.autism_diagnosis) !== 'Received')
  const readyPI = transitioned

  const staffCounts = {}
  active.forEach(r => {
    const staffKey = normalizeStaffName(r.intake_personnel)
    if (!staffKey) return
    if (!staffCounts[staffKey]) staffCounts[staffKey] = { label: displayStaffName(r.intake_personnel), total: 0, pending: 0 }
    staffCounts[staffKey].total += 1
    if (!['signed', 'completed'].includes((r.intake_paperwork || '').toLowerCase())) staffCounts[staffKey].pending += 1
  })
  const staffList = Object.values(staffCounts).sort((a, b) => b.total - a.total)
  const maxStaffTotal = Math.max(...staffList.map(staff => staff.total), 1)

  const getDaysInIntake = (referral) => {
    const received = referral.referral_received_date || referral.date_received
    if (!received) return null
    const parsed = new Date(received)
    if (Number.isNaN(parsed.getTime())) return null
    return Math.max(Math.floor((Date.now() - parsed.getTime()) / 86400000), 0)
  }

  const getQueueMeta = (referral) => {
    const paperworkMissing = !['signed', 'completed'].includes((referral.intake_paperwork || '').toLowerCase())
    const insuranceNeeded = getInsuranceVerificationStatus(referral) !== 'YES'
    const diagnosisNeeded = normalizeAutismDx(referral.autism_diagnosis) !== 'Received'
    const days = getDaysInIntake(referral)
    const aging = days !== null && days >= 14
    const ready = getReferralStage(referral) === 'Ready for Interview'

    if (paperworkMissing) return { reason: 'Missing Paperwork', tone: 'yellow', nextStep: 'Collect intake documents', priority: 1, filter: 'paperwork' }
    if (insuranceNeeded) return { reason: 'Insurance Needed', tone: 'blue', nextStep: 'Verify coverage', priority: 2, filter: 'insurance' }
    if (diagnosisNeeded) return { reason: 'Diagnosis Docs', tone: 'orange', nextStep: 'Request diagnosis docs', priority: 3, filter: 'diagnosis' }
    if (ready) return { reason: 'Ready for Interview', tone: 'green', nextStep: 'Schedule interview', priority: 4, filter: 'ready' }
    if (aging) return { reason: 'Aging 14+ Days', tone: 'red', nextStep: 'Escalate follow-up', priority: 5, filter: 'aging' }
    return { reason: 'Intake In Progress', tone: 'slate', nextStep: 'Continue intake review', priority: 6, filter: 'all' }
  }

  const queueRows = active
    .map(referral => ({ referral, days: getDaysInIntake(referral), meta: getQueueMeta(referral) }))
    .filter(row => {
      if (queueFilter === 'all') return true
      if (queueFilter === 'paperwork') return row.meta.filter === 'paperwork'
      if (queueFilter === 'insurance') return row.meta.filter === 'insurance'
      if (queueFilter === 'ready') return row.meta.filter === 'ready'
      if (queueFilter === 'aging') return row.days !== null && row.days >= 14
      return true
    })
    .sort((a, b) => a.meta.priority - b.meta.priority || (b.days || 0) - (a.days || 0))
    .slice(0, 10)

  const recentRows = [...refs]
    .sort((a, b) => new Date(b.date_received || b.referral_received_date || 0).getTime() - new Date(a.date_received || a.referral_received_date || 0).getTime())
    .slice(0, 8)

  const kpis = [
    { value: active.length, label: 'Total Active', color: '#6366f1', icon: Users, onClick: () => openModulePage('intake', 'all', { target: 'all-referrals', key: 'active-referrals', label: 'Active Referrals' }) },
    { value: signed.length, label: 'Paperwork Signed', color: '#22c55e', icon: CheckCircle, onClick: () => openModulePage('intake', 'all', { target: 'all-referrals', key: 'paperwork-signed', label: 'Paperwork Signed' }) },
    { value: pending.length, label: 'Pending Documents', color: '#f59e0b', icon: FileText, onClick: () => openModulePage('intake', 'pending', { target: 'pending-docs', key: 'total-pending', label: 'Pending Documents' }) },
    { value: nr.length, label: 'Non-Responsive', color: '#ef4444', icon: UserRoundX, onClick: () => openModulePage('intake', 'nr', { target: 'non-responsive', key: 'all', label: 'Non-Responsive / Referred Out' }) },
  ]
  const queueFilters = [['all', 'All'], ['paperwork', 'Missing Paperwork'], ['insurance', 'Insurance Needed'], ['ready', 'Ready for Interview'], ['aging', 'Aging 14+ Days']]
  const actionItems = [
    { icon: FileText, tone: 'yellow', title: `${pending.length} pending documents`, helper: 'Families missing or still completing intake paperwork.', action: 'Review', onClick: () => openModulePage('intake', 'pending', { target: 'pending-docs', key: 'total-pending', label: 'Pending Documents' }), show: pending.length > 0 },
    { icon: ShieldCheck, tone: 'blue', title: `${noIns.length} insurance checks`, helper: 'Coverage details still need verification.', action: 'Verify', onClick: () => openModulePage('intake', 'insurance', { target: 'insurance-verification', key: 'unverified', label: 'Unverified Insurance' }), show: noIns.length > 0 },
    { icon: FileWarning, tone: 'orange', title: `${noDx.length} diagnosis docs`, helper: 'Diagnosis documentation has not been received.', action: 'Open', onClick: () => openModulePage('intake', 'pending', { target: 'pending-docs', key: 'needs-dx', label: 'Pending Documents: Awaiting Diagnosis Docs' }), show: noDx.length > 0 },
    { icon: UserRoundX, tone: 'red', title: `${nr.length} non-responsive`, helper: 'Follow-up or referred-out records needing review.', action: 'Review', onClick: () => openModulePage('intake', 'nr', { target: 'non-responsive', key: 'all', label: 'Non-Responsive / Referred Out' }), show: nr.length > 0 },
    { icon: ArrowRight, tone: 'violet', title: `${readyPI.length} moved to assessment`, helper: 'Families transitioned into initial assessment.', action: 'View', onClick: () => openModulePage('intake', 'all', { target: 'all-referrals', key: 'transitioned-to-initial', label: 'Moved to Initial Assessment' }), show: readyPI.length > 0 },
  ]

  return (
    <>
      <div className="pg-hdr">
        <div className="pg-hdr-title">Intake Dashboard</div>
        <div className="pg-hdr-sub">Real-time overview of all active referrals and action items</div>
      </div>

      <div className="intake-kpi-grid">
        {kpis.map(kpi => (
          <ClickableStatCard key={kpi.label} value={kpi.value} label={kpi.label} color={kpi.color} icon={kpi.icon} onClick={kpi.onClick} />
        ))}
      </div>

      <div className="intake-dashboard-layout">
        <div className="intake-dashboard-main">
          <section className="card intake-panel intake-work-panel">
            <div className="intake-panel-header">
              <div><div className="intake-panel-eyebrow">Today</div><h2 className="intake-panel-title">Today's Intake Work Queue</h2><p className="intake-panel-subtitle">Highest-priority active referrals to move forward next.</p></div>
              <button className="intake-soft-button" type="button" onClick={() => openModulePage('intake', 'all', { target: 'all-referrals', key: 'active-referrals', label: 'Active Referrals' })}>View all<ChevronRight size={15} strokeWidth={2.2} /></button>
            </div>
            <div className="intake-filter-chip-row" aria-label="Work queue filters">
              {queueFilters.map(([key, label]) => <button key={key} type="button" className={`intake-filter-chip${queueFilter === key ? ' active' : ''}`} onClick={() => setQueueFilter(key)}>{label}</button>)}
            </div>
            <div className="table-wrap intake-table-wrap">
              <table className="intake-enterprise-table">
                <thead><tr><th>Client</th><th>Priority Reason</th><th>Office</th><th>Days in Intake</th><th>Next Step</th><th /></tr></thead>
                <tbody>
                  {queueRows.length === 0 ? <tr><td colSpan={6} className="intake-empty-state">No active referrals match this filter.</td></tr> : queueRows.map(({ referral, days, meta }) => (
                    <tr key={referral.id} className="row-hover" onClick={() => onSelectRef(referral.id)}>
                      <td><div className="intake-client-name">{referral.first_name} {referral.last_name}</div><div className="intake-client-meta">{referral.date_received ? formatDisplayDate(referral.date_received) : 'No received date'}</div></td>
                      <td><span className={`intake-priority-pill intake-priority-${meta.tone}`}>{meta.reason}</span></td>
                      <td><OfficePill office={referral.office} previousOffice={referral.previous_office} /></td>
                      <td><span className="intake-days-pill">{days === null ? '--' : `${days} days`}</span></td>
                      <td className="intake-next-step">{meta.nextStep}</td>
                      <td><button type="button" className="work-queue-action" onClick={(event) => { event.stopPropagation(); onSelectRef(referral.id) }}>Open Client<ChevronRight size={14} strokeWidth={2.2} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card intake-panel">
            <div className="intake-panel-header">
              <div><div className="intake-panel-eyebrow">New Referrals</div><h2 className="intake-panel-title">Recently Added</h2><p className="intake-panel-subtitle">Latest referral records entered into the intake pipeline.</p></div>
              <button className="intake-soft-button" type="button" onClick={() => openModulePage('intake', 'all', { target: 'all-referrals', key: 'active-referrals', label: 'Active Referrals' })}>View all referrals<ChevronRight size={15} strokeWidth={2.2} /></button>
            </div>
            <div className="table-wrap intake-table-wrap">
              <table className="intake-enterprise-table intake-recent-table">
                <thead><tr><th>Client</th><th>Added On</th><th>Referral Source</th><th>Office</th><th>Assigned Staff</th><th>Next Step</th></tr></thead>
                <tbody>{recentRows.map(r => {
                  const meta = getQueueMeta(r)
                  return <tr key={r.id} className="row-hover" onClick={() => onSelectRef(r.id)}><td><div className="intake-client-name">{r.first_name} {r.last_name}</div><div className="intake-client-meta">{r.referral_id || '--'}</div></td><td className="intake-mono">{formatDisplayDate(r.date_received || r.referral_received_date)}</td><td className="intake-muted-cell">{r.referral_source || '—'}</td><td><OfficePill office={r.office} previousOffice={r.previous_office} /></td><td className="intake-muted-cell">{r.intake_personnel || '--'}</td><td className="intake-next-step">{meta.nextStep}</td></tr>
                })}</tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="intake-dashboard-side">
          <section className="card intake-panel intake-command-panel">
            <div className="intake-panel-header"><div><div className="intake-panel-eyebrow">Command Panel</div><h2 className="intake-panel-title">Action Items</h2><p className="intake-panel-subtitle">Quick paths to the work most likely to need attention.</p></div></div>
            <div className="intake-action-list">{actionItems.filter(item => item.show).map(item => <IntakeActionItem key={item.title} {...item} />)}{actionItems.every(item => !item.show) ? <div className="intake-empty-state">No action items.</div> : null}</div>
          </section>
          <section className="card intake-panel">
            <div className="intake-panel-header"><div><div className="intake-panel-eyebrow">Capacity</div><h2 className="intake-panel-title">Workload by Staff</h2><p className="intake-panel-subtitle">Active referrals and pending items by intake owner.</p></div></div>
            <div className="intake-staff-list">{staffList.length === 0 ? <div className="intake-empty-state">No assigned active referrals.</div> : staffList.map(staff => <div key={staff.label} className="intake-staff-row"><div className="intake-staff-topline"><span className="intake-staff-name">{staff.label}</span><span className="intake-staff-count">{staff.total} active</span></div><div className="intake-staff-meta"><span>{staff.pending} pending items</span><span>{Math.round(staff.total / maxStaffTotal * 100)}% workload</span></div><div className="intake-workload-track"><div className="intake-workload-bar" style={{ width: `${Math.round(staff.total / maxStaffTotal * 100)}%` }} /></div></div>)}</div>
          </section>
        </aside>
      </div>
    </>
  )
}

function IntakeActionItem({ icon: Icon, tone, title, helper, action, onClick }) {
  return (
    <div className={`intake-action-row intake-action-${tone}`}>
      <div className="intake-action-icon" aria-hidden="true"><Icon size={18} strokeWidth={2} /></div>
      <div className="intake-action-body"><div className="intake-action-title">{title}</div><div className="intake-action-helper">{helper}</div></div>
      <button type="button" className="intake-action-button" onClick={onClick}>{action}<ChevronRight size={14} strokeWidth={2.2} /></button>
    </div>
  )
}

// ══════════════════════════════════════
export function PendingDocsPage({ refs, assessData = [], onSelectRef, statFilter, onClearStatFilter }) {
  const active  = refs.filter(r => isActiveReferralWork(r, assessData))
  const pending = active.filter(r => !['signed', 'completed'].includes((r.intake_paperwork || '').toLowerCase()))
  const activeFilter = isStatFilterTarget(statFilter, 'pending-docs')
  const filteredRows = (activeFilter ? active : pending)
    .filter(r => matchesStatFilter(r, activeFilter))
    .sort((a, b) => (a.date_received || '').localeCompare(b.date_received || ''))

  return (
    <>
      <div className="pg-hdr">
        <div className="pg-hdr-title">Pending Documents</div>
        <div className="pg-hdr-sub">Clients requiring document follow-up</div>
      </div>
      <ActiveFilterBanner filter={activeFilter} onClear={onClearStatFilter} defaultText="Showing pending document matches" />
      <div className="card work-queue-card pending-docs-table-card">
        <div className="table-wrap work-queue-table-wrap">
          <table className="work-queue-table pending-docs-table">
            <thead><tr><th>Client</th><th>Office</th><th>Paperwork</th><th>Autism DX</th><th>Staff</th><th>Date Received</th><th>Action</th></tr></thead>
            <tbody>
              {filteredRows.length === 0
                ? <tr><td colSpan={7} className="pending-docs-empty">No pending documents.</td></tr>
                : filteredRows.map(r => (
                  <tr key={r.id} className="row-hover" onClick={() => onSelectRef(r.id)}>
                    <td><div className="work-queue-client-name">{r.first_name} {r.last_name}</div><div className="work-queue-client-date">{r.caregiver || ''}</div></td>
                    <td><OfficePill office={r.office} previousOffice={r.previous_office} /></td>
                    <td className="work-queue-status-cell"><Badge value={r.intake_paperwork} /></td>
                    <td className="work-queue-status-cell"><Badge value={normalizeAutismDx(r.autism_diagnosis)} /></td>
                    <td className="work-queue-personnel">{r.intake_personnel || '--'}</td>
                    <td className="pending-docs-date-cell">{formatDisplayDate(r.date_received)}</td>
                    <td>
                      <button type="button" className="work-queue-action" onClick={(event) => { event.stopPropagation(); onSelectRef(r.id) }}>
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
    </>
  )
}

// ══════════════════════════════════════
// INSURANCE VERIFICATION
// ══════════════════════════════════════
export function InsuranceVerifPage({ refs, assessData = [], onSelectRef, statFilter, onClearStatFilter }) {
  const [providerFilter, setProviderFilter] = useState('')
  const active     = refs.filter(r => isActiveReferralWork(r, assessData))
  const confirmed  = active.filter(r => getInsuranceVerificationStatus(r) === 'YES')
  const needsWork  = active.filter(r => getInsuranceVerificationStatus(r) !== 'YES')
  const byProvider = {}
  needsWork.forEach(r => { const p = formatInsurance(r.insurance) || 'Unknown'; byProvider[p] = (byProvider[p] || 0) + 1 })
  const providerRows = Object.entries(byProvider).sort((a, b) => b[1] - a[1])
  const verRate = active.length ? Math.round(confirmed.length / active.length * 100) : 0
  const activeFilter = isStatFilterTarget(statFilter, 'insurance-verification')
  const filteredRows = active
    .filter(r => matchesStatFilter(r, activeFilter))
    .filter(r => !providerFilter || (formatInsurance(r.insurance) || 'Unknown') === providerFilter)
    .sort((a, b) => {
      const statusOrder = { NO: 1, AWAITING: 2, '': 3, YES: 4 }
      return (statusOrder[getInsuranceVerificationStatus(a)] || 5) - (statusOrder[getInsuranceVerificationStatus(b)] || 5)
    })
  const getNextAction = (record) => {
    const status = getInsuranceVerificationStatus(record)
    if (status === 'YES') return 'Monitor for renewal'
    if (status === 'AWAITING') return 'Check payer response'
    if (status === 'NO') return 'Resolve coverage issue'
    return 'Start verification'
  }

  return (
    <>
      <div className="pg-hdr">
        <div className="pg-hdr-title">Insurance Verification</div>
        <div className="pg-hdr-sub">Review coverage details, verification status, and follow-up needs for active referrals.</div>
      </div>
      <ActiveFilterBanner filter={activeFilter} onClear={onClearStatFilter} defaultText="Showing insurance verification matches" />
      {providerFilter && (
        <div className="insurance-provider-filter">
          <span>Provider: {providerFilter}</span>
          <button type="button" onClick={() => setProviderFilter('')}>Clear</button>
        </div>
      )}
      <div className="insurance-work-layout">
        <section className="card work-queue-card insurance-work-card">
          <div className="work-queue-header">
            <div>
              <div className="work-queue-eyebrow">Coverage Operations</div>
              <div className="work-queue-title">Insurance Work Queue</div>
              <div className="work-queue-subtitle">Prioritized active referrals with payer status and the next verification step.</div>
            </div>
          </div>
          <div className="table-wrap work-queue-table-wrap">
            <table className="work-queue-table insurance-work-table">
              <thead><tr><th>Client</th><th>Insurance Provider</th><th>Verification Status</th><th>Assigned Staff</th><th>Last Checked</th><th>Next Action</th></tr></thead>
              <tbody>
                {filteredRows.length === 0
                  ? <tr><td colSpan={6} className="insurance-empty-state">No insurance items match this view.</td></tr>
                  : filteredRows.map(r => (
                    <tr key={r.id} className="row-hover" onClick={() => onSelectRef(r.id)}>
                      <td><div className="work-queue-client-name">{r.first_name} {r.last_name}</div><div className="work-queue-client-date"><OfficePill office={r.office} previousOffice={r.previous_office} /></div></td>
                      <td className="insurance-provider-cell">{formatInsurance(r.insurance) || '--'}</td>
                      <td><InsuranceStatusPill record={r} /></td>
                      <td className="work-queue-personnel">{displayStaffName(r.intake_personnel) || '--'}</td>
                      <td className="intake-mono">{formatDisplayDate(r.insurance_last_verified_date)}</td>
                      <td><button type="button" className="work-queue-action" onClick={(event) => { event.stopPropagation(); onSelectRef(r.id) }}>{getNextAction(r)}<ChevronRight size={14} strokeWidth={2.2} /></button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="card intake-panel insurance-provider-panel">
          <div className="intake-panel-header">
            <div>
              <div className="intake-panel-eyebrow">Payers</div>
              <h2 className="intake-panel-title">Provider Follow-Up</h2>
              <p className="intake-panel-subtitle">Payers with referrals still needing verification or follow-up.</p>
            </div>
          </div>
          <div className="insurance-provider-list">
            {providerRows.map(([provider, count]) => (
              <div key={provider} className="insurance-provider-row">
                <div className="insurance-provider-name">{provider}</div>
                <span className="insurance-count-badge">{count}</span>
                <button type="button" className="insurance-review-button" onClick={() => setProviderFilter(provider)}>Review</button>
              </div>
            ))}
            {providerRows.length === 0 && <div className="intake-empty-state">All providers are confirmed.</div>}
          </div>
          <div className="insurance-rate-block">
            <div className="insurance-rate-line">
              <span>Verification rate</span>
              <strong>{verRate}%</strong>
            </div>
            <div className="insurance-rate-track">
              <div className="insurance-rate-bar" style={{ width: `${verRate}%` }} />
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

// ══════════════════════════════════════
// NON-RESPONSIVE
// ══════════════════════════════════════
function InsuranceStatusPill({ record }) {
  const status = getInsuranceVerificationStatus(record)
  const label = getInsuranceVerificationLabel(record)
  const tone = status === 'YES' ? 'confirmed' : status === 'AWAITING' ? 'awaiting' : status === 'NO' ? 'follow-up' : 'ready'
  return <span className={`insurance-status-pill insurance-status-${tone}`}>{label}</span>
}

export function NonResponsivePage({ refs, onRestore, statFilter, onClearStatFilter }) {
  const nr = refs.filter(r => r.status === 'non-responsive' || r.status === 'referred-out')
  const activeFilter = isStatFilterTarget(statFilter, 'non-responsive')
  const filteredRows = nr.filter(r => matchesStatFilter(r, activeFilter))
  return (
    <>
      <div className="pg-hdr">
        <div className="nr-page-header">
          <div>
            <div className="pg-hdr-title">Non-Responsive / Referred Out</div>
            <div className="pg-hdr-sub">Clients who could not be reached or were referred elsewhere</div>
          </div>
          <span className="nr-count-pill">{filteredRows.length} Non-Responsive / Referred Out</span>
        </div>
      </div>
      <ActiveFilterBanner filter={activeFilter} onClear={onClearStatFilter} defaultText="Showing non-responsive records" />
      <div className="card work-queue-card nr-work-card">
        <div className="table-wrap work-queue-table-wrap">
          <table className="work-queue-table nr-work-table">
            <thead><tr><th>Client</th><th>Caregiver</th><th>Phone</th><th>Office</th><th>Coordinator</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {filteredRows.length === 0
                ? <tr><td colSpan={7} className="nr-empty-state">No non-responsive clients.</td></tr>
                : filteredRows.map(r => (
                  <tr key={r.id} className="row-hover">
                    <td><div className="work-queue-client-name">{r.first_name} {r.last_name}</div><div className="work-queue-client-date">{r.date_received ? formatDisplayDate(r.date_received) : ''}</div></td>
                    <td className="nr-caregiver-cell">{r.caregiver || '--'}</td>
                    <td className="nr-phone-cell">{r.caregiver_phone || '--'}</td>
                    <td><OfficePill office={r.office} previousOffice={r.previous_office} /></td>
                    <td className="work-queue-personnel">{r.intake_personnel || '--'}</td>
                    <td><span className={`nr-status-pill nr-status-${r.status === 'referred-out' ? 'referred' : 'nonresponsive'}`}>{r.status}</span></td>
                    <td><button type="button" className="nr-restore-button" onClick={() => onRestore(r.id)}>Restore</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
