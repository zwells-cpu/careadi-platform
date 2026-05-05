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

function isBlank(value) {
  return normalizeText(value) === ''
}

function getReferralId(referral = {}) {
  return referral.id || null
}

function getAssessmentId(assessment = {}) {
  return assessment.assessment_id || assessment.id || null
}

function getClientName(referral = {}) {
  return `${referral.first_name || ''} ${referral.last_name || ''}`.trim()
    || referral.client_name
    || referral.name
    || ''
}

function buildMappedFields(referral = {}) {
  return {
    client_name: getClientName(referral),
    clinic: referral.office || referral.clinic || '',
    caregiver: referral.caregiver || '',
    caregiver_phone: referral.caregiver_phone || '',
    caregiver_email: referral.caregiver_email || '',
    insurance: referral.insurance || '',
    in_school: referral.attends_school || '',
    other_services: referral.other_services || '',
    notes: referral.notes || '',
  }
}

function buildMissingFieldPatch(assessment = {}, referral = {}) {
  const mapped = buildMappedFields(referral)
  const patch = {}

  Object.entries(mapped).forEach(([field, value]) => {
    if (isBlank(assessment[field]) && !isBlank(value)) {
      patch[field] = value
    }
  })

  return patch
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
  const referralById = new Map(
    (Array.isArray(referrals) ? referrals : [])
      .filter(referral => getReferralId(referral))
      .map(referral => [String(getReferralId(referral)), referral]),
  )

  const linkedBlankAssessments = (Array.isArray(assessments) ? assessments : [])
    .filter(assessment => !isBlank(assessment.referral_id))
    .filter(assessment => isBlank(assessment.client_name))

  const repairable = []
  let skippedNoReferral = 0
  let skippedNoPatch = 0

  linkedBlankAssessments.forEach((assessment) => {
    const referral = referralById.get(String(assessment.referral_id))
    if (!referral) {
      skippedNoReferral += 1
      return
    }

    const patch = buildMissingFieldPatch(assessment, referral)
    if (!Object.keys(patch).length) {
      skippedNoPatch += 1
      return
    }

    repairable.push({ assessment, patch })
  })

  console.log(`Mode: ${commit ? 'COMMIT' : 'DRY RUN'}`)
  console.log(`Assessments checked: ${Array.isArray(assessments) ? assessments.length : 0}`)
  console.log(`Linked blank promoted rows found: ${linkedBlankAssessments.length}`)
  console.log(`Skipped missing linked referral: ${skippedNoReferral}`)
  console.log(`Skipped no missing mapped fields to repair: ${skippedNoPatch}`)
  console.log(`Rows repairable: ${repairable.length}`)

  if (!commit) {
    console.log('No rows were updated. Re-run with --commit to patch missing mapped fields in place.')
    return
  }

  let repaired = 0
  for (const { assessment, patch } of repairable) {
    const assessmentId = getAssessmentId(assessment)
    if (!assessmentId) {
      skippedNoPatch += 1
      continue
    }

    await fetchJson(`${apiUrl}/assessments/${assessmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    repaired += 1
  }

  console.log(`Rows repaired: ${repaired}`)
}

main().catch((error) => {
  console.error(`Repair failed: ${error.message}`)
  process.exitCode = 1
})
