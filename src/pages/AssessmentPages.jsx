import { useEffect, useState } from 'react'
import {
  ArrowRight,
  ArrowRightCircle,
  BriefcaseMedical,
  CalendarCheck,
  CalendarClock,
  CheckCircle,
  ChevronRight,
  CircleDashed,
  Clock,
  Eye,
  FilePlus2,
  Send,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { PaStatusBadge, officePillClassName } from '../components/Badge'
import { NotifyModal } from '../components/NotifyModal'
import { ActiveFilterBanner, ClickableStatCard } from '../components/StatFilterControls'
import { SyncedHorizontalScrollTable } from '../components/SyncedHorizontalScrollTable'
import { LIFECYCLE_BADGE_STYLES } from '../lib/constants'
import { cleanLookupValue, createBcbaStaff, deactivateBcbaStaff, getBcbaStaffRecords, normalizeLookupValue, optionValues, updateBcbaStaff } from '../lib/lookups'
import { isStatFilterTarget, matchesStatFilter, toggleStatFilter } from '../lib/statFilters'
import {
  AUTHORIZATION_STATUSES,
  TREATMENT_PLAN_STATUSES,
  formatDate,
  formatDisplayDate,
  getAssessmentLifecycleStatus,
  getAssessmentRecordId,
  getAssessmentWorkflowProgress,
  getAssessmentWorkflowStatus,
  getAuthorizationStatus,
  isAssessmentActiveClient,
  normalizeAssessmentComponentStatus,
  normalizeAuthorizationStatus,
  normalizeParentInterviewStatus,
  normalizeTreatmentPlanStatus,
  statusColor,
} from '../lib/utils'

function assessVal(value) {
  const normalized = normalizeAssessmentComponentStatus(value)
  if (!normalized) return <span style={{ color: 'var(--dim)', fontSize: 12 }}>--</span>

  const color = statusColor(normalized)
  return <span className="bdg" style={{ background: `${color}20`, color, border: `1px solid ${color}35` }}>{normalized}</span>
}

function simpleValueBadge(value) {
  if (!value) return <span style={{ color: 'var(--dim)', fontSize: 12 }}>--</span>
  const normalized = String(value).trim()
  const color = normalized.toUpperCase() === 'YES' ? '#22c55e' : normalized.toUpperCase() === 'NO' ? '#ef4444' : '#64748b'
  return <span className="bdg" style={{ background: `${color}20`, color, border: `1px solid ${color}35` }}>{normalized}</span>
}

function sBdg(status) {
  const normalizedStatus = status || 'Not Started'
  const map = {
    Completed: '#22c55e',
    'In Progress': '#f59e0b',
    'Not Started': '#ef4444',
    Scheduled: '#f59e0b',
    'No Show': '#ef4444',
    Finalized: '#22c55e',
    'Awaiting Assignment': '#3b82f6',
  }
  const color = map[normalizedStatus] || '#64748b'
  return <span className="bdg" style={{ background: `${color}20`, color, border: `1px solid ${color}35` }}>{normalizedStatus || '--'}</span>
}

function paStatus(status) {
  return <PaStatusBadge status={status} />
}

function isTrackedAssessmentComplete(value) {
  return normalizeAssessmentComponentStatus(value) === 'Completed'
}

function getAssessmentProgressFields(record) {
  return {
    vineland: record?.vineland || '',
    srs2: record?.srs2 || '',
    vbmapp: record?.vbmapp || '',
    sociallySavvy: record?.socially_savvy || '',
  }
}

function getAssessmentProgressPercent(record) {
  const trackedValues = Object.values(getAssessmentProgressFields(record))
  const completedCount = trackedValues.filter(isTrackedAssessmentComplete).length
  return `${completedCount * 25}%`
}

const ALL_PA = ['All', ...AUTHORIZATION_STATUSES]
const TX_STATUSES = TREATMENT_PLAN_STATUSES
const PA_FILTER_LABELS = {
  'Pending Submission': 'Pending',
  'Submitted / In Review': 'In Review',
  'Partially Approved': 'Partial',
  'Approved / Discharged': 'Discharged',
  'Approved/Discharged': 'Discharged',
}

function renderClientCell(record, secondaryText) {
  return (
    <>
      <div style={{ fontWeight: 700 }}>{record.client_name}</div>
      <div style={{ fontSize: 11, color: 'var(--dim)' }}>{secondaryText || ''}</div>
    </>
  )
}

function txColor(status) {
  return statusColor(status)
}

function lifecycleBadge(status) {
  const style = LIFECYCLE_BADGE_STYLES[status] || {
    color: '#64748b',
    background: '#64748b20',
    border: '#64748b35',
  }

  return <span className="bdg" style={{ background: style.background, color: style.color, border: `1px solid ${style.border}` }}>{status}</span>
}

function isParentInterviewComplete(record) {
  return normalizeParentInterviewStatus(record?.parent_interview_status) === 'Completed'
    || Boolean(record?.parent_interview_completed_date)
}

function isParentInterviewScheduled(record) {
  return isParentInterviewComplete(record)
    || normalizeParentInterviewStatus(record?.parent_interview_status) === 'Scheduled'
    || Boolean(record?.parent_interview_scheduled_date)
}

function isDirectObservationComplete(record) {
  return normalizeAssessmentComponentStatus(record?.direct_obs_status || record?.direct_obs) === 'Completed'
    || Boolean(record?.direct_obs_completed_date)
}

function isDirectObservationScheduled(record) {
  return isDirectObservationComplete(record)
    || normalizeAssessmentComponentStatus(record?.direct_obs_status || record?.direct_obs) === 'Scheduled'
    || Boolean(record?.direct_obs_scheduled_date)
}

function getAssessmentReferenceDate(record) {
  return record?.date_received
    || record?.created_at
    || record?.assessment_created_at
    || record?.updated_at
    || record?.parent_interview_scheduled_date
    || record?.treatment_plan_started_date
    || null
}

function getDaysSinceAssessmentReference(record) {
  const rawDate = getAssessmentReferenceDate(record)
  if (!rawDate) return 0
  const timestamp = new Date(rawDate).getTime()
  if (Number.isNaN(timestamp)) return 0
  return Math.floor((Date.now() - timestamp) / 86400000)
}

function isAssessmentStalled(record) {
  return getDaysSinceAssessmentReference(record) > 14
    && getAssessmentWorkflowStatus(record) !== 'Completed'
    && getAssessmentLifecycleStatus(record) !== 'Referred Out'
    && !isAssessmentActiveClient(record)
}

function needsParentFollowUp(record) {
  const status = normalizeParentInterviewStatus(record?.parent_interview_status)
  return !isParentInterviewComplete(record)
    && (!isParentInterviewScheduled(record) || ['No Show', 'Not Started', 'Awaiting Assignment'].includes(status))
}

function needsDirectObservation(record) {
  return isParentInterviewScheduled(record) && !isDirectObservationScheduled(record)
}

function isReadyForBcbaReview(record) {
  return getAssessmentWorkflowStatus(record) === 'Completed'
    && ['Not Started', ''].includes(normalizeTreatmentPlanStatus(record?.treatment_plan_status))
    && getAssessmentLifecycleStatus(record) !== 'Referred Out'
}

function isMissingAssessmentDocuments(record) {
  return !record?.vineland || !record?.srs2 || !record?.vbmapp || !record?.socially_savvy
}

function getNextBlocker(record) {
  if (!isParentInterviewScheduled(record)) return 'Parent interview needed'
  if (!isDirectObservationScheduled(record)) return 'Direct observation needed'
  if (getAssessmentWorkflowStatus(record) !== 'Completed') return 'Assessment completion needed'
  if (['Not Started', ''].includes(normalizeTreatmentPlanStatus(record?.treatment_plan_status))) return 'Ready for BCBA review'
  if (!['Submitted / In Review', 'Approved', 'Partially Approved', 'No PA Needed', 'Approved/Discharged', 'Approved / Discharged'].includes(getAuthorizationStatus(record))) return 'Authorization needed'
  return 'No blocker'
}

function blockerTone(label) {
  if (label === 'No blocker') return 'green'
  if (label === 'Ready for BCBA review') return 'blue'
  if (label === 'Authorization needed') return 'yellow'
  return 'orange'
}

function getAssessmentPageFilter(statFilter, onSetStatFilter, target) {
  const activeFilter = isStatFilterTarget(statFilter, target)
  const toggleFilter = (key, label) => onSetStatFilter(toggleStatFilter(activeFilter, { target, key, label }))
  return { activeFilter, toggleFilter }
}

export function AssessmentTracker({ assessData, assessLoading, onSelectAssess, onNewAssessment, statFilter, onSetStatFilter, onClearStatFilter }) {
  const [search, setSearch] = useState('')
  const [office, setOffice] = useState('ALL')
  const [paFilter, setPaFilter] = useState('All')

  if (assessLoading) {
    return <div className="loader-wrap"><div className="spinner" /><div style={{ color: 'var(--muted)' }}>Loading assessments...</div></div>
  }

  const src = (assessData || []).map(record => ({
    ...record,
    client_name: record.client_name || record.name || '',
    clinic: record.clinic || record.office || '',
    assessment_id: getAssessmentRecordId(record),
    authorization_status: getAuthorizationStatus(record),
  }))

  const { activeFilter, toggleFilter } = getAssessmentPageFilter(statFilter, onSetStatFilter, 'assessment-tracker')

  const filtered = src.filter(record => {
    const name = (record.client_name || '').toLowerCase()
    const caregiver = (record.caregiver || '').toLowerCase()
    const query = search.toLowerCase()

    return (name.includes(query) || caregiver.includes(query))
      && (office === 'ALL' || (record.clinic || '').toUpperCase() === office)
      && (paFilter === 'All' || normalizeAuthorizationStatus(record.authorization_status) === paFilter)
      && matchesStatFilter(record, activeFilter)
  })

  const approved = filtered.filter(record => record.authorization_status === 'Approved').length
  const readyInterview = filtered.filter(record => isParentInterviewScheduled(record) && !isParentInterviewComplete(record))
  const parentFollowUp = filtered.filter(needsParentFollowUp)
  const directObservationNeeded = filtered.filter(needsDirectObservation)
  const readyForBcbaReview = filtered.filter(isReadyForBcbaReview)
  const stalledAssessments = filtered.filter(isAssessmentStalled)
  const waitingOnBcba = filtered.filter(record => Boolean(record.assigned_bcba) && isReadyForBcbaReview(record))
  const missingDocuments = filtered.filter(isMissingAssessmentDocuments)
  const actionBuckets = [
    {
      key: 'ready-interview',
      label: 'Ready for Parent Interview',
      helper: 'Parent interview is scheduled and ready to complete.',
      count: readyInterview.length,
      color: '#22c55e',
      Icon: CalendarCheck,
    },
    {
      key: 'direct-observation',
      label: 'Direct Observation Needed',
      helper: 'Parent step is moving, direct observation is next.',
      count: directObservationNeeded.length,
      color: '#fb923c',
      Icon: Eye,
    },
  ]
  const bottlenecks = [
    { key: 'parent-follow-up', label: 'Waiting on Parent', count: parentFollowUp.length, tone: 'yellow' },
    { key: 'waiting-bcba', label: 'Waiting on BCBA', count: waitingOnBcba.length, tone: 'blue' },
    { key: 'missing-documents', label: 'Missing Documents', count: missingDocuments.length, tone: 'orange' },
    { key: 'stalled', label: 'Stalled Assessments', count: stalledAssessments.length, tone: 'red' },
    { key: 'bcba-review', label: 'Ready for Review', count: readyForBcbaReview.length, tone: 'green' },
  ]

  return (
    <>
      <div className="pg-hdr assessment-board-header">
        <div>
          <div className="pg-hdr-title">Initial Assessment Board</div>
          <div className="pg-hdr-sub">Track clinical assessment movement, blockers, and readiness for BCBA review.</div>
        </div>
        <button type="button" className="btn-save assessment-board-new-btn" onClick={onNewAssessment}>
          <FilePlus2 size={16} />
          New Initial Assessment
        </button>
      </div>
      <div className="assessment-command-grid">
        {actionBuckets.map(({ key, label, helper, count, color, Icon }) => (
          <button
            key={key}
            type="button"
            className={`assessment-action-bucket ${activeFilter?.key === key ? 'is-active' : ''}`}
            style={{ '--bucket-color': color }}
            onClick={() => toggleFilter(key, `Assessment Tracker: ${label}`)}
          >
            <span className="assessment-action-icon"><Icon size={20} /></span>
            <span className="assessment-action-copy">
              <span className="assessment-action-count">{count}</span>
              <span className="assessment-action-label">{label}</span>
              <span className="assessment-action-helper">{helper}</span>
            </span>
          </button>
        ))}
      </div>
      <ActiveFilterBanner filter={activeFilter} onClear={onClearStatFilter} defaultText="Showing filtered assessment records" />

      <div className="filter-row assessment-primary-controls">
        <div className="search-wrap assessment-search-group">
          <input className="search-input" placeholder="Search client or caregiver..." value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        <div className="filter-divider"></div>
        <div className="filter-btns assessment-clinic-filter-group">
          {['ALL', 'MERIDIAN', 'FOREST', 'FLOWOOD', 'DAY TREATMENT'].map(option => (
            <button key={option} className={`filter-btn ${office === option ? 'active' : ''}`} onClick={() => setOffice(option)}>{option}</button>
          ))}
        </div>
        <div className="filter-divider"></div>
        <div className="assessment-pa-select-group">
          <span>Prior Authorization</span>
          <select value={paFilter} onChange={event => setPaFilter(event.target.value)} aria-label="Prior Authorization">
            {ALL_PA.map(status => (
              <option key={status} value={status}>{PA_FILTER_LABELS[status] || status}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="work-queue-header">
        <div>
          <div className="work-queue-eyebrow">Clinical Workflow</div>
          <div className="work-queue-title">Assessment Work Queue</div>
          <div className="work-queue-subtitle">{filtered.length} clients in the current view. {approved} authorization approvals recorded.</div>
        </div>
      </div>

      <div className="assessment-command-layout">
        <section className="assessment-work-queue">
          <div className="work-queue-card assessment-work-queue-card">
            <SyncedHorizontalScrollTable>
              <table className="work-queue-table assessment-work-table">
                <thead><tr><th>Client</th><th>Clinic</th><th>Assigned BCBA</th><th>Parent Interview</th><th>Direct Observation</th><th>Assessment Status</th><th>Next Blocker</th></tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={7} className="assessment-empty-row">No clients match your filters.</td></tr>
                    : filtered.map(record => {
                      const canOpen = Boolean(getAssessmentRecordId(record))
                      const blocker = getNextBlocker(record)
                      return (
                        <tr
                          key={record.assessment_id || record.client_name}
                          className={canOpen ? 'row-hover' : ''}
                          onClick={() => canOpen && onSelectAssess(record)}
                          style={{ cursor: canOpen ? 'pointer' : 'default' }}
                        >
                          <td>
                            <div className="work-queue-client-name">{record.client_name || '--'}</div>
                            <div className="work-queue-client-date">{record.caregiver || 'Caregiver not listed'}</div>
                          </td>
                          <td><span className={officePillClassName(record.clinic)}>{record.clinic || '--'}</span></td>
                          <td><span className="assessment-bcba-cell">{record.assigned_bcba || 'Unassigned'}</span></td>
                          <td>{sBdg(normalizeParentInterviewStatus(record.parent_interview_status))}</td>
                          <td>{assessVal(record.direct_obs_status || record.direct_obs)}</td>
                          <td>{lifecycleBadge(getAssessmentLifecycleStatus(record))}</td>
                          <td><span className={`assessment-blocker-pill assessment-blocker-${blockerTone(blocker)}`}>{blocker}</span></td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </SyncedHorizontalScrollTable>
          </div>
        </section>

        <aside className="assessment-bottlenecks-panel">
          <div className="assessment-side-head">
            <div>
              <div className="work-queue-eyebrow">Operational Focus</div>
              <div className="assessment-side-title">Clinical Bottlenecks</div>
            </div>
          </div>
          <div className="assessment-bottleneck-list">
            {bottlenecks.map(item => (
              <button
                key={item.key}
                type="button"
                className={`assessment-bottleneck-row assessment-bottleneck-${item.tone} ${activeFilter?.key === item.key ? 'is-active' : ''}`}
                onClick={() => toggleFilter(item.key, `Assessment Tracker: ${item.label}`)}
              >
                <span>{item.label}</span>
                <strong>{item.count}</strong>
                <small>Review</small>
              </button>
            ))}
          </div>
        </aside>
      </div>

    </>
  )
}

export function ParentInterviewsPage({ assessData, assessLoading, onSelectAssess, statFilter, onSetStatFilter, onClearStatFilter }) {
  const [search, setSearch] = useState('')
  const [office, setOffice] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('All')

  if (assessLoading) return <div className="loader-wrap"><div className="spinner" /></div>

  const { activeFilter } = getAssessmentPageFilter(statFilter, onSetStatFilter, 'parent-interviews')
  let filteredRows = assessData.filter(record => matchesStatFilter(record, activeFilter))

  // Apply additional filters
  if (search) {
    const lowerSearch = search.toLowerCase()
    filteredRows = filteredRows.filter(record =>
      (record.client_name || '').toLowerCase().includes(lowerSearch) ||
      (record.caregiver || '').toLowerCase().includes(lowerSearch)
    )
  }
  if (office !== 'ALL') {
    filteredRows = filteredRows.filter(record => (record.clinic || record.office || '').toUpperCase() === office)
  }
  if (statusFilter !== 'All') {
    filteredRows = filteredRows.filter(record => normalizeParentInterviewStatus(record.parent_interview_status) === statusFilter)
  }

  const openAssessment = (record) => {
    if (!getAssessmentRecordId(record)) return
    onSelectAssess(record)
  }

  return (
    <>
      <ActiveFilterBanner filter={activeFilter} onClear={onClearStatFilter} defaultText="Showing filtered parent interviews" />

      <div className="filter-row assessment-primary-controls">
        <div className="search-wrap assessment-search-group">
          <input className="search-input" placeholder="Search client or caregiver..." value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        <div className="filter-divider"></div>
        <div className="filter-btns assessment-clinic-filter-group">
          {['ALL', 'MERIDIAN', 'FOREST', 'FLOWOOD', 'DAY TREATMENT'].map(option => (
            <button key={option} className={`filter-btn ${office === option ? 'active' : ''}`} onClick={() => setOffice(option)}>{option}</button>
          ))}
        </div>
        <div className="filter-divider"></div>
        <div className="assessment-pa-select-group">
          <span>Interview Status</span>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Interview Status">
            <option value="All">All</option>
            <option value="Awaiting Assignment">Awaiting Assignment</option>
            <option value="Not Started">Not Started</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="No Show">No Show</option>
          </select>
        </div>
      </div>

      <div className="work-queue-card">
        <div className="work-queue-header" style={{ marginBottom: 16 }}>
          <div>
            <div className="work-queue-eyebrow">Parent Interview Workflow</div>
            <div className="work-queue-title">Parent Interview Work Queue</div>
            <div className="work-queue-subtitle">{filteredRows.length} clients in the current view.</div>
          </div>
        </div>
        <SyncedHorizontalScrollTable>
          <table className="work-queue-table">
            <thead><tr><th>Client</th><th>Office</th><th>Assigned BCBA</th><th>Parent Interview</th><th>Scheduled Date</th><th>Completed Date</th><th>Direct Observation</th><th>Direct Obs. Date</th><th>Insurance</th></tr></thead>
            <tbody>
              {filteredRows.length === 0
                ? <tr><td colSpan={9} style={{ padding: 56, textAlign: 'center', color: 'var(--dim)' }}>No assessment records found.</td></tr>
                : filteredRows.map(record => {
                  const canOpen = Boolean(getAssessmentRecordId(record))
                  const directObsStatus = record.direct_obs_status || record.direct_obs || ''
                  const directObsDate = record.direct_obs_completed_date || record.direct_obs_scheduled_date

                  return (
                    <tr
                      key={record.assessment_id || record.client_name}
                      className={canOpen ? 'row-hover' : ''}
                      onClick={() => openAssessment(record)}
                      style={{ cursor: canOpen ? 'pointer' : 'default' }}
                    >
                      <td>
                        {canOpen ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              openAssessment(record)
                            }}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <div style={{ fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>{record.client_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--dim)' }}>{record.caregiver || ''}</div>
                          </button>
                        ) : (
                          renderClientCell(record, record.caregiver)
                        )}
                      </td>
                      <td><span className={officePillClassName(record.clinic || record.office)}>{record.clinic || record.office || '--'}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{record.assigned_bcba || <span style={{ color: 'var(--dim)', fontStyle: 'italic' }}>Unassigned</span>}</td>
                      <td>{sBdg(normalizeParentInterviewStatus(record.parent_interview_status))}</td>
                      <td style={{ fontSize: 11, color: record.parent_interview_scheduled_date ? '#a5b4fc' : 'var(--dim)' }}>{formatDisplayDate(record.parent_interview_scheduled_date)}</td>
                      <td style={{ fontSize: 11, color: record.parent_interview_completed_date ? '#22c55e' : 'var(--dim)' }}>{formatDisplayDate(record.parent_interview_completed_date)}</td>
                      <td>{assessVal(directObsStatus)}</td>
                      <td style={{ fontSize: 11, color: record.direct_obs_completed_date ? '#22c55e' : record.direct_obs_scheduled_date ? '#a5b4fc' : 'var(--dim)' }}>{formatDisplayDate(directObsDate)}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{record.insurance || '--'}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </SyncedHorizontalScrollTable>
      </div>
    </>
  )
}

function getBcbaDisplayName(value) {
  return cleanLookupValue(value)
}

const UNASSIGNED_BCBA_KEY = '__unassigned__'

function getBcbaAssignmentKey(value) {
  return normalizeLookupValue(value) || UNASSIGNED_BCBA_KEY
}

function getPossessiveName(name) {
  return name.endsWith('s') ? `${name}'` : `${name}'s`
}

function getDuplicateBcbaGroups(records) {
  const groups = {}
  records.forEach(record => {
    const raw = record.assigned_bcba
    const key = normalizeLookupValue(raw)
    if (!key) return
    const clean = String(raw || '').trim()
    if (!groups[key]) groups[key] = new Set()
    groups[key].add(clean)
  })

  return Object.entries(groups)
    .map(([key, names]) => ({ key, names: Array.from(names).sort((a, b) => a.localeCompare(b)) }))
    .filter(group => group.names.length > 1)
}

function ManageBcbasContent({ officeOptions = [], onRefreshLookups }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ full_name: '', email: '', office: '' })
  const officeValues = optionValues(officeOptions)

  const resetForm = () => {
    setEditingId(null)
    setForm({ full_name: '', email: '', office: '' })
  }

  const loadStaff = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getBcbaStaffRecords()
      setStaff(data)
    } catch (err) {
      setLoadError(err.message || 'Failed to load BCBAs.')
      setStaff([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStaff()
  }, [])

  const startEdit = (record) => {
    setEditingId(record.id)
    setForm({
      full_name: cleanLookupValue(record.full_name),
      email: record.email || '',
      office: record.office || '',
    })
    setActionError(null)
    setMessage(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const fullName = cleanLookupValue(form.full_name)
    if (!fullName) {
      setActionError('BCBA name is required.')
      return
    }

    setSaving(true)
    setActionError(null)
    setMessage(null)
    try {
      if (editingId) {
        await updateBcbaStaff(editingId, form)
        setMessage('BCBA updated.')
      } else {
        await createBcbaStaff(form)
        setMessage('BCBA added.')
      }
      resetForm()
      await loadStaff()
      await onRefreshLookups?.()
    } catch (err) {
      setActionError(err.message || 'Could not save BCBA.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (record) => {
    setBusyId(record.id)
    setActionError(null)
    setMessage(null)
    try {
      await deactivateBcbaStaff(record.id)
      setMessage(`${cleanLookupValue(record.full_name)} deactivated.`)
      await loadStaff()
      await onRefreshLookups?.()
      if (editingId === record.id) resetForm()
    } catch (err) {
      setActionError(err.message || 'Could not deactivate BCBA.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '12px', letterSpacing: '0.5px' }}>NEW BCBA</div>
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'end' }}>
            <div>
              <div className="label" style={{ marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>BCBA Name</div>
              <input className="edit-input" value={form.full_name} onChange={event => setForm(prev => ({ ...prev, full_name: event.target.value }))} placeholder="Full name" style={{ width: '100%' }} />
            </div>
            <div>
              <div className="label" style={{ marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Email</div>
              <input className="edit-input" type="email" value={form.email} onChange={event => setForm(prev => ({ ...prev, email: event.target.value }))} placeholder="Optional" style={{ width: '100%' }} />
            </div>
            <div>
              <div className="label" style={{ marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Office</div>
              {officeValues.length ? (
                <select className="edit-select" value={form.office} onChange={event => setForm(prev => ({ ...prev, office: event.target.value }))} style={{ width: '100%' }}>
                  <option value="">Optional</option>
                  {officeValues.map(office => <option key={office} value={office}>{office}</option>)}
                </select>
              ) : (
                <input className="edit-input" value={form.office} onChange={event => setForm(prev => ({ ...prev, office: event.target.value }))} placeholder="Optional" style={{ width: '100%' }} />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn-save" type="submit" disabled={saving || !cleanLookupValue(form.full_name)} style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
                {saving ? 'Saving...' : editingId ? 'Save BCBA' : 'Add BCBA'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        {editingId ? <button type="button" className="btn-ghost" onClick={resetForm} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>Cancel Edit</button> : null}
      </div>

      {loadError ? (
        <div className="error-bar" style={{ marginBottom: 14 }}>
          Failed to load BCBAs: {loadError}
          <button className="x-btn" onClick={() => setLoadError(null)}>Close</button>
        </div>
      ) : null}

      {actionError ? (
        <div className="error-bar" style={{ marginBottom: 14 }}>
          {actionError}
          <button className="x-btn" onClick={() => setActionError(null)}>Close</button>
        </div>
      ) : null}

      {message ? (
        <div style={{ marginBottom: 14, borderRadius: 10, border: '1px solid #16a34a33', background: '#16a34a12', color: '#16a34a', padding: '10px 12px', fontSize: 12, fontWeight: 700 }}>
          {message}
        </div>
      ) : null}

      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '12px', letterSpacing: '0.5px' }}>ACTIVE ROSTER</div>
      <div className="card" style={{ borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text)', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text)', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text)', textAlign: 'left' }}>Office</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text)', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: 'var(--dim)' }}>Loading BCBAs...</td></tr>
              ) : loadError ? (
                <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: 'var(--red)' }}>Failed to load BCBAs.</td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: 'var(--dim)' }}>No active BCBAs configured yet.</td></tr>
              ) : staff.map(record => (
                <tr key={record.id || record.full_name} style={{ borderBottom: '1px solid var(--border2)' }}>
                  <td style={{ padding: '16px', fontWeight: 600, fontSize: '14px' }}>{cleanLookupValue(record.full_name)}</td>
                  <td style={{ padding: '16px', fontSize: '13px', color: 'var(--muted)' }}>{record.email || '--'}</td>
                  <td style={{ padding: '16px' }}><span className={officePillClassName(record.office)}>{record.office || '--'}</span></td>
                  <td style={{ padding: '16px' }}>
                    {record.is_active === false ? 
                      <span className="bdg" style={{ background: '#64748b20', color: '#94a3b8', border: '1px solid #64748b35', borderRadius: '16px', padding: '4px 8px', fontSize: '11px', fontWeight: 600 }}>Inactive</span> : 
                      <span className="bdg" style={{ background: '#22c55e15', color: '#16a34a', border: '1px solid #22c55e30', borderRadius: '16px', padding: '4px 8px', fontSize: '11px', fontWeight: 600 }}>Active</span>
                    }
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button type="button" className="btn-ghost" onClick={() => startEdit(record)} style={{ padding: '6px 12px', fontSize: '12px', marginRight: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}>Edit</button>
                    {record.is_active !== false ? (
                      <button type="button" className="btn-ghost" onClick={() => handleDeactivate(record)} disabled={busyId === record.id} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #ef444430', background: '#fef2f2', color: '#dc2626' }}>
                        {busyId === record.id ? 'Deactivating...' : 'Deactivate'}
                      </button>
                    ) : null}
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

function ManageBcbasModal({ isOpen, onClose, officeOptions = [], onRefreshLookups }) {
  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={event => event.stopPropagation()}
        style={{
          width: 'min(100%, 960px)',
          maxWidth: 960,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
      >
        <div className="modal-head" style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div>
            <div className="modal-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Manage BCBAs</div>
            <div className="modal-sub" style={{ fontSize: '14px', color: 'var(--muted)' }}>Add, update, or deactivate BCBA assignment options.</div>
          </div>
          <button className="close-btn" onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '24px 32px', overflowY: 'auto', background: 'var(--surface)' }}>
          <ManageBcbasContent officeOptions={officeOptions} onRefreshLookups={onRefreshLookups} />
        </div>
      </div>
    </div>
  )
}

export function BCBAAssignmentsPage({
  assessData,
  assessLoading,
  onSelectAssess,
  statFilter,
  onSetStatFilter,
  onClearStatFilter,
  bcbaOptions = [],
  officeOptions = [],
  onRefreshLookups,
}) {
  const [selectedBcbaKey, setSelectedBcbaKey] = useState(null)
  const [manageBcbasOpen, setManageBcbasOpen] = useState(false)

  if (assessLoading) return <div className="loader-wrap"><div className="spinner" /></div>

  const unassigned = assessData.filter(record => getBcbaAssignmentKey(record.assigned_bcba) === UNASSIGNED_BCBA_KEY)
  const assigned = assessData.filter(record => getBcbaAssignmentKey(record.assigned_bcba) !== UNASSIGNED_BCBA_KEY)
  const byBCBA = {}
  const staffNamesByKey = {}
  bcbaOptions.forEach(option => {
    const name = option.value ?? option.label
    const key = normalizeLookupValue(name)
    if (key) staffNamesByKey[key] = cleanLookupValue(name)
  })
  const duplicateGroups = getDuplicateBcbaGroups(assessData)
  const bcbaFilter = isStatFilterTarget(statFilter, 'bcba-assignments')
  const treatmentPlanFilter = isStatFilterTarget(statFilter, 'treatment-plans')
  const activeFilter = bcbaFilter || treatmentPlanFilter
  const toggleFilter = (key, label) => onSetStatFilter(toggleStatFilter(bcbaFilter, { target: 'bcba-assignments', key, label }))
  const filteredRows = assessData.filter(record => matchesStatFilter(record, activeFilter))

  assigned.forEach(record => {
    const workflowStatus = normalizeTreatmentPlanStatus(record.treatment_plan_status)
    const key = getBcbaAssignmentKey(record.assigned_bcba)
    const displayName = staffNamesByKey[key] || getBcbaDisplayName(record.assigned_bcba)
    if (!byBCBA[key]) byBCBA[key] = { name: displayName, total: 0, completed: 0, inProgress: 0, notStarted: 0 }
    byBCBA[key].total += 1
    if (workflowStatus === 'Completed' || workflowStatus === 'Finalized') byBCBA[key].completed += 1
    else if (workflowStatus === 'In Progress') byBCBA[key].inProgress += 1
    else byBCBA[key].notStarted += 1
  })

  const unassignedStats = unassigned.reduce((stats, record) => {
    const workflowStatus = normalizeTreatmentPlanStatus(record.treatment_plan_status)
    stats.total += 1
    if (workflowStatus === 'Completed' || workflowStatus === 'Finalized') stats.completed += 1
    else if (workflowStatus === 'In Progress') stats.inProgress += 1
    else stats.notStarted += 1
    return stats
  }, { name: 'Unassigned', total: 0, completed: 0, inProgress: 0, notStarted: 0 })

  const bcbaCards = [
    ...Object.entries(byBCBA).map(([key, stats]) => [key, stats]),
    ...(unassignedStats.total > 0 ? [[UNASSIGNED_BCBA_KEY, unassignedStats]] : []),
  ]

  const handleCardFilter = (bcbaKey) => {
    setSelectedBcbaKey(current => current === bcbaKey ? null : bcbaKey)
  }

  const handleCardKeyDown = (event, bcbaKey) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handleCardFilter(bcbaKey)
  }

  const tableRows = selectedBcbaKey
    ? filteredRows.filter(record => getBcbaAssignmentKey(record.assigned_bcba) === selectedBcbaKey)
    : filteredRows
  const selectedBcbaName = selectedBcbaKey === UNASSIGNED_BCBA_KEY
    ? 'Unassigned'
    : selectedBcbaKey
      ? byBCBA[selectedBcbaKey]?.name || 'Selected BCBA'
      : null
  const tableHeading = selectedBcbaKey === UNASSIGNED_BCBA_KEY
    ? `Unassigned Clients (${tableRows.length})`
    : selectedBcbaName
      ? `${getPossessiveName(selectedBcbaName)} Clients (${tableRows.length})`
      : activeFilter?.key === 'unassigned'
        ? `Unassigned Clients (${tableRows.length})`
        : activeFilter?.key === 'assigned'
          ? `Assigned Clients (${tableRows.length})`
          : `BCBA Waitlist Queue (${tableRows.length})`

  return (
    <>
      <div className="pg-hdr" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="pg-hdr-title">BCBA Waitlist</div>
          <div className="pg-hdr-sub">Clients currently awaiting BCBA assignment or treatment plan progression</div>
        </div>
        <button type="button" onClick={() => setManageBcbasOpen(true)} style={{ fontSize: 12, padding: '8px 16px', borderRadius: '20px', background: 'var(--accent)', border: '1px solid var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Manage BCBAs
        </button>
      </div>
      <ActiveFilterBanner filter={activeFilter} onClear={onClearStatFilter} defaultText="Showing filtered BCBA waitlist" />

      {duplicateGroups.length > 0 ? (
        <div className="card card-pad" style={{ marginBottom: 22, borderColor: '#f59e0b55' }}>
          <div className="section-hdr" style={{ marginTop: 0 }}>Suspected Duplicate BCBA Names</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 12 }}>These assignments normalize to the same name. Review before deciding whether old records need manual cleanup.</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {duplicateGroups.map(group => (
              <div key={group.key} className="info-row" style={{ alignItems: 'flex-start' }}>
                <span className="info-label">Canonical</span>
                <span className="info-val">{cleanLookupValue(group.names[0])} <span style={{ color: 'var(--dim)' }}>({group.names.join(', ')})</span></span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {bcbaCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12, marginBottom: 22 }}>
          {bcbaCards.map(([bcbaKey, stats]) => {
            const isSelected = selectedBcbaKey === bcbaKey
            return (
            <div
              key={bcbaKey}
              className="card"
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => handleCardFilter(bcbaKey)}
              onKeyDown={event => handleCardKeyDown(event, bcbaKey)}
              style={{
                cursor: 'pointer',
                borderColor: isSelected ? '#6366f1' : 'var(--border)',
                background: isSelected ? 'color-mix(in srgb, var(--accent) 9%, var(--surface))' : 'var(--surface)',
                boxShadow: isSelected ? '0 0 0 1px #6366f145, 0 12px 28px rgba(99,102,241,0.12)' : 'var(--shadow)',
                transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
                padding: '16px',
                borderRadius: '20px',
              }}
            >
              <div style={{ display: 'grid', justifyItems: 'center', gap: 8, marginBottom: 14, textAlign: 'center' }}>
                <div style={{ fontWeight: 750, fontSize: 15 }}>{stats.name}</div>
                <span className="bdg" style={{ background: '#6366f120', color: '#a5b4fc', border: '1px solid #6366f130', fontSize: 11 }}>{stats.total} clients</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 22 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{stats.completed}</div>
                  <div style={{ fontSize: 10, color: 'var(--dim)' }}>Completed</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{stats.inProgress}</div>
                  <div style={{ fontSize: 10, color: 'var(--dim)' }}>In Progress</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{stats.notStarted}</div>
                  <div style={{ fontSize: 10, color: 'var(--dim)' }}>Not Started</div>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: selectedBcbaKey ? '#a5b4fc' : activeFilter?.key === 'unassigned' ? '#ef4444' : activeFilter?.key === 'assigned' ? '#22c55e' : '#a5b4fc' }}>
          {tableHeading}
        </div>
        {selectedBcbaKey ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="bdg" style={{ background: '#6366f120', color: '#a5b4fc', border: '1px solid #6366f135' }}>
              Filtering by {selectedBcbaName}
            </span>
            <button type="button" className="btn-ghost" onClick={() => setSelectedBcbaKey(null)} style={{ padding: '6px 10px', fontSize: 12 }}>
              Clear filter
            </button>
          </div>
        ) : null}
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Office</th><th>Assigned BCBA</th><th>Treatment Plan Status</th><th>Authorization Status</th><th>Treatment Plan Started</th><th>Treatment Plan Completed</th><th>Next Step</th></tr></thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 56, textAlign: 'center', color: 'var(--dim)' }}>{selectedBcbaKey ? 'No clients assigned to this BCBA yet.' : 'No assessment records match the current filter.'}</td></tr>
              ) : tableRows.map(record => (
                <tr
                  key={record.assessment_id || record.client_name}
                  className="row-hover"
                  onClick={() => getAssessmentRecordId(record) && onSelectAssess(record)}
                  style={{ cursor: getAssessmentRecordId(record) ? 'pointer' : 'default' }}
                >
                  <td>{renderClientCell(record, record.caregiver)}</td>
                  <td><span className={officePillClassName(record.clinic || record.office)}>{record.clinic || record.office || '--'}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{getBcbaDisplayName(record.assigned_bcba) || <span style={{ color: 'var(--dim)', fontStyle: 'italic' }}>Unassigned</span>}</td>
                  <td>{sBdg(normalizeTreatmentPlanStatus(record.treatment_plan_status))}</td>
                  <td><PaStatusBadge status={getAuthorizationStatus(record)} /></td>
                  <td style={{ fontSize: 11, color: record.treatment_plan_started_date ? 'var(--muted)' : 'var(--dim)' }}>{formatDisplayDate(record.treatment_plan_started_date)}</td>
                  <td style={{ fontSize: 11, color: record.treatment_plan_completed_date ? '#22c55e' : 'var(--dim)' }}>{formatDisplayDate(record.treatment_plan_completed_date)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (getAssessmentRecordId(record)) onSelectAssess(record)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        borderRadius: '16px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'var(--accent)'}
                      onMouseLeave={(e) => e.target.style.background = 'var(--surface2)'}
                    >
                      Open Client
                      <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ManageBcbasModal
        isOpen={manageBcbasOpen}
        onClose={() => setManageBcbasOpen(false)}
        officeOptions={officeOptions}
        onRefreshLookups={onRefreshLookups}
      />
    </>
  )
}

export function AssessmentProgressPage({ assessData, assessLoading, onSelectAssess, statFilter, onSetStatFilter, onClearStatFilter }) {
  const [notifyRecord, setNotifyRecord] = useState(null)
  const [search, setSearch] = useState('')
  const [progressFilter, setProgressFilter] = useState('All')

  if (assessLoading) return <div className="loader-wrap"><div className="spinner" /><div style={{ color: 'var(--muted)', marginTop: 12 }}>Loading assessment progress...</div></div>

  const { activeFilter } = getAssessmentPageFilter(statFilter, onSetStatFilter, 'assessment-progress')
  const filteredRows = assessData
    .filter(record => matchesStatFilter(record, activeFilter))
    .filter(record => {
      const query = (search || '').toLowerCase()
      const name = (record.client_name || '').toLowerCase()
      const caregiver = (record.caregiver || '').toLowerCase()
      if (query && !(name.includes(query) || caregiver.includes(query))) return false
      if (progressFilter !== 'All' && getAssessmentWorkflowStatus(record) !== progressFilter) return false
      return true
    })

  const progressOptions = ['All', 'Not Started', 'In Progress', 'Completed']

  return (
    <>
      <ActiveFilterBanner filter={activeFilter} onClear={onClearStatFilter} defaultText="Showing filtered assessment progress records" />

      <div className="filter-row assessment-primary-controls" style={{ marginBottom: 22 }}>
        <div className="search-wrap assessment-search-group">
          <input
            className="search-input"
            placeholder="Search client or caregiver..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        <div className="filter-divider"></div>
        <div className="assessment-pa-select-group" style={{ minWidth: 180 }}>
          <span className="filter-label">Progress</span>
          <select
            className="input-field"
            value={progressFilter}
            onChange={event => setProgressFilter(event.target.value)}
            aria-label="Assessment Progress"
            style={{ background: 'transparent', border: 'none', padding: 0, minWidth: 120, boxShadow: 'none' }}
          >
            {progressOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <section className="assessment-work-queue">
        <div className="card assessment-work-queue-card">
          <div className="work-queue-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="work-queue-eyebrow">Assessment Completion Queue</div>
              <div className="work-queue-title">Assessment Completion Queue</div>
              <div className="work-queue-subtitle">{filteredRows.length} clients in view.</div>
            </div>
          </div>
          <SyncedHorizontalScrollTable>
            <table className="work-queue-table assessment-work-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>BCBA</th>
                  <th>Vineland</th>
                  <th>SRS-2</th>
                  <th>VBMAPP</th>
                  <th>Socially Savvy</th>
                  <th>Complete</th>
                  <th>Status</th>
                  <th>Next Step</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={9} className="assessment-empty-row">No assessment records match the current filter.</td></tr>
                ) : filteredRows.map(record => {
                  const progressFields = getAssessmentProgressFields(record)
                  const completionPercent = getAssessmentProgressPercent(record)
                  const canOpen = Boolean(getAssessmentRecordId(record))

                  return (
                    <tr
                      key={record.assessment_id || record.client_name}
                      className={canOpen ? 'row-hover' : ''}
                      onClick={() => canOpen && onSelectAssess(record)}
                      style={{ cursor: canOpen ? 'pointer' : 'default' }}
                    >
                      <td>{renderClientCell(record, record.clinic)}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{record.assigned_bcba || <span style={{ color: '#ef4444', fontStyle: 'italic', fontSize: 11 }}>Unassigned</span>}</td>
                      <td>{assessVal(progressFields.vineland)}</td>
                      <td>{assessVal(progressFields.srs2)}</td>
                      <td>{assessVal(progressFields.vbmapp)}</td>
                      <td>{assessVal(progressFields.sociallySavvy)}</td>
                      <td>
                        <div className="assessment-progress-indicator">
                          <div className="assessment-progress-bar">
                            <div style={{ width: completionPercent }} />
                          </div>
                          <span>{completionPercent}</span>
                        </div>
                      </td>
                      <td>{paStatus(record.pa_status || getAuthorizationStatus(record))}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-ghost assessment-notify-btn"
                          onClick={(event) => {
                            event.stopPropagation()
                            setNotifyRecord(record)
                          }}
                        >
                          <Send size={14} />
                          Notify Parent
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </SyncedHorizontalScrollTable>
        </div>
      </section>

      {notifyRecord && <NotifyModal referral={notifyRecord} onClose={() => setNotifyRecord(null)} />}
    </>
  )
}

export function TreatmentPlansPage({ assessData, assessLoading, onSelectAssess, statFilter, onSetStatFilter, onClearStatFilter }) {
  if (assessLoading) return <div className="loader-wrap"><div className="spinner" /></div>

  const normalizedRecords = assessData.map(record => ({
    ...record,
    treatment_plan_status: normalizeTreatmentPlanStatus(record.treatment_plan_status),
  }))

  const byStatus = {}
  TX_STATUSES.forEach(status => {
    byStatus[status] = normalizedRecords.filter(record => record.treatment_plan_status === status).length
  })

  const activeFilter = isStatFilterTarget(statFilter, 'treatment-plans')
  const filteredRecords = !activeFilter
    ? normalizedRecords
    : normalizedRecords.filter(record => matchesStatFilter(record, activeFilter))
  const toggleFilter = (status) => onSetStatFilter(toggleStatFilter(activeFilter, { target: 'treatment-plans', key: status, label: `Treatment Plans: ${status}` }))

  return (
    <>
      <div className="pg-hdr">
        <div className="pg-hdr-title">Treatment Plan Status</div>
        <div className="pg-hdr-sub">Track treatment plan drafting, completion, and finalization</div>
      </div>
      <div className="stats-row stats-3" style={{ marginBottom: 12 }}>
        {TX_STATUSES.map(status => (
          <ClickableStatCard
            key={status}
            value={byStatus[status] || 0}
            label={status}
            color={txColor(status)}
            active={activeFilter?.key === status}
            onClick={() => toggleFilter(status)}
          />
        ))}
      </div>
      <ActiveFilterBanner filter={activeFilter} onClear={onClearStatFilter} defaultText="Showing filtered treatment plans" />
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>BCBA</th><th>Assessment Progress</th><th>Treatment Plan</th><th>Authorization</th><th>Started</th><th>Completed</th><th /></tr></thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 56, textAlign: 'center', color: 'var(--dim)' }}>No treatment plans match the current filter.</td></tr>
              ) : filteredRecords.map(record => (
                <tr
                  key={record.assessment_id || record.client_name}
                  className="row-hover"
                  onClick={() => getAssessmentRecordId(record) && onSelectAssess(record)}
                  style={{ cursor: getAssessmentRecordId(record) ? 'pointer' : 'default' }}
                >
                  <td>{renderClientCell(record, record.clinic)}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{record.assigned_bcba || '--'}</td>
                  <td>{sBdg(getAssessmentWorkflowStatus(record))}</td>
                  <td>{sBdg(record.treatment_plan_status || 'Not Started')}</td>
                  <td><PaStatusBadge status={getAuthorizationStatus(record) || 'Not Submitted'} /></td>
                  <td style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDisplayDate(record.treatment_plan_started_date)}</td>
                  <td style={{ fontSize: 11, color: record.treatment_plan_completed_date ? '#22c55e' : 'var(--dim)' }}>{formatDisplayDate(record.treatment_plan_completed_date)}</td>
                  <td style={{ color: 'var(--accent)' }}>→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export function ReadyForServicesPage({ assessData, assessLoading, onSelectAssess, statFilter, onSetStatFilter, onClearStatFilter }) {
  if (assessLoading) return <div className="loader-wrap"><div className="spinner" /></div>

  const activeClients = assessData.filter(record => isAssessmentActiveClient(record))
  const activeClientSet = new Set(activeClients)
  const ready = assessData.filter(record => record.ready_for_services === true && getAssessmentLifecycleStatus(record) !== 'Referred Out' && !activeClientSet.has(record))
  const readyRows = ready

  return (
    <section className="ready-services-page">
      <div className="ready-services-header">
        <div className="ready-services-title-row">
          <CheckCircle size={22} strokeWidth={2.4} aria-hidden="true" />
          <div className="pg-hdr-title ready-services-title">Queue</div>
        </div>
        <div className="ready-services-subtitle">
          Clients in this queue have completed intake and are ready for transition out of intake.
        </div>
      </div>

      <div className="card ready-services-table-card">
        <div className="table-wrap">
          <table className="ready-services-table">
            <thead><tr><th>Client</th><th>BCBA</th><th>Authorization</th><th>Auth Approved</th><th>Active Date</th><th>Notes</th><th>Open</th></tr></thead>
            <tbody>
              {readyRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ready-services-empty">
                    <div>No clients are ready for services yet.</div>
                    <span>Completed clients will appear here once intake and authorization requirements are finished.</span>
                  </td>
                </tr>
              ) : readyRows.map(record => (
                <tr
                  key={record.assessment_id || record.client_name}
                  className="row-hover"
                  onClick={() => getAssessmentRecordId(record) && onSelectAssess(record)}
                  style={{ cursor: getAssessmentRecordId(record) ? 'pointer' : 'default' }}
                >
                  <td>
                    <div className="ready-services-client-name">{record.client_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--dim)' }}>{record.clinic || ''}</div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{record.assigned_bcba || '--'}</td>
                  <td><PaStatusBadge status={getAuthorizationStatus(record)} /></td>
                  <td style={{ fontSize: 11, color: '#a5b4fc' }}>{formatDate(record.authorization_approved_date || record.pa_decision_date) || '--'}</td>
                  <td>
                    {record.active_client_date ? (
                      <span style={{ fontSize: 11, color: '#22c55e' }}>{formatDate(record.active_client_date)}</span>
                    ) : (
                      <span className="verification-pill verification-pill-awaiting">Pending</span>
                    )}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--dim)', maxWidth: 160 }}>{record.notes || '--'}</td>
                  <td>
                    <button
                      className="btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        getAssessmentRecordId(record) && onSelectAssess(record)
                      }}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )

}

export function ActiveClientsPage({ assessData, assessLoading, onSelectAssess }) {
  const [search, setSearch] = useState('')

  if (assessLoading) return <div className="loader-wrap"><div className="spinner" /></div>

  const activeClients = assessData.filter(record => isAssessmentActiveClient(record))
  const query = search.trim().toLowerCase()
  const filtered = activeClients.filter(record => {
    if (!query) return true
    return [
      record.client_name,
      record.clinic || record.office,
      record.assigned_bcba,
      record.insurance,
      record.notes,
    ].some(value => String(value || '').toLowerCase().includes(query))
  })

  return (
    <>
      <div className="pg-hdr">
        <div className="pg-hdr-title">Active Clients</div>
        <div className="pg-hdr-sub">Completed intake records closed from the active Initial Assessment workflow</div>
      </div>

      <div className="filter-row">
        <div className="search-wrap">
          <input className="search-input" placeholder="Search active clients..." value={search} onChange={event => setSearch(event.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Clinic</th><th>BCBA</th><th>Insurance</th><th>Authorization</th><th>Active Date</th><th>Lifecycle</th><th>Notes</th></tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={8} style={{ padding: 56, textAlign: 'center', color: 'var(--dim)' }}>No active client records found.</td></tr>
                : filtered.map(record => (
                  <tr
                    key={record.assessment_id || record.client_name}
                    className="row-hover"
                    onClick={() => getAssessmentRecordId(record) && onSelectAssess(record)}
                    style={{ cursor: getAssessmentRecordId(record) ? 'pointer' : 'default' }}
                  >
                    <td>{renderClientCell(record, record.caregiver)}</td>
                    <td><span className={officePillClassName(record.clinic || record.office)}>{record.clinic || record.office || '--'}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{record.assigned_bcba || '--'}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{record.insurance || '--'}</td>
                    <td><PaStatusBadge status={getAuthorizationStatus(record)} /></td>
                    <td style={{ fontSize: 11, color: '#22c55e' }}>{formatDate(record.active_client_date)}</td>
                    <td>{lifecycleBadge(getAssessmentLifecycleStatus(record))}</td>
                    <td style={{ fontSize: 11, color: record.notes ? 'var(--muted)' : 'var(--dim)', maxWidth: 220 }}>{record.notes || '--'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
