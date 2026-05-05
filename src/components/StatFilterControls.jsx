export function ClickableStatCard({ value, label, color, sublabel, active = false, onClick, icon = null }) {
  const Component = onClick ? 'button' : 'div'
  const Icon = icon

  return (
    <Component
      type={onClick ? 'button' : undefined}
      className={`stat-box${onClick ? ' stat-box-clickable' : ''}${active ? ' active' : ''}`}
      onClick={onClick}
    >
      {Icon ? (
        <div className="stat-icon" style={{ color }}>
          <Icon size={16} strokeWidth={1.8} />
        </div>
      ) : null}
      <div className="stat-num" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sublabel ? <div className="stat-sub">{sublabel}</div> : null}
    </Component>
  )
}

export function ActiveFilterBanner({ filter, onClear, defaultText = 'Showing filtered results' }) {
  if (!filter) return null

  return (
    <div className="filter-banner">
      <div>
        <div className="filter-banner-label">Active Filter</div>
        <div className="filter-banner-text">{filter.label || defaultText}</div>
      </div>
      <button className="btn-sm" onClick={onClear}>Clear Filter</button>
    </div>
  )
}
