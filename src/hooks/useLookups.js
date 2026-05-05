import { useCallback, useEffect, useState } from 'react'
import { getBcbaStaff, getInsurancePayers, getOffices, getReferralSources } from '../lib/lookups'

export function useLookups() {
  const [loading, setLoading] = useState(false)
  const [lookups, setLookups] = useState({
    bcbaOptions: [],
    officeOptions: [],
    insuranceOptions: [],
    referralSourceOptions: [],
  })

  const loadLookups = useCallback(async () => {
    setLoading(true)
    const [bcbaOptions, officeOptions, insuranceOptions, referralSourceOptions] = await Promise.all([
      getBcbaStaff(),
      getOffices(),
      getInsurancePayers(),
      getReferralSources(),
    ])
    setLookups({ bcbaOptions, officeOptions, insuranceOptions, referralSourceOptions })
    setLoading(false)
  }, [])

  useEffect(() => {
    loadLookups()
  }, [loadLookups])

  return { loading, reloadLookups: loadLookups, ...lookups }
}
