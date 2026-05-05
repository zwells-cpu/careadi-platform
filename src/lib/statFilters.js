import { getAssessmentLifecycleStatus, getAssessmentWorkflowStatus, getAuthorizationStatus, getInsuranceVerificationStatus, getReferralStage, isAssessmentActiveClient, isAuthorizationApproved, normalizeAutismDx, normalizeParentInterviewStatus, normalizeTreatmentPlanStatus } from './utils'

function assessmentParentComplete(record) {
  return normalizeParentInterviewStatus(record?.parent_interview_status) === 'Completed'
    || Boolean(record?.parent_interview_completed_date)
}

function assessmentParentScheduled(record) {
  return assessmentParentComplete(record)
    || normalizeParentInterviewStatus(record?.parent_interview_status) === 'Scheduled'
    || Boolean(record?.parent_interview_scheduled_date)
}

function assessmentDirectObsComplete(record) {
  const status = String(record?.direct_obs_status || record?.direct_obs || '').trim()
  return status === 'Completed' || Boolean(record?.direct_obs_completed_date)
}

function assessmentDirectObsScheduled(record) {
  const status = String(record?.direct_obs_status || record?.direct_obs || '').trim()
  return assessmentDirectObsComplete(record)
    || status === 'Scheduled'
    || Boolean(record?.direct_obs_scheduled_date)
}

function assessmentReferenceDays(record) {
  const rawDate = record?.date_received || record?.created_at || record?.assessment_created_at || record?.updated_at || record?.parent_interview_scheduled_date || record?.treatment_plan_started_date
  if (!rawDate) return 0
  const timestamp = new Date(rawDate).getTime()
  if (Number.isNaN(timestamp)) return 0
  return Math.floor((Date.now() - timestamp) / 86400000)
}

export function isStatFilterTarget(filter, target) {
  return filter?.target === target ? filter : null
}

export function toggleStatFilter(currentFilter, nextFilter) {
  if (!nextFilter) return null
  return currentFilter?.target === nextFilter.target && currentFilter?.key === nextFilter.key ? null : nextFilter
}

export function matchesStatFilter(record, filter) {
  const target = filter?.target
  const key = filter?.key

  if (!target || !key) return true

  if (target === 'all-referrals') {
    const paperwork = (record.intake_paperwork || '').toLowerCase()
    if (key === 'paperwork-signed') return paperwork.includes('signed')
    if (key === 'paperwork-pending') return !['signed', 'completed'].includes(paperwork)
    if (key === 'ready-for-interview') return getReferralStage(record) === 'Ready for Interview'
    if (key === 'transitioned-to-initial') return record.__transitioned === true
    if (key === 'non-responsive-only') return record.status === 'non-responsive'
    if (key === 'non-responsive-all') return record.status === 'non-responsive' || record.status === 'referred-out'
    return true
  }

  if (target === 'pending-docs') {
    const paperwork = (record.intake_paperwork || '').toLowerCase()
    const dx = normalizeAutismDx(record.autism_diagnosis).toLowerCase()
    if (key === 'not-yet-sent') return !paperwork.includes('emailed') && !['signed', 'completed'].includes(paperwork)
    if (key === 'emailed') return paperwork.includes('emailed')
    if (key === 'needs-dx') return dx !== 'received'
    return !['signed', 'completed'].includes(paperwork)
  }

  if (target === 'insurance-verification') {
    const status = getInsuranceVerificationStatus(record)
    if (key === 'verified' || key === 'confirmed') return status === 'YES'
    if (key === 'awaiting') return status === 'AWAITING'
    if (key === 'not-started' || key === 'follow-up-needed') return status === 'NO'
    if (key === 'ready-to-verify') return !status
    if (key === 'total-active') return true
    return status !== 'YES'
  }

  if (target === 'non-responsive') {
    if (key === 'referred-out') return record.status === 'referred-out'
    if (key === 'non-responsive-only') return record.status === 'non-responsive'
    return record.status === 'non-responsive' || record.status === 'referred-out'
  }

  if (target === 'assessment-tracker') {
    const pa = getAuthorizationStatus(record)
    const stage = getAssessmentWorkflowStatus(record)
    const parentStatus = normalizeParentInterviewStatus(record.parent_interview_status)
    if (key === 'pa-approved') return pa === 'Approved'
    if (key === 'partially-approved') return pa === 'Partially Approved'
    if (key === 'in-progress') return stage === 'In Progress'
    if (key === 'denied-appealed') return ['Denied', 'Appeal Pending'].includes(pa)
    if (key === 'awaiting-pa') return ['Pending Submission', 'Submitted / In Review'].includes(pa)
    if (key === 'ready-interview') return assessmentParentScheduled(record) && !assessmentParentComplete(record)
    if (key === 'parent-follow-up') return !assessmentParentComplete(record) && (!assessmentParentScheduled(record) || ['No Show', 'Not Started', 'Awaiting Assignment'].includes(parentStatus))
    if (key === 'direct-observation') return assessmentParentScheduled(record) && !assessmentDirectObsScheduled(record)
    if (key === 'bcba-review') return stage === 'Completed' && ['', 'Not Started'].includes(normalizeTreatmentPlanStatus(record.treatment_plan_status)) && getAssessmentLifecycleStatus(record) !== 'Referred Out'
    if (key === 'stalled') return assessmentReferenceDays(record) > 14 && stage !== 'Completed' && getAssessmentLifecycleStatus(record) !== 'Referred Out' && !isAssessmentActiveClient(record)
    if (key === 'missing-documents') return !record.vineland || !record.srs2 || !record.vbmapp || !record.socially_savvy
    if (key === 'waiting-bcba') return Boolean(record.assigned_bcba) && stage === 'Completed' && ['', 'Not Started'].includes(normalizeTreatmentPlanStatus(record.treatment_plan_status))
    return true
  }

  if (target === 'parent-interviews') {
    const status = normalizeParentInterviewStatus(record.parent_interview_status)
    if (key === 'awaiting-assignment') return status === 'Awaiting Assignment'
    if (key === 'not-started') return status === 'Not Started'
    if (key === 'scheduled') return status === 'Scheduled'
    if (key === 'in-progress') return status === 'In Progress'
    if (key === 'completed') return status === 'Completed'
    if (key === 'no-show') return status === 'No Show'
    return true
  }

  if (target === 'bcba-assignments') {
    if (key === 'unassigned') return !record.assigned_bcba
    if (key === 'assigned') return Boolean(record.assigned_bcba)
    return true
  }

  if (target === 'assessment-progress') {
    const status = getAssessmentWorkflowStatus(record)
    if (key === 'not-started') return !status || status === 'Not Started'
    if (key === 'in-progress') return status === 'In Progress'
    if (key === 'completed') return status === 'Completed'
    return true
  }

  if (target === 'treatment-plans') {
    return normalizeTreatmentPlanStatus(record.treatment_plan_status) === key
  }

  if (target === 'ready-for-services') {
    if (key === 'active-clients') return isAssessmentActiveClient(record)
    if (key === 'ready') return record.ready_for_services === true
    if (key === 'referred-out') return getAssessmentLifecycleStatus(record) === 'Referred Out'
    if (key === 'awaiting-authorization') {
      return getAssessmentWorkflowStatus(record) === 'Completed'
        && !isAuthorizationApproved(record)
        && !record.ready_for_services
    }
    if (key === 'not-ready') return record.ready_for_services !== true
    return !record.ready_for_services
  }

  if (target === 'active-clients') {
    return isAssessmentActiveClient(record)
  }

  return true
}
