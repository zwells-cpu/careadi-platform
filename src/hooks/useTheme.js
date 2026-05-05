import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem('bsom-theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const setTheme = (t) => {
    localStorage.setItem('bsom-theme', t)
    setThemeState(t)
  }

  return { theme, setTheme }
}
