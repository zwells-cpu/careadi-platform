import { useCallback, useEffect, useRef, useState } from 'react'

const IDLE_MS = 20 * 60 * 1000   // 20 minutes
const WARN_MS = 2 * 60 * 1000    // warn at 2 minutes remaining

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click']

export function useIdleTimeout({ onTimeout, enabled }) {
  const [isWarning, setIsWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(WARN_MS / 1000)

  const idleTimer = useRef(null)
  const warnTimer = useRef(null)
  const countdown = useRef(null)
  const isWarningRef = useRef(false)
  const onTimeoutRef = useRef(onTimeout)

  useEffect(() => { onTimeoutRef.current = onTimeout }, [onTimeout])

  const clearAll = () => {
    clearTimeout(idleTimer.current)
    clearTimeout(warnTimer.current)
    clearInterval(countdown.current)
  }

  const startTimers = useCallback(() => {
    clearAll()
    isWarningRef.current = false
    setIsWarning(false)

    warnTimer.current = setTimeout(() => {
      isWarningRef.current = true
      setIsWarning(true)
      setSecondsLeft(WARN_MS / 1000)

      countdown.current = setInterval(() => {
        setSecondsLeft(prev => Math.max(0, prev - 1))
      }, 1000)
    }, IDLE_MS - WARN_MS)

    idleTimer.current = setTimeout(() => {
      clearAll()
      isWarningRef.current = false
      setIsWarning(false)
      onTimeoutRef.current()
    }, IDLE_MS)
  }, [])

  // Called by "Stay Logged In" button
  const resetTimer = useCallback(() => {
    startTimers()
  }, [startTimers])

  useEffect(() => {
    if (!enabled) {
      clearAll()
      isWarningRef.current = false
      setIsWarning(false)
      return
    }

    startTimers()

    const handleActivity = () => {
      // Once warning is showing, only the explicit button resets the timer
      if (!isWarningRef.current) startTimers()
    }

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))

    return () => {
      clearAll()
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity))
    }
  }, [enabled, startTimers])

  return { isWarning, secondsLeft, resetTimer }
}
