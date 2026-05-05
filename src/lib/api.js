export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function parseApiError(res, fallback = 'Request failed.') {
  const text = await res.text()
  try { return JSON.parse(text)?.error || text || fallback } catch { return text || fallback }
}
