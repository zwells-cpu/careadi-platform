import { STAGE_COLORS, STAGE_ICONS, PA_COLORS, PA_ICONS } from './constants'

export const PARENT_INTERVIEW_STATUSES = ['Awaiting Assignment', 'Not Started', 'Scheduled', 'In Progress', 'Completed', 'No Show']
export const ASSESSMENT_COMPONENT_STATUSES = ['Not Started', 'Scheduled', 'In Progress', 'Completed']
export const TREATMENT_PLAN_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Finalized']
export const AUTHORIZATION_STATUSES = ['Not Submitted', 'Pending Submission', 'Submitted / In Review', 'Approved', 'Partially Approved', 'Reauthorization Needed', 'Appeal Pending', 'Denied', 'No PA Needed', 'Approved/Discharged', 'Referred Out']
export const POSITIVE_AUTHORIZATION_STATUSES = ['Approved', 'No PA Needed', 'Approved/Discharged']

// ── Status color ──
export function sc(v) {
  if (!v || v === 'N/A' || v === '--') return '#94a3b8'
  const normalized = String(v || '').trim()
  if (PA_COLORS[normalized]) return PA_COLORS[normalized]
  const u = v.toUpperCase()
  if (u.includes('PROVIDER REFERRAL')) return '#3b82f6'
  if (u.includes('NOT RECEIVED')) return '#ef4444'
  if (u.includes('PLEASE')) return '#3b82f6'
  if (['COMPLETED','SIGNED','YES','RECEIVED'].some(x => u.includes(x))) return '#22c55e'
  if (u.includes('TOO YOUNG')) return '#fb923c'
  if (['EMAILED','REMINDER'].some(x => u.includes(x))) return '#f59e0b'
  if (['AWAITING','REQUESTED'].some(x => u.includes(x))) return '#fb923c'
  if (u === 'NO') return '#ef4444'
  if (['DISCHARGED','REFERRED OUT','CLOSED','INACTIVE','APPROVED/DISCHARGED'].some(x => u.includes(x))) return '#64748b'
  return '#64748b'
}

// ── Badge icon ──
export function badgeIcon(v) {
  return ''
}

// ── Completion percentage ──
export function pct(r) {
  const fs = ['referral_form','permission_assessment','vineland','srs2','insurance_verified','autism_diagnosis','intake_paperwork','intake_personnel']
  const done = fs.filter(f => {
    const v = f === 'insurance_verified'
      ? getInsuranceVerificationStatus(r)
      : f === 'autism_diagnosis'
      ? normalizeAutismDx(r[f], { emptyAsNotReceived: false }).toUpperCase()
      : (r[f] || '').toUpperCase()
    return ['YES','COMPLETED','SIGNED','RECEIVED'].some(x => v.includes(x))
  })
  return Math.round(done.length / fs.length * 100)
}

function isReceivedOrCompleted(value) {
  const normalized = String(value || '').trim().toUpperCase()
  return ['YES', 'COMPLETED', 'SIGNED', 'RECEIVED', 'PROVIDER REFERRAL'].some(token => normalized.includes(token))
}

export function hasReferralIntakeProgress(record) {
  if (!record) return false

  const progressFields = [
    record.referral_form,
    record.permission_assessment,
    record.vineland,
    record.srs2,
    record.insurance_verified,
    record.insurance_verification_status,
    record.autism_diagnosis,
    record.intake_paperwork,
    record.intake_personnel,
    record.contact1,
    record.contact2,
    record.contact3,
  ]

  return progressFields.some(value => String(value || '').trim() !== '')
}

export function isReferralReadyForInterview(record) {
  if (!record) return false

  const normalizedAutismDx = normalizeAutismDx(record.autism_diagnosis, { emptyAsNotReceived: false })
  const normalizedReferralForm = normalizeReferralFieldValue('referral_form', record.referral_form)

  return [
    isReceivedOrCompleted(normalizedReferralForm),
    isReceivedOrCompleted(record.permission_assessment),
    isReceivedOrCompleted(record.vineland),
    isReceivedOrCompleted(record.srs2),
    isInsuranceVerified(getInsuranceVerificationStatus(record)),
    isReceivedOrCompleted(normalizedAutismDx),
    isReceivedOrCompleted(record.intake_paperwork),
  ].every(Boolean)
}

export function getReferralStage(record) {
  if (!record) return 'New Referral'

  const rawStage = String(record.current_stage || '').trim()

  if (record.status === 'referred-out') return 'Referred Out'
  if (record.active_client_date) return 'Active Client'
  if (record.ready_for_parent_interview === true || rawStage === 'Ready for Interview' || rawStage === 'Active Client' || isReferralReadyForInterview(record)) {
    return 'Ready for Interview'
  }
  if (rawStage && rawStage !== 'Active Client') return rawStage
  if (hasReferralIntakeProgress(record)) return 'Intake'
  return 'New Referral'
}

function referralIdentityValues(record) {
  return [record?.id, record?.referral_id]
    .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
    .map(value => String(value))
}

export function hasLinkedAssessment(record, assessments = []) {
  const referralIds = new Set(referralIdentityValues(record))
  if (!referralIds.size) return false

  return (assessments || []).some(assessment => {
    const linkedReferralId = assessment?.referral_id
    return linkedReferralId !== null
      && linkedReferralId !== undefined
      && referralIds.has(String(linkedReferralId))
  })
}

export function isReferralTransitioned(record, assessments = []) {
  return record?.ready_for_parent_interview === true || hasLinkedAssessment(record, assessments)
}

export function isActiveReferralWork(record, assessments = []) {
  return record?.status === 'active' && !isReferralTransitioned(record, assessments)
}

export function getReferralBoardStage(record, assessments = []) {
  return isReferralTransitioned(record, assessments) ? 'Moved to Initial Assessment' : getReferralStage(record)
}

// ── Office normalization ──
export function normalizeOffice(o) {
  if (o === 'JACKSON') return 'FLOWOOD'
  if (o === 'SCHOOL')  return 'DAY TREATMENT'
  if (o === 'NEWTON')  return 'FOREST'
  return o
}

export function normalizeStaffName(name) {
  const normalized = String(name || '').trim().toLowerCase().replace(/\s+/g, '')
  if (!normalized) return ''
  if (normalized === 'lashannon') return 'lashannon'
  if (normalized === 'aerianna' || normalized === 'ariana') return 'aerianna'
  if (normalized === 'keiara') return 'keiara'
  if (normalized === 'zanteria') return 'zanteria'
  if (normalized === 'celia') return 'celia'
  return normalized
}

export function displayStaffName(name) {
  const normalized = normalizeStaffName(name)
  if (normalized === 'zanteria') return 'Zanteria'
  if (normalized === 'aerianna') return 'Aerianna'
  if (normalized === 'lashannon') return 'LaShannon'
  if (normalized === 'keiara') return 'Keiara'
  if (normalized === 'celia') return 'Celia'
  return String(name || '').trim()
}

export function formatInsurance(name) {
  if (!name) return ''

  const map = {
    'medicaid of ms': 'Medicaid of MS',
    'uhc': 'UHC',
    'uhc comm': 'UHC Community',
    'uhc community': 'UHC Community',
    'magnolia': 'Magnolia',
    'molina': 'Molina',
    'bcbsms': 'BCBSMS',
    'aetna': 'Aetna',
    'tri care': 'Tricare',
    'tricare': 'Tricare',
    'cigna': 'Cigna',
    'trucare': 'TruCare',
  }

  const key = name.toLowerCase().trim()
  return map[key] || name
}

export function formatDisplayDate(value) {
  if (!value) return '--'

  const normalized = String(value).trim()
  if (!normalized) return '--'
  if (normalized.toLowerCase() === 'pending') return 'Pending'

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [, year, month, day] = match
    return `${month}/${day}/${year}`
  }

  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) {
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    const year = parsed.getFullYear()
    return `${month}/${day}/${year}`
  }

  return normalized
}

export function formatDate(value) {
  if (value === null || value === undefined) return '--'

  const normalized = String(value).trim()
  if (!normalized) return '--'
  if (normalized === 'Pending') return 'Pending'

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return '--'

  return parsed.toLocaleDateString('en-US')
}

export function normalizeAutismDx(value, { emptyAsNotReceived = true } = {}) {
  if (value === null || value === undefined) return emptyAsNotReceived ? 'Not Received' : ''

  const normalized = String(value).trim()
  if (!normalized) return emptyAsNotReceived ? 'Not Received' : ''

  const upper = normalized.toUpperCase()

  if (upper === 'COMPLETED' || upper === 'RECEIVED') return 'Received'
  if (upper === 'NOT RECEIVED' || upper === 'NO') return 'Not Received'
  if (upper === 'AWAITING' || upper === 'REQUESTED') return 'Requested'

  return normalized
}

export function normalizeTreatmentPlanStatus(status) {
  if (!status) return 'Not Started'

  const value = String(status).trim()
  const upper = value.toUpperCase()

  if (['DRAFTING', 'DRAFT COMPLETE', 'WRITTEN', 'IN REVIEW', 'IN PROGRESS', 'SCHEDULED'].includes(upper)) return 'In Progress'
  if (['DONE', 'YES', 'COMPLETED'].includes(upper)) return 'Completed'
  if (upper === 'FINALIZED') return 'Finalized'
  if (['AWAITING', 'AWAITING ASSIGNMENT', 'WAITING', 'TBD', 'NO', 'NO SHOW', 'NOT STARTED'].includes(upper)) return 'Not Started'

  return value
}

export function normalizeParentInterviewStatus(status) {
  if (!status) return 'Not Started'

  const value = String(status).trim()
  const upper = value.toUpperCase()

  if (upper === 'NO SHOW') return 'No Show'
  if (upper === 'AWAITING ASSIGNMENT') return 'Awaiting Assignment'
  if (['AWAITING', 'WAITING', 'TBD'].includes(upper)) return 'Awaiting Assignment'
  if (upper === 'SCHEDULED') return 'Scheduled'
  if (['IN PROGRESS', 'IN-PROGRESS', 'STARTED'].includes(upper)) return 'In Progress'
  if (['DONE', 'YES', 'COMPLETED', 'FINALIZED'].includes(upper)) return 'Completed'
  if (['NO', 'NOT STARTED'].includes(upper)) return 'Not Started'

  return value
}

export function normalizeAssessmentComponentStatus(status) {
  if (!status) return 'Not Started'

  const value = String(status).trim()
  const upper = value.toUpperCase()

  if (upper === 'SCHEDULED') return 'Scheduled'
  if (['IN PROGRESS', 'IN-PROGRESS', 'NOW SCHEDULED', 'REPORT IN PROGRESS', 'STARTED'].includes(upper)) return 'In Progress'
  if (['DONE', 'YES', 'COMPLETED', 'FINALIZED', 'RECEIVED', 'SIGNED'].includes(upper)) return 'Completed'
  if (['AWAITING', 'AWAITING ASSIGNMENT', 'WAITING', 'TBD', 'NO', 'NO SHOW', 'DECLINED', 'NOT STARTED'].includes(upper)) return 'Not Started'

  return value
}

function hasMeaningfulAssessmentValue(value) {
  if (value === null || value === undefined) return false
  const normalized = String(value).trim()
  if (!normalized) return false
  return normalized.toUpperCase() !== 'N/A'
}

function isCompletedAssessmentValue(value) {
  return normalizeAssessmentComponentStatus(value) === 'Completed'
}

export function getAssessmentWorkflowProgress(record) {
  const components = [
    { key: 'parent_interview_status', completed: normalizeParentInterviewStatus(record?.parent_interview_status) === 'Completed', started: !['Awaiting Assignment', 'Not Started'].includes(normalizeParentInterviewStatus(record?.parent_interview_status)) },
    { key: 'vineland', completed: isCompletedAssessmentValue(record?.vineland), started: normalizeAssessmentComponentStatus(record?.vineland) !== 'Not Started' },
    { key: 'srs2', completed: isCompletedAssessmentValue(record?.srs2), started: normalizeAssessmentComponentStatus(record?.srs2) !== 'Not Started' },
    { key: 'direct_obs', completed: isCompletedAssessmentValue(record?.direct_obs), started: normalizeAssessmentComponentStatus(record?.direct_obs) !== 'Not Started' },
  ]

  const total = components.length
  const completed = components.filter(component => component.completed).length
  const started = components.some(component => component.started)

  return {
    total,
    completed,
    percent: Math.round((completed / total) * 100),
    started,
  }
}

export function getAssessmentWorkflowStatus(record) {
  const { completed, total, started } = getAssessmentWorkflowProgress(record)
  if (completed >= total) return 'Completed'
  if (started || completed > 0) return 'In Progress'
  return 'Not Started'
}

export function getAssessmentRecordId(record) {
  return record?.assessment_id ?? record?.id ?? null
}

export function normalizeAuthorizationStatus(status) {
  const normalized = String(status || '').trim()
  if (normalized === 'Pending') return 'Pending Submission'
  if (normalized === 'In Review') return 'Submitted / In Review'
  if (normalized === 'Partial Approval') return 'Partially Approved'
  if (normalized === 'Partial Approved') return 'Partially Approved'
  return normalized
}

export function getAuthorizationStatus(record) {
  return normalizeAuthorizationStatus(record?.authorization_status || record?.pa_status || '')
}

export function isAssessmentActiveClient(record) {
  return getAuthorizationStatus(record) === 'Approved'
    && (record?.ready_for_services === true || record?.ready_for_services === 'true')
    && Boolean(record?.active_client_date)
}

export function isAssessmentClosedRecord(record) {
  return isAssessmentActiveClient(record)
}

export function getAssessmentLifecycleStatus(record) {
  const authorizationStatus = getAuthorizationStatus(record)

  if (authorizationStatus === 'Referred Out') return 'Referred Out'
  if (isAssessmentActiveClient(record)) return 'Active Client'
  if (record?.ready_for_services === true || record?.ready_for_services === 'true') return 'Ready for Services'
  return 'In Assessment'
}

export function isAuthorizationApproved(record) {
  const status = getAuthorizationStatus(record)
  return POSITIVE_AUTHORIZATION_STATUSES.includes(status)
}

export function normalizeInsuranceVerifiedStatus(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (['VERIFIED', 'CONFIRMED', 'YES'].includes(normalized)) return 'YES'
  if (['AWAITING', 'AWAITING RESPONSE', 'PENDING'].includes(normalized)) return 'AWAITING'
  if (['FOLLOW-UP NEEDED', 'FOLLOW UP NEEDED', 'NO'].includes(normalized)) return 'NO'
  if (['READY TO VERIFY', 'READY'].includes(normalized)) return ''
  return normalized
}

export function getInsuranceVerificationStatus(record = {}) {
  return normalizeInsuranceVerifiedStatus(
    record.insurance_verification_status || record.insurance_verified || ''
  )
}

export function getInsuranceVerificationLabel(record = {}) {
  const status = getInsuranceVerificationStatus(record)
  if (status === 'YES') return 'Confirmed'
  if (status === 'NO') return 'Follow-Up Needed'
  if (status === 'AWAITING') return 'Awaiting Response'
  return 'Ready to Verify'
}

export function normalizeReferralFieldValue(field, value) {
  const normalized = String(value || '').trim()
  if (!normalized) return normalized

  if (field === 'referral_form' && normalized === 'Completed') return 'Received'
  if (field === 'iep_report' && normalized === 'Completed') return 'Received'

  return normalized
}

export function formatPhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10)

  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function isInsuranceVerified(value) {
  return normalizeInsuranceVerifiedStatus(value) === 'YES'
}

export function needsInsuranceVerification(value) {
  return !isInsuranceVerified(value)
}

// ── Status color helper for assessments ──
export function statusColor(s) {
  if (['Finalized','Completed'].includes(s)) return '#22c55e'
  if (['In Progress','Scheduled'].includes(s)) return '#f59e0b'
  if (['Awaiting Assignment'].includes(s)) return '#64748b'
  if (['Not Started'].includes(s)) return '#ef4444'
  if (['No Show'].includes(s)) return '#ef4444'
  return '#64748b'
}

// ── Sort list ──
export function sortList(list, sortCol, sortDir) {
  if (!sortCol) return list
  return [...list].sort((a, b) => {
    if (sortCol === 'pct') {
      const av = pct(a), bv = pct(b)
      return sortDir === 'asc' ? av - bv : bv - av
    }
    const av = a[sortCol] || '', bv = b[sortCol] || ''
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })
}

// ── Export CSV ──
export function exportCSV(refs) {
  const active = refs.filter(r => r.status === 'active')
  const cols = ['first_name','last_name','dob','caregiver','caregiver_phone','caregiver_email','office','insurance','insurance_verified','autism_diagnosis','intake_paperwork','intake_personnel','referral_form','permission_assessment','vineland','srs2','attends_school','iep_report','contact1','contact2','contact3','date_received','notes','status']
  const csv = [
    cols.join(','),
    ...active.map(r => cols.map(c => '"' + (r[c] || '').replace(/"/g, '""') + '"').join(',')),
  ].join('\n')
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: 'bsom_referrals.csv',
  })
  a.click()
}
