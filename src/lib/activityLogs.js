/**
 * Client-side audit log bridge.
 *
 * createActivityLog  — POST to the backend; the backend writes to PostgreSQL.
 *                      The client never inserts directly into the database.
 * fetchRecentActivityLogs — GET from the backend read-only endpoint.
 *
 * Both functions are intentionally non-throwing so callers can fire-and-forget
 * without try/catch. Errors are surfaced to the console only.
 */

import { API_BASE } from './api'

const DEFAULT_ACTIVITY_LOG_LAUNCH_DATE = '2026-04-28T00:00:00Z'

export const ACTIVITY_LOG_LAUNCH_DATE =
  import.meta.env.ACTIVITY_LOG_LAUNCH_DATE ||
  import.meta.env.VITE_ACTIVITY_LOG_LAUNCH_DATE ||
  DEFAULT_ACTIVITY_LOG_LAUNCH_DATE

const ACTIVITY_LOG_LAUNCH_TIME = Date.parse(ACTIVITY_LOG_LAUNCH_DATE)

function cleanActorName(value) {
  const text = String(value || '').trim()
  if (!text || text.toLowerCase() === 'unknown staff member') return ''
  return text
}

export function filterActivityLogsForLaunch(logs = []) {
  if (!Array.isArray(logs)) return []
  if (!Number.isFinite(ACTIVITY_LOG_LAUNCH_TIME)) return logs

  // This hides pre-launch QA/testing activity so the visible activity log starts at go-live.
  return logs.filter(log => {
    const createdAt = Date.parse(log?.created_at)
    return Number.isFinite(createdAt) && createdAt >= ACTIVITY_LOG_LAUNCH_TIME
  })
}

export const ACTIVITY_FIELD_LABELS = {
  client_name: 'Client name',
  clinic: 'Clinic',
  office: 'Clinic',
  assigned_bcba: 'Assigned BCBA',
  caregiver: 'Caregiver',
  caregiver_phone: 'Caregiver phone',
  caregiver_email: 'Caregiver email',
  insurance: 'Insurance',
  insurance_verified: 'Insurance verification',
  status: 'Status',
  intake_paperwork: 'Intake paperwork',
  current_stage: 'Current stage',
  intake_personnel: 'Intake personnel',
  assessment_status: 'Assessment status',
  vineland: 'Vineland',
  srs2: 'SRS-2',
  vbmapp: 'VBMAPP',
  socially_savvy: 'Socially Savvy',
  parent_interview_status: 'Parent interview',
  parent_interview_scheduled_date: 'Parent interview scheduled date',
  parent_interview_completed_date: 'Parent interview completed date',
  direct_obs_status: 'Direct observation',
  direct_obs_scheduled_date: 'Direct observation scheduled date',
  direct_obs_completed_date: 'Direct observation completed date',
  treatment_plan_status: 'Treatment plan',
  treatment_plan_started_date: 'Treatment plan started date',
  treatment_plan_completed_date: 'Treatment plan completed date',
  authorization_status: 'Authorization',
  authorization_submitted_date: 'Authorization submitted date',
  authorization_approved_date: 'Authorization approved date',
  ready_for_services: 'Ready for services',
  active_client_date: 'Active client date',
  lifecycle_status: 'Lifecycle status',
  workflow_status: 'Workflow status',
  notes: 'Notes',
  other_services: 'Other services',
}

const ACTION_LABELS = {
  referral_created: 'Referral Added',
  referral_updated: 'Referral Updated',
  referral_deleted: 'Referral Removed',
  referral_removed: 'Referral Removed',
  referral_status_changed: 'Status Changed',
  documents_updated: 'Documents Updated',
  document_uploaded: 'Document Uploaded',
  document_downloaded: 'Document Downloaded',
  contact_info_updated: 'Contact Info Updated',
  insurance_updated: 'Insurance Updated',
  insurance_verified: 'Insurance Verified',
  staff_assigned: 'Staff Assigned',
  office_transferred: 'Clinic Updated',
  notes_updated: 'Notes Updated',
  parent_interview_ready_enabled: 'Ready for Interview',
  parent_interview_ready_disabled: 'Interview Put On Hold',
  referral_promoted_to_initial_assessment: 'Moved to Assessment',
  assessment_created_from_referral: 'Moved to Assessment',
  assessment_manually_created: 'Assessment Added',
  client_profile_viewed: 'Profile Viewed',
  assessment_updated: 'Assessment Updated',
  assessment_deleted: 'Assessment Removed',
  authorization_status_updated: 'Authorization Updated',
  treatment_plan_updated: 'Treatment Plan Updated',
  parent_interview_updated: 'Parent Interview Updated',
  bcba_assigned: 'BCBA Assigned',
  ready_for_services_updated: 'Services Readiness Updated',
  moved_to_active_client: 'Moved to Active Client',
  intake_reopened: 'Intake Reopened',
  user_signed_in: 'User Signed In',
  user_signed_out: 'User Signed Out',
  session_timeout: 'Session Timeout',
}

const FIELD_CHIP_LABELS = {
  authorization_status: 'Authorization',
  authorization_submitted_date: 'Authorization',
  authorization_approved_date: 'Authorization',
  treatment_plan_status: 'Treatment Plan',
  treatment_plan_started_date: 'Treatment Plan',
  treatment_plan_completed_date: 'Treatment Plan',
  parent_interview_status: 'Parent Interview',
  parent_interview_scheduled_date: 'Parent Interview',
  parent_interview_completed_date: 'Parent Interview',
  direct_obs_status: 'Direct Observation',
  direct_obs_scheduled_date: 'Direct Observation',
  direct_obs_completed_date: 'Direct Observation',
  ready_for_services: 'Ready for Services',
  assigned_bcba: 'Assigned BCBA',
  office: 'Clinic',
  clinic: 'Clinic',
  caregiver: 'Caregiver',
  caregiver_phone: 'Caregiver',
  caregiver_email: 'Caregiver',
}

const TECHNICAL_DETAIL_PATTERNS = [
  /changed_fields/i,
  /\bbefore\b.*\bafter\b/i,
  /\b[a-z]+_[a-z0-9_]+\s*:/i,
  /\s->\s/,
  /\s=>\s/,
]

export function formatActivityActionLabel(action) {
  if (!action) return 'Activity'
  return ACTION_LABELS[action] || String(action).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatActivityFieldLabel(field) {
  const key = String(field || '').trim()
  if (!key) return ''
  return ACTIVITY_FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function hasTechnicalDescription(value) {
  const text = String(value || '')
  if (!text) return false
  if (text.length > 180) return true
  return TECHNICAL_DETAIL_PATTERNS.some(pattern => pattern.test(text))
}

function cleanValue(value) {
  if (value === true) return 'true'
  if (value === false) return 'false'
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

function quoteValue(value) {
  const text = cleanValue(value)
  return text ? `"${text}"` : ''
}

function getChangedFields(details) {
  return Array.isArray(details?.changed_fields)
    ? details.changed_fields.filter(Boolean).map(field => String(field))
    : []
}

function getAfterValue(details, field) {
  if (!details || typeof details !== 'object') return undefined
  if (details.after && typeof details.after === 'object' && Object.prototype.hasOwnProperty.call(details.after, field)) {
    return details.after[field]
  }
  if (Object.prototype.hasOwnProperty.call(details, field)) return details[field]
  return undefined
}

function getClientName(log) {
  return log?.entity_label || log?.client_name || null
}

function uniqueChips(fields) {
  return fields.reduce((chips, field) => {
    const label = FIELD_CHIP_LABELS[field] || formatActivityFieldLabel(field)
    if (label && !chips.includes(label)) chips.push(label)
    return chips
  }, [])
}

function buildSingleFieldSummary(field, value) {
  const quoted = quoteValue(value)

  if (field === 'authorization_status') {
    return quoted ? `Authorization status updated to ${quoted}.` : 'Authorization status updated.'
  }
  if (field === 'parent_interview_status') {
    return quoted ? `Parent interview marked ${cleanValue(value)}.` : 'Parent interview updated.'
  }
  if (field === 'treatment_plan_status') {
    return quoted ? `Treatment plan marked ${cleanValue(value)}.` : 'Treatment plan updated.'
  }
  if (field === 'assigned_bcba') return 'Assigned BCBA updated.'
  if (field === 'ready_for_services') {
    return value === true ? 'Client marked ready for services.' : 'Ready for services updated.'
  }
  if (field === 'office' || field === 'clinic') {
    return quoted ? `Clinic updated to ${quoted}.` : 'Clinic updated.'
  }
  if (field === 'insurance_verified') return 'Insurance verification updated.'

  const label = formatActivityFieldLabel(field)
  return quoted ? `${label} updated to ${quoted}.` : `${label} updated.`
}

function fallbackSummary(log) {
  const description = log?.description || log?.details_json?.description
  if (description && !hasTechnicalDescription(description)) return description

  const clientName = getClientName(log) || 'Client'
  switch (log?.action) {
    case 'document_uploaded': {
      const type = log?.details_json?.document_type
      return type ? `Document uploaded: ${type}.` : 'Document uploaded.'
    }
    case 'document_downloaded': {
      const fileName = log?.details_json?.file_name
      return fileName ? `Document downloaded: ${fileName}.` : 'Document downloaded.'
    }
    case 'referral_created':
      return `${clientName} was added to the intake pipeline.`
    case 'referral_deleted':
    case 'referral_removed':
      return `${clientName} referral was removed.`
    case 'client_profile_viewed':
      return `${clientName} client profile was viewed.`
    case 'assessment_deleted':
      return `${clientName} assessment was removed.`
    case 'referral_promoted_to_initial_assessment':
      return `${clientName} was moved to the Initial Assessment Board.`
    case 'assessment_created_from_referral':
      return `${clientName} moved from referral intake to initial assessment workflow.`
    case 'assessment_manually_created':
      return `${clientName} was manually added to the Initial Assessment Board.`
    case 'moved_to_active_client':
      return `${clientName} was moved to active client status and closed from intake.`
    case 'intake_reopened':
      return `${clientName} intake was reopened from active client status.`
    case 'user_signed_in':
      return 'User signed in.'
    case 'user_signed_out':
      return 'User signed out.'
    case 'session_timeout':
      return 'Session ended due to inactivity.'
    default:
      return `${formatActivityActionLabel(log?.action)} completed.`
  }
}

export function formatActivityLogDisplay(log = {}) {
  const details = log.details_json && typeof log.details_json === 'object' ? log.details_json : {}
  const changedFields = getChangedFields(details)
  const chips = uniqueChips(changedFields)
  const hiddenChipCount = Math.max(0, chips.length - 3)

  let summary = null
  if (changedFields.length === 1) {
    const field = changedFields[0]
    summary = buildSingleFieldSummary(field, getAfterValue(details, field))
  } else if (changedFields.length > 1) {
    summary = log.entity_type === 'assessment' || String(log.action || '').includes('assessment')
      ? 'Assessment details updated.'
      : 'Client details updated.'
  } else {
    summary = fallbackSummary(log)
  }

  return {
    actionLabel: formatActivityActionLabel(log.action),
    entityName: getClientName(log),
    summary,
    chips: chips.slice(0, 3),
    hiddenChipCount,
    office: details.office || details.clinic || log.office || null,
    entityType: log.entity_type || null,
  }
}

/**
 * Send an audit event to the backend.
 *
 * Accepted fields (all optional except `action`):
 *   user_id, user_email, user_role, user_name — actor context
 *   action                         — snake_case event name (required)
 *   entity_type                    — 'referral' | 'assessment' | null
 *   entity_id                      — UUID string
 *   entity_label                   — human-readable name (e.g. client full name)
 *   description                    — one-sentence human summary
 *   details_json                   — structured metadata object
 *
 * @param {object} entry
 * @returns {Promise<object|null>}
 */
export async function createActivityLog(entry = {}) {
  const action = String(entry.action || '').trim()
  if (!action) return null

  const preferredName =
    cleanActorName(entry.user_name) ||
    cleanActorName(entry.display_name) ||
    cleanActorName(entry.actor)
  const actorName =
    (preferredName && preferredName !== 'Signed-in user' ? preferredName : cleanActorName(entry.user_email)) ||
    preferredName ||
    'Signed-in user'

  const detailsJson = (
    entry.details_json && typeof entry.details_json === 'object'
      ? entry.details_json
      : entry.metadata && typeof entry.metadata === 'object'
        ? entry.metadata
        : {}
  )

  const payload = {
    user_id:      entry.user_id      || null,
    user_email:   entry.user_email   || null,
    user_role:    entry.user_role    || null,
    user_name:    actorName,
    action,
    entity_type:  entry.entity_type  || null,
    entity_id:    entry.entity_id    || null,
    entity_label: entry.entity_label || entry.client_name || null,
    description:  entry.description  || null,
    details_json: {
      actor_name: actorName,
      ...detailsJson,
    },
  }

  try {
    const postPayload = (body) => fetch(`${API_BASE}/api/audit-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    let res = await postPayload(payload)

    if (!res.ok && payload.user_name && (res.status === 400 || res.status === 422)) {
      const legacyPayload = { ...payload }
      delete legacyPayload.user_name
      res = await postPayload(legacyPayload)
    }

    if (!res.ok) {
      const text = await res.text()
      console.error('createActivityLog: backend rejected log entry', { status: res.status, body: text, action })
      return null
    }

    return await res.json()
  } catch (err) {
    console.error('createActivityLog: network error', err.message, { action })
    return null
  }
}

/**
 * Fetch recent audit logs from the backend (read-only).
 *
 * @param {number|null} limit  — max rows to return (null = server default 50)
 * @returns {Promise<object[]>}
 */
export async function fetchRecentActivityLogs(limit = 10) {
  try {
    const params = new URLSearchParams()
    if (typeof limit === 'number' && limit > 0) params.set('limit', String(limit))
    params.set('created_at_gte', ACTIVITY_LOG_LAUNCH_DATE)

    const res = await fetch(`${API_BASE}/api/audit-logs?${params}`)
    if (!res.ok) {
      params.delete('created_at_gte')
      const fallbackRes = await fetch(`${API_BASE}/api/audit-logs?${params}`)
      if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}`)

      const fallbackJson = await fallbackRes.json()
      return filterActivityLogsForLaunch(Array.isArray(fallbackJson.data) ? fallbackJson.data : [])
    }

    const json = await res.json()
    return filterActivityLogsForLaunch(Array.isArray(json.data) ? json.data : [])
  } catch (err) {
    console.error('fetchRecentActivityLogs: failed', err.message)
    return []
  }
}
