export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            <div className="modal-sub">{message}</div>
          </div>
          <button className="close-btn" onClick={onCancel}>x</button>
        </div>

        <div className="modal-foot" style={{ borderTop: 'none', justifyContent: 'flex-end' }}>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={onCancel}>{cancelLabel}</button>
            <button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
