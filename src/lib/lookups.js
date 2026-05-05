import { API_BASE } from './api'

export function cleanLookupValue(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function normalizeLookupValue(value) {
  return cleanLookupValue(value).toLowerCase()
}

function getSortOrder(record) {
  const value = record?.sort_order
  return Number.isFinite(Number(value)) ? Number(value) : Number.MAX_SAFE_INTEGER
}

export function normalizeOptions(list, key = 'name') {
  if (!Array.isArray(list)) return []

  return list
    .map((item) => {
      if (typeof item === 'string') {
        const label = cleanLookupValue(item)
        return label ? { id: label, label, value: label, raw: item } : null
      }

      const label = cleanLookupValue(item?.[key])
      if (!label) return null

      return {
        id: item?.id ?? label,
        label,
        value: label,
        raw: item,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      const sortA = getSortOrder(a.raw)
      const sortB = getSortOrder(b.raw)
      if (sortA !== sortB) return sortA - sortB
      return a.label.localeCompare(b.label)
    })
}

export function optionValues(options) {
  return (options || []).map(option => cleanLookupValue(option?.value ?? option?.label ?? option)).filter(Boolean)
}

export function includeCurrentOption(options, currentValue) {
  const current = cleanLookupValue(currentValue)
  if (!current) return options
  return options.some(option => option.toLowerCase() === current.toLowerCase()) ? options : [current, ...options]
}

async function fetchLookup(path, key = 'name') {
  try {
    const res = await fetch(`${API_BASE}${path}`)
    if (!res.ok) return []
    const data = await res.json()
    return normalizeOptions(Array.isArray(data) ? data : [], key)
  } catch {
    return []
  }
}

async function apiJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options)
  const text = await res.text()
  let body = null

  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  if (!res.ok) {
    const message = body?.error || body?.message || text || `HTTP ${res.status}`
    throw new Error(message)
  }

  return body
}

export function getBcbaStaff() {
  return fetchLookup('/bcba-staff', 'full_name')
}

export async function getBcbaStaffRecords() {
  const data = await apiJson('/bcba-staff')
  return Array.isArray(data)
    ? data.slice().sort((a, b) => {
      const sortA = getSortOrder(a)
      const sortB = getSortOrder(b)
      if (sortA !== sortB) return sortA - sortB
      return cleanLookupValue(a.full_name).localeCompare(cleanLookupValue(b.full_name))
    })
    : []
}

export function createBcbaStaff(input) {
  const payload = {
    full_name: cleanLookupValue(input?.full_name),
    email: cleanLookupValue(input?.email) || null,
    office: cleanLookupValue(input?.office) || null,
  }

  if (!payload.full_name) throw new Error('BCBA name is required.')

  return apiJson('/bcba-staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateBcbaStaff(id, input) {
  const payload = {
    full_name: cleanLookupValue(input?.full_name),
    email: cleanLookupValue(input?.email) || null,
    office: cleanLookupValue(input?.office) || null,
  }

  if (!payload.full_name) throw new Error('BCBA name is required.')

  return apiJson(`/bcba-staff/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deactivateBcbaStaff(id) {
  return apiJson(`/bcba-staff/${id}`, { method: 'DELETE' })
}

export function getOffices() {
  return fetchLookup('/offices', 'name')
}

export function getInsurancePayers() {
  return fetchLookup('/insurance-payers', 'name')
}

export function getReferralSources() {
  return fetchLookup('/referral-sources', 'name')
}
