import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export function SyncedHorizontalScrollTable({ children, className = '' }) {
  const topScrollRef = useRef(null)
  const tableScrollRef = useRef(null)
  const isSyncingRef = useRef(false)
  const [scrollWidth, setScrollWidth] = useState(0)

  const updateScrollWidth = useCallback(() => {
    const tableScroll = tableScrollRef.current
    if (!tableScroll) return

    setScrollWidth(tableScroll.scrollWidth)
  }, [])

  const syncScroll = useCallback((source, target) => {
    if (!source || !target || isSyncingRef.current) return

    isSyncingRef.current = true
    target.scrollLeft = source.scrollLeft
    window.requestAnimationFrame(() => {
      isSyncingRef.current = false
    })
  }, [])

  useLayoutEffect(() => {
    const tableScroll = tableScrollRef.current
    if (!tableScroll) return undefined

    updateScrollWidth()

    const observer = new ResizeObserver(updateScrollWidth)
    observer.observe(tableScroll)

    if (tableScroll.firstElementChild) {
      observer.observe(tableScroll.firstElementChild)
    }

    return () => observer.disconnect()
  }, [children, updateScrollWidth])

  return (
    <div className={`synced-scroll-table ${className}`.trim()}>
      <div
        ref={topScrollRef}
        className="synced-scroll-table-top"
        aria-hidden="true"
        onScroll={() => syncScroll(topScrollRef.current, tableScrollRef.current)}
      >
        <div className="synced-scroll-table-spacer" style={{ width: scrollWidth }} />
      </div>
      <div
        ref={tableScrollRef}
        className="table-wrap synced-scroll-table-main"
        onScroll={() => syncScroll(tableScrollRef.current, topScrollRef.current)}
      >
        {children}
      </div>
    </div>
  )
}
