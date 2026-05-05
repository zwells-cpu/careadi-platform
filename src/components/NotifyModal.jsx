import { useState } from 'react'
import { Mail, MessageSquare } from 'lucide-react'
import { API_BASE } from '../lib/api'

export function NotifyModal({ referral, onClose }) {
  const [status, setStatus] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [smsStatus, setSmsStatus] = useState(null)
  const [smsErrorMsg, setSmsErrorMsg] = useState('')

  const hasEmail = !!referral.caregiver_email
  const hasPhone = !!referral.caregiver_phone

  const handleQuickText = async () => {
    if (!hasPhone) return
    setSmsStatus('sending')
    setSmsErrorMsg('')
    try {
      const res = await fetch(`${API_BASE}/api/notify-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: referral.caregiver_phone }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Server error ${res.status}`)
      }
      setSmsStatus('success')
    } catch (err) {
      setSmsStatus('error')
      setSmsErrorMsg(err.message || 'Failed to send SMS.')
    }
  }

  const handleQuickEmail = async () => {
    if (!hasEmail) return
    setStatus('sending')
    setErrorMsg('')
    try {
      const res = await fetch(`${API_BASE}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: referral.caregiver_email, type: 'email' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Server error ${res.status}`)
      }
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message || 'Failed to send notification.')
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal notify-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head notify-modal-head">
          <div>
            <div className="modal-title">Send Notification</div>
            <div className="modal-sub">Choose how to contact this family.</div>
          </div>
          <button className="close-btn notify-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="notify-modal-body">
          <div className="notify-status-grid">
            {!hasEmail && (
              <div className="notify-status-card notify-status-card--warning">
                No caregiver email on file for this referral.
              </div>
            )}

            {!hasPhone && (
              <div className="notify-status-card notify-status-card--warning">
                No caregiver phone on file for this referral.
              </div>
            )}

            {status === 'success' && (
              <div className="notify-status-card notify-status-card--success">
                ✅ Email notification sent successfully.
              </div>
            )}

            {status === 'error' && (
              <div className="notify-status-card notify-status-card--error">
                ❌ {errorMsg}
              </div>
            )}

            {smsStatus === 'success' && (
              <div className="notify-status-card notify-status-card--success">
                ✅ SMS notification sent successfully.
              </div>
            )}

            {smsStatus === 'error' && (
              <div className="notify-status-card notify-status-card--error">
                ❌ {smsErrorMsg}
              </div>
            )}
          </div>

          <div className="notification-action-grid">
            <button
              type="button"
              className={`notification-action-card${!hasEmail || status === 'sending' || status === 'success' ? ' is-disabled' : ''}`}
              onClick={handleQuickEmail}
              disabled={!hasEmail || status === 'sending' || status === 'success'}
            >
              <div className="notification-action-icon"><Mail size={18} /></div>
              <div>
                <div className="notification-action-label">Quick Email</div>
                <div className="notification-action-helper">Send a quick email now</div>
              </div>
            </button>

            <button
              type="button"
              className="notification-action-card is-disabled"
              disabled
            >
              <div className="notification-action-icon"><MessageSquare size={18} /></div>
              <div>
                <div className="notification-action-label">Quick Text</div>
                <div className="notification-action-helper">Coming soon</div>
              </div>
            </button>
          </div>
        </div>

        <div className="modal-foot" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
