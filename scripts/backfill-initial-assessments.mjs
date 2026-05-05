import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env')
  try {
    const raw = readFileSync(envPath, 'utf8')
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eq = trimmed.indexOf('=')
      if (eq === -1) return
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (key && process.env[key] === undefined) process.env[key] = value
    })
  } catch {
    // .env is optional; VITE_API_URL can also be passed in the shell environment.
  }
}

function normalizeText(value) {
  return String(value || '').trim()
}

function isMovedToInitialAssessment(referral = {}) {
  if (referral.ready_for_parent_interview === true) return true

  return [
    referral.current_stage,
    referral.stage,
    referral.status,
    referral.lifecycle_status,
    referral.referral_status,
  ].some((value) => {
    const normalized = normalizeText(value).toLowerCase()
    return normalized === 'moved to initial assessment'
      || normalized === 'initial assessment'
  })
}

function getReferralId(referral = {}) {
  return referral.id || null
}

function getClientName(referral = {}) {
  const fullName = `${referral.first_name || ''} ${referral.last_name || ''}`.trim()
  return fullName || referral.client_name || referral.name || ''
}

function buildAssessmentFromReferral(referral = {}) {
  return {
    referral_id: getReferralId(referral),
    client_name: getClientName(referral),
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
    notes: referral.notes || '',
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  const text = await response.text()
  let body = null

  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  if (!response.ok) {
    const message = body?.error || body?.message || text || `HTTP ${response.status}`
    throw new Error(message)
  }

  return body
}

async function main() {
  loadEnvFile()

  const apiUrl = normalizeText(process.env.VITE_API_URL).replace(/\/+$/, '')
  const commit = process.argv.includes('--commit')

  if (!apiUrl) {
    throw new Error('VITE_API_URL is required. Add it to .env or pass it in the shell environment.')
  }

  const referrals = await fetchJson(`${apiUrl}/referrals`)
  const assessments = await fetchJson(`${apiUrl}/assessments`)

  const existingReferralIds = new Set(
    (Array.isArray(assessments) ? assessments : [])
      .map(record => record?.referral_id)
      .filter(value => value !== null && value !== undefined && normalizeText(value) !== '')
      .map(value => String(value)),
  )

  const candidates = (Array.isArray(referrals) ? referrals : [])
    .filter(isMovedToInitialAssessment)

  const missingId = candidates.filter(referral => !getReferralId(referral))
  const withIds = candidates.filter(referral => getReferralId(referral))
  const existing = withIds.filter(referral => existingReferralIds.has(String(getReferralId(referral))))
  const missing = withIds.filter(referral => !existingReferralIds.has(String(getReferralId(referral))))

  console.log(`Mode: ${commit ? 'COMMIT' : 'DRY RUN'}`)
  console.log(`Checked transitioned referrals: ${candidates.length}`)
  console.log(`Skipped without referral.id: ${missingId.length}`)
  console.log(`Skipped existing linked assessments: ${existing.length}`)
  console.log(`Missing linked assessments: ${missing.length}`)

  if (!commit) {
    console.log('No records were created. Re-run with --commit to insert missing assessment rows.')
    return
  }

  let created = 0
  let skippedMissingFields = 0
  for (const referral of missing) {
    const payload = buildAssessmentFromReferral(referral)
    if (!payload.referral_id || !payload.client_name) {
      skippedMissingFields += 1
      console.log(`Skipped referral ${payload.referral_id || '(missing id)'} because required assessment fields were missing.`)
      continue
    }

    await fetchJson(`${apiUrl}/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    existingReferralIds.add(String(payload.referral_id))
    created += 1
  }

  console.log(`Skipped missing required fields: ${skippedMissingFields}`)
  console.log(`Assessment records created: ${created}`)
}

main().catch((error) => {
  console.error(`Backfill failed: ${error.message}`)
  process.exitCode = 1
})
