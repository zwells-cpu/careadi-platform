import { useCallback, useEffect, useState } from 'react'
import { fetchRecentActivityLogs } from '../lib/activityLogs'

export function useActivityLogs(limit = 10, refreshKey = 0) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshLogs = useCallback(async () => {
    setLoading(true)
    try {
      const nextLogs = await fetchRecentActivityLogs(limit)
      setLogs(nextLogs)
    } catch (error) {
      console.error('Could not load recent activity logs:', error.message)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    refreshLogs()
  }, [refreshKey, refreshLogs])

  return { logs, loading, refreshLogs }
}
