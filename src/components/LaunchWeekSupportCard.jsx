import { useEffect, useRef, useState } from 'react'
import { submitPortalFeedback } from '../lib/feedback'

const STATE_KEY = 'launchWeekSupportCard.state'
const SUBMITTED_KEY = 'launchWeekSupportCard.submitted'

function readSessionValue(key, fallback = null) {
  try {
    return window.sessionStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function writeSessionValue(key, value) {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // Session storage can be unavailable in private or restricted contexts.
  }
}

export function LaunchWeekSupportCard({ className = '', userContext = {} }) {
  const initialState = readSessionValue(STATE_KEY, 'collapsed')
  const [cardState, setCardState] = useState(initialState)
  const [submitted, setSubmitted] = useState(readSessionValue(SUBMITTED_KEY) === 'true')
  const [unclearFeedback, setUnclearFeedback] = useState('')
  const [tomorrowFeedback, setTomorrowFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const timerRef = useRef(null)

  const isExpanded = cardState === 'expanded'
  const isHidden = cardState === 'hidden'
  const hasFeedback = unclearFeedback.trim() || tomorrowFeedback.trim()

  useEffect(() => {
    writeSessionValue(STATE_KEY, cardState)
  }, [cardState])

  useEffect(() => {
    if (!submitted || cardState !== 'expanded') return

    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setSubmitted(false)
      writeSessionValue(SUBMITTED_KEY, 'false')
      setCardState('collapsed')
    }, 2000)
  }, [submitted, cardState])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  const expandCard = () => {
    setSubmitted(false)
    setSubmitError('')
    writeSessionValue(SUBMITTED_KEY, 'false')
    setCardState('expanded')
  }

  const collapseCard = () => {
    setSubmitted(false)
    setSubmitError('')
    writeSessionValue(SUBMITTED_KEY, 'false')
    setCardState('collapsed')
  }

  const hideCard = () => {
    setSubmitted(false)
    setSubmitError('')
    writeSessionValue(SUBMITTED_KEY, 'false')
    setCardState('hidden')
  }

  const submitFeedback = async (event) => {
    event.preventDefault()
    if (!hasFeedback || submitting) return

    setSubmitting(true)
    setSubmitError('')

    try {
      await submitPortalFeedback({
        user_id: userContext.user_id,
        user_email: userContext.user_email,
        user_role: userContext.user_role,
        feedback_type: 'launch_week_support',
        felt_unclear: unclearFeedback,
        easier_tomorrow: tomorrowFeedback,
      })

      writeSessionValue(SUBMITTED_KEY, 'true')
      setSubmitted(true)
      setUnclearFeedback('')
      setTomorrowFeedback('')
    } catch (error) {
      setSubmitError(error.message || 'Feedback could not be submitted. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isHidden) {
    return (
      <section className={`launch-support-card launch-support-card--minimized ${className}`.trim()} aria-label="Launch week support">
        <div className="launch-support-card__minimized-copy">
          <span className="launch-support-card__dot" aria-hidden="true" />
          <span>Live support minimized</span>
        </div>
        <button className="launch-support-card__show" type="button" onClick={collapseCard}>
          Show
        </button>
      </section>
    )
  }

  return (
    <section className={`launch-support-card ${isExpanded ? 'launch-support-card--expanded' : ''} ${className}`.trim()} aria-label="Launch week support">
      <div className="launch-support-card__label">
        <span className="launch-support-card__dot" aria-hidden="true" />
        <span>Live Support</span>
      </div>

      <div className="launch-support-card__title">Launch Week Support</div>

      {!isExpanded && (
        <div className="launch-support-card__collapsed">
          <p>The portal is live and actively being refined as the team uses it in workflow.</p>
          <p>Send quick feedback, flag issues, or suggest improvements.</p>
          <button className="launch-support-card__inline-action" type="button" onClick={expandCard}>
            Send Feedback →
          </button>
        </div>
      )}

      <div className={`launch-support-card__panel ${isExpanded ? 'launch-support-card__panel--open' : ''}`} aria-hidden={!isExpanded}>
        {isExpanded && (
          <div className="launch-support-card__panel-inner">
            {submitted ? (
              <div className="launch-support-card__confirmation" role="status">
                <div>Thanks — feedback received</div>
                <p>Your feedback helps improve the portal in real time.</p>
              </div>
            ) : (
              <form className="launch-support-card__form" onSubmit={submitFeedback}>
                <p className="launch-support-card__helper">
                  If something felt unclear, outdated, or off today, send quick feedback below.
                </p>

                <label className="launch-support-card__field">
                  <span>What felt unclear or off today?</span>
                  <textarea
                    value={unclearFeedback}
                    onChange={(event) => setUnclearFeedback(event.target.value)}
                    disabled={submitting}
                    rows={3}
                  />
                </label>

                <label className="launch-support-card__field">
                  <span>What would make this easier tomorrow?</span>
                  <textarea
                    value={tomorrowFeedback}
                    onChange={(event) => setTomorrowFeedback(event.target.value)}
                    disabled={submitting}
                    rows={3}
                  />
                </label>

                {submitError && (
                  <div className="launch-support-card__error" role="alert">
                    {submitError}
                  </div>
                )}

                <div className="launch-support-card__actions">
                  <button className="launch-support-card__submit" type="submit" disabled={!hasFeedback || submitting}>
                    {submitting ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                  <button className="launch-support-card__hide" type="button" onClick={hideCard} disabled={submitting}>
                    Hide
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
