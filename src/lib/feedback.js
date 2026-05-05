import { API_BASE } from './api'

export async function submitPortalFeedback(entry = {}) {
  const payload = {
    user_id: entry.user_id || null,
    user_email: entry.user_email || null,
    user_role: entry.user_role || null,
    feedback_type: entry.feedback_type || 'launch_week_support',
    felt_unclear: String(entry.felt_unclear || '').trim(),
    easier_tomorrow: String(entry.easier_tomorrow || '').trim(),
  }

  const res = await fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text }
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || 'Feedback could not be submitted.')
  }

  return data || { success: true }
}
