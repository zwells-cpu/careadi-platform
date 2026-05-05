import { useState, useCallback } from 'react'
import { removeRecordById, replaceRecordById } from '../lib/recordStore'
import { normalizeAssessmentComponentStatus, normalizeAuthorizationStatus, normalizeParentInterviewStatus, normalizeTreatmentPlanStatus } from '../lib/utils'

const API_URL = import.meta.env.VITE_API_URL

const ASSESSMENT_DB_FIELDS = [
  'referral_id',
  'client_name',
  'clinic',
  'assigned_bcba',
  'caregiver',
  'caregiver_phone',
  'caregiver_email',
  'insurance',
  'vineland',
  'srs2',
  'vbmapp',
  'socially_savvy',
  'parent_interview_status',
  'parent_interview_scheduled_date',
  'parent_interview_completed_date',
  'assessment_status',
  'assessment_started_date',
  'assessment_completed_date',
  'direct_obs_status',
  'direct_obs_scheduled_date',
  'direct_obs_completed_date',
  'direct_obs',
  'treatment_plan_status',
  'treatment_plan_started_date',
  'treatment_plan_completed_date',
  'authorization_status',
  'authorization_submitted_date',
  'authorization_approved_date',
  'ready_for_services',
  'active_client_date',
  'in_school',
  'other_services',
  'notes',
]

function getAssessmentId(record) {
  return record?.assessment_id ?? record?.id ?? null
}

function normalizeBoolean(value) {
  if (value === true || value === false) return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return value
}

function normalizeAssessmentRecord(record, fallbackId = null) {
  if (!record) return null

  const assessmentId = getAssessmentId(record) ?? fallbackId
  const authorizationStatus = normalizeAuthorizationStatus(record.authorization_status ?? record.pa_status ?? '')
  const clinic = record.clinic ?? record.office ?? ''

  return {
    ...record,
    assessment_id: assessmentId,
    client_name: record.client_name || record.name || '',
    clinic,
    office: clinic,
    authorization_status: authorizationStatus,
    pa_status: authorizationStatus,
    vineland: normalizeAssessmentComponentStatus(record.vineland),
    srs2: normalizeAssessmentComponentStatus(record.srs2),
    vbmapp: normalizeAssessmentComponentStatus(record.vbmapp),
    socially_savvy: normalizeAssessmentComponentStatus(record.socially_savvy),
    parent_interview_status: normalizeParentInterviewStatus(record.parent_interview_status),
    assessment_status: normalizeAssessmentComponentStatus(record.assessment_status),
    direct_obs_status: normalizeAssessmentComponentStatus(record.direct_obs_status ?? record.direct_obs),
    direct_obs: normalizeAssessmentComponentStatus(record.direct_obs_status ?? record.direct_obs),
    direct_obs_scheduled_date: record.direct_obs_scheduled_date ?? null,
    direct_obs_completed_date: record.direct_obs_completed_date ?? null,
    treatment_plan_status: normalizeTreatmentPlanStatus(record.treatment_plan_status),
    ready_for_services: normalizeBoolean(record.ready_for_services) === true,
  }
}

function sortAssessments(records = []) {
  return (records || [])
    .slice()
    .sort((a, b) => (a.client_name || '').localeCompare(b.client_name || ''))
}

function buildAssessmentFromReferral(referral = {}) {
  const clientName = `${referral.first_name || ''} ${referral.last_name || ''}`.trim()

  return {
    referral_id: referral.id || referral.referral_id || null,
    client_name: clientName || referral.client_name || '',
    clinic: referral.office || referral.clinic || '',
    caregiver: referral.caregiver || '',
    caregiver_phone: referral.caregiver_phone || '',
    caregiver_email: referral.caregiver_email || '',
    insurance: referral.insurance || '',
    vineland: 'Not Started',
    srs2: 'Not Started',
    vbmapp: 'Not Started',
    socially_savvy: 'Not Started',
    parent_interview_status: 'Awaiting Assignment',
    assessment_status: 'Not Started',
    direct_obs_status: 'Not Started',
    direct_obs: 'Not Started',
    treatment_plan_status: 'Not Started',
    authorization_status: 'Not Submitted',
    ready_for_services: false,
    in_school: referral.attends_school || '',
    other_services: referral.other_services || '',
    notes: '',
  }
}

async function fetchFullReferral(referralId) {
  if (!referralId) return null

  const res = await fetch(`${API_URL}/referrals/${referralId}`)
  if (!res.ok) return null
  return res.json()
}

function hasReferralMappingFields(referral = {}) {
  return Boolean(
    referral.first_name
    || referral.last_name
    || referral.client_name
    || referral.office
    || referral.clinic
    || referral.insurance
    || referral.caregiver
    || referral.caregiver_phone
    || referral.caregiver_email
  )
}

function sanitizeAssessmentPatch(patch = {}) {
  const cleaned = {}
  ASSESSMENT_DB_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) return
    const value = patch[field]
    if (field === 'referral_id') {
      cleaned[field] = value || null
      return
    }
    if (field === 'ready_for_services') {
      cleaned[field] = normalizeBoolean(value) === true
      return
    }
    if (['vineland', 'srs2', 'vbmapp', 'socially_savvy', 'assessment_status', 'direct_obs_status', 'direct_obs'].includes(field)) {
      cleaned[field] = normalizeAssessmentComponentStatus(value)
      return
    }
    if (field === 'parent_interview_status') {
      cleaned[field] = normalizeParentInterviewStatus(value)
      return
    }
    if (field === 'treatment_plan_status') {
      cleaned[field] = normalizeTreatmentPlanStatus(value)
      return
    }
    if (field === 'authorization_status') {
      cleaned[field] = normalizeAuthorizationStatus(value)
      return
    }
    if (field.endsWith('_date')) {
      cleaned[field] = value || null
      return
    }
    cleaned[field] = value ?? ''
  })
  return cleaned
}

export function useAssessments() {
  const [assessData, setAssessData] = useState([])
  const [assessLoading, setAssessLoading] = useState(false)
  const [assessError, setAssessError] = useState(null)

  const loadAssessments = useCallback(async () => {
    setAssessLoading(true)
    try {
      setAssessError(null)
      const res = await fetch(`${API_URL}/assessments`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const sorted = sortAssessments(data)
      setAssessData(sorted.map(record => normalizeAssessmentRecord(record)))
    } catch (e) {
      setAssessError('Could not load assessments: ' + e.message)
    } finally {
      setAssessLoading(false)
    }
  }, [])

  const saveAssessEdit = useCallback(async (id, patch) => {
    try {
      setAssessError(null)
      const normalizedPatch = sanitizeAssessmentPatch(patch)

      const patchRes = await fetch(`${API_URL}/assessments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedPatch),
      })
      if (!patchRes.ok) throw new Error(await patchRes.text())
      const saved = await patchRes.json().catch(() => null)

      // Re-fetch the full list so client state exactly mirrors the server.
      const allRes = await fetch(`${API_URL}/assessments`)
      if (!allRes.ok) throw new Error(await allRes.text())
      const all = await allRes.json()
      const sorted = sortAssessments(all)
      setAssessData(sorted.map(record => normalizeAssessmentRecord(record)))

      const nextRecord = normalizeAssessmentRecord(saved ?? { assessment_id: id, ...normalizedPatch }, id)
      return { success: true, data: nextRecord }
    } catch (e) {
      setAssessError('Could not save assessment changes: ' + e.message)
      return { success: false }
    }
  }, [])

  const deleteAssessment = useCallback(async (id) => {
    try {
      setAssessError(null)
      const res = await fetch(`${API_URL}/assessments/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setAssessData(prev => removeRecordById(prev, id, getAssessmentId))
      return { success: true, id }
    } catch (e) {
      setAssessError('Could not delete assessment: ' + e.message)
      return { success: false }
    }
  }, [])

  const ensureAssessmentForReferral = useCallback(async (referral) => {
    try {
      setAssessError(null)
      const referralId = referral?.id || referral?.referral_id
      if (!referralId) throw new Error('Referral is missing an ID.')

      const fullReferral = hasReferralMappingFields(referral)
        ? referral
        : { ...referral, ...(await fetchFullReferral(referralId) || {}) }

      const allRes = await fetch(`${API_URL}/assessments`)
      if (!allRes.ok) throw new Error(await allRes.text())
      const all = await allRes.json()
      const existing = (all || []).find(record => String(record.referral_id || '') === String(referralId))

      if (existing) {
        const sorted = sortAssessments(all)
        setAssessData(sorted.map(record => normalizeAssessmentRecord(record)))
        return { success: true, data: normalizeAssessmentRecord(existing), created: false }
      }

      const payload = sanitizeAssessmentPatch(buildAssessmentFromReferral(fullReferral))
      const createRes = await fetch(`${API_URL}/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!createRes.ok) throw new Error(await createRes.text())

      const createdJson = await createRes.json().catch(() => null)
      const created = Array.isArray(createdJson) ? createdJson[0] : createdJson

      const refreshedRes = await fetch(`${API_URL}/assessments`)
      if (!refreshedRes.ok) throw new Error(await refreshedRes.text())
      const refreshed = await refreshedRes.json()
      const sorted = sortAssessments(refreshed)
      setAssessData(sorted.map(record => normalizeAssessmentRecord(record)))

      return { success: true, data: normalizeAssessmentRecord(created || payload), created: true }
    } catch (e) {
      setAssessError('Could not create assessment from referral: ' + e.message)
      return { success: false, error: e.message }
    }
  }, [])

  const createAssessment = useCallback(async (input) => {
    try {
      setAssessError(null)
      const payload = sanitizeAssessmentPatch({
        referral_id: null,
        vineland: 'Not Started',
        srs2: 'Not Started',
        vbmapp: 'Not Started',
        socially_savvy: 'Not Started',
        parent_interview_status: 'Awaiting Assignment',
        assessment_status: 'Not Started',
        direct_obs_status: 'Not Started',
        direct_obs: 'Not Started',
        treatment_plan_status: 'Not Started',
        authorization_status: 'Not Submitted',
        ready_for_services: false,
        ...input,
      })

      const createRes = await fetch(`${API_URL}/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!createRes.ok) throw new Error(await createRes.text())

      const createdJson = await createRes.json().catch(() => null)
      const created = Array.isArray(createdJson) ? createdJson[0] : createdJson

      const refreshedRes = await fetch(`${API_URL}/assessments`)
      if (!refreshedRes.ok) throw new Error(await refreshedRes.text())
      const refreshed = await refreshedRes.json()
      const sorted = sortAssessments(refreshed)
      setAssessData(sorted.map(record => normalizeAssessmentRecord(record)))

      return { success: true, data: normalizeAssessmentRecord(created || payload), created: true }
    } catch (e) {
      setAssessError('Could not create assessment: ' + e.message)
      return { success: false, error: e.message }
    }
  }, [])

  return { assessData, assessLoading, assessError, loadAssessments, saveAssessEdit, deleteAssessment, ensureAssessmentForReferral, createAssessment }
}
