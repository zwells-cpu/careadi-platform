import { useMemo, useState, useEffect } from 'react'
import {
  ClipboardCheck,
  Download,
  FileText,
  NotebookText,
  PhoneCall,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from 'lucide-react'
import { Badge, OfficePill, ProgressRing, StagePill } from './Badge'
import { ConfirmationModal } from './ConfirmationModal'
import { ACTIVE_REFERRAL_OFFICES, INSURANCE_PAYERS, REFERRAL_SOURCES, BOOL, STAFF, CHECKLIST_FIELDS } from '../lib/constants'
import { includeCurrentOption, normalizeOptions, optionValues } from '../lib/lookups'
import { formatDisplayDate, getInsuranceVerificationLabel, getReferralStage, pct, formatInsurance, normalizeAutismDx, normalizeReferralFieldValue } from '../lib/utils'
import { API_BASE } from '../lib/api'

const MAX_FILE_SIZE = 10 * 1024 * 1024

const DOCUMENT_TYPE_OPTIONS = ['Referral Form', 'Insurance Card', 'Diagnosis Report', 'Assessment Report', 'IEP/School Records', 'Consent Form', 'Other']
const INSURANCE_VERIFICATION_STATUS_OPTIONS = ['', 'YES', 'NO', 'AWAITING']
const ACTIVE_REFERRAL_OFFICE_SET = new Set(ACTIVE_REFERRAL_OFFICES.map(office => office.toUpperCase()))

function activeReferralOfficeOptions(options) {
  return optionValues(options).filter(office => ACTIVE_REFERRAL_OFFICE_SET.has(office.toUpperCase()))
}

function formatInsuranceVerificationOption(value) {
  if (value === 'YES') return 'Confirmed'
  if (value === 'NO') return 'Follow-Up Needed'
  if (value === 'AWAITING') return 'Awaiting Response'
  return 'Ready to Verify'
}

function formatFileSize(size) {
  if (!size) return '--'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function verificationTone(value) {
  if (value === 'YES' || value === 'Confirmed') return 'confirmed'
  if (value === 'NO' || value === 'Follow-Up Needed') return 'needs-follow-up'
  if (value === 'AWAITING' || value === 'Awaiting Response') return 'awaiting'
  return 'ready'
}

function SectionCard({ icon: Icon, title, children, className = '' }) {
  return (
    <section className={`client-record-section ${className}`}>
      <div className="client-record-section-head">
        <span className="client-record-section-icon"><Icon size={17} strokeWidth={2.2} /></span>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function DetailField({ label, value, children, className = '' }) {
  return (
    <div className={`client-record-field ${className}`}>
      <div className="label">{label}</div>
      {children || <div className="client-record-value">{value || '--'}</div>}
    </div>
  )
}

function MetadataChip({ label, children }) {
  return (
    <span className="client-record-chip">
      <span>{label}</span>
      <strong>{children || '--'}</strong>
    </span>
  )
}

function getEditableReferralPatch(record = {}) {
  const patch = { ...record }
  patch.autism_diagnosis = normalizeAutismDx(record.autism_diagnosis)
  patch.referral_form = normalizeReferralFieldValue('referral_form', record.referral_form)
  patch.iep_report = normalizeReferralFieldValue('iep_report', record.iep_report)
  delete patch.id
  delete patch.created_at
  delete patch.user_id
  return patch
}

export function ReferralModal({ referral, onClose, onSave, onDelete, onSetStatus, onToggleParentInterview, onUploadDocument, onDeleteDocument, onDownloadDocument, officeOptions: liveOfficeOptions = [], insuranceOptions: liveInsuranceOptions = [], referralSourceOptions: liveReferralSourceOptions = [] }) {
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({
    ...referral,
    autism_diagnosis: normalizeAutismDx(referral.autism_diagnosis),
    referral_form: normalizeReferralFieldValue('referral_form', referral.referral_form),
    iep_report: normalizeReferralFieldValue('iep_report', referral.iep_report),
  })
  const [saving, setSaving] = useState(false)
  const [docType, setDocType] = useState('Referral Form')
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsKey, setDocsKey] = useState(0)
  const [docDeleteTarget, setDocDeleteTarget] = useState(null)
  const [deletingDocId, setDeletingDocId] = useState(null)
  const [docDeleteError, setDocDeleteError] = useState(null)
  const [docDownloadError, setDocDownloadError] = useState(null)
  const [downloadingDocId, setDownloadingDocId] = useState(null)

  useEffect(() => {
    if (!referral?.id) return
    let cancelled = false
    setDocsLoading(true)
    fetch(`${API_BASE}/referrals/${referral.id}/documents`)
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (!cancelled) setDocs(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setDocs([]) })
      .finally(() => { if (!cancelled) setDocsLoading(false) })
    return () => { cancelled = true }
  }, [referral?.id, docsKey])

  const r = referral
  const e = editMode ? form : referral
  const intakeStage = getReferralStage(e)
  const officeOptions = includeCurrentOption(activeReferralOfficeOptions(liveOfficeOptions.length ? liveOfficeOptions : normalizeOptions(ACTIVE_REFERRAL_OFFICES)), e.office)
  const insuranceOptions = includeCurrentOption(optionValues(liveInsuranceOptions.length ? liveInsuranceOptions : normalizeOptions(INSURANCE_PAYERS)), e.insurance)
  const secondaryInsuranceOptions = includeCurrentOption(['None', ...insuranceOptions], e.secondary_insurance)
  const referralSourceOptions = includeCurrentOption(optionValues(liveReferralSourceOptions.length ? liveReferralSourceOptions : normalizeOptions(REFERRAL_SOURCES)), e.referral_source)
  const originalPatch = useMemo(() => getEditableReferralPatch(referral), [referral])
  const currentPatch = useMemo(() => getEditableReferralPatch(form), [form])
  const hasUnsavedChanges = editMode && JSON.stringify(currentPatch) !== JSON.stringify(originalPatch)
  const verificationStatusValue = editMode
    ? (e.insurance_verification_status ?? e.insurance_verified ?? '')
    : getInsuranceVerificationLabel(r)
  const verificationStatusLabel = editMode
    ? formatInsuranceVerificationOption(verificationStatusValue)
    : getInsuranceVerificationLabel(r)
  const verificationStatusTone = verificationTone(verificationStatusValue)

  const field = (key) => (val) => setForm(f => ({ ...f, [key]: val }))

  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const handleSave = async () => {
    setSaving(true)
    const patch = getEditableReferralPatch(form)
    const res = await onSave(r.id, patch)
    if (res?.success) setEditMode(false)
    setSaving(false)
  }

  const performDelete = async () => {
    setSaving(true)
    const res = await onDelete(r.id)
    if (res?.success) {
      setEditMode(false)
      onClose()
    }
    setSaving(false)
  }

  const handleDeleteRequest = () => {
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteConfirmOpen(false)
    await performDelete()
  }

  const handleCancelEdit = () => {
    setEditMode(false)
    setSelectedFile(null)
    setUploadError(null)
    setUploadSuccess(null)
    setDocType('Referral Form')
  }

  const handleDocumentUpload = async () => {
    if (!selectedFile || !onUploadDocument) return

    if (selectedFile.size > MAX_FILE_SIZE) {
      setUploadError('File must be under 10 MB.')
      return
    }

    setUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    const res = await onUploadDocument({
      referral: r,
      documentType: docType,
      file: selectedFile,
    })

    if (res?.success) {
      setUploadSuccess(`Uploaded ${selectedFile.name}`)
      setSelectedFile(null)
      setDocType('Referral Form')
      setDocsKey(k => k + 1)
    } else {
      setUploadError(res?.error || 'Could not upload document.')
    }

    setUploading(false)
  }

  const handleDocumentDelete = async () => {
    const doc = docDeleteTarget
    setDocDeleteTarget(null)
    if (!doc || !onDeleteDocument) return
    setDeletingDocId(doc.id)
    setDocDeleteError(null)
    const res = await onDeleteDocument({ referral: r, doc })
    if (res?.success) {
      setDocsKey(k => k + 1)
    } else {
      setDocDeleteError(res?.error || 'Could not delete document. Please try again.')
    }
    setDeletingDocId(null)
  }

  const handleDocumentDownload = async (doc) => {
    const signedUrl = doc?.signed_url
    const fileName = doc?.file_name || doc?.filename || doc?.original_filename || 'document'

    if (!signedUrl) {
      setDocDownloadError('Download link is unavailable. Please try again in a moment.')
      return
    }

    setDownloadingDocId(doc.id)
    setDocDownloadError(null)

    let objectUrl = null
    try {
      const res = await fetch(signedUrl)
      if (!res.ok) throw new Error('Download failed.')

      const blob = await res.blob()
      objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()

      if (onDownloadDocument) {
        await onDownloadDocument({ referral: r, doc: { ...doc, file_name: fileName } })
      }
    } catch {
      setDocDownloadError('Could not download this document. Please try again.')
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setDownloadingDocId(null)
    }
  }

  const isNR = r.status === 'non-responsive' || r.status === 'referred-out'

  const handleStatusChange = async (status) => {
    if (!onSetStatus) return
    setSaving(true)
    await onSetStatus(r.id, status)
    setSaving(false)
  }

  const FootLeft = () => {
    if (isNR) {
      return (
        <button onClick={() => handleStatusChange('active')}
          disabled={saving}
          className="client-record-action client-record-action-success">
          Restore Active
        </button>
      )
    }
    return (
      <div className="client-record-foot-left">
        <button className="btn-ghost" onClick={() => handleStatusChange('non-responsive')}
          disabled={saving}>
          Non-Responsive
        </button>
        <button className="btn-ghost" onClick={() => handleStatusChange('referred-out')}
          disabled={saving}>
          Referred Out
        </button>
        <button onClick={() => onToggleParentInterview(r.id, !r.ready_for_parent_interview)}
          className={`client-record-action ${r.ready_for_parent_interview ? 'client-record-action-success' : ''}`}>
          {r.ready_for_parent_interview ? 'Ready for Interview' : 'Mark Ready for Interview'}
        </button>
      </div>
    )
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal client-record-modal" onClick={ev => ev.stopPropagation()}>
        <div className="modal-head client-record-head">
          <div className="client-record-identity">
            <div className="client-record-kicker">Referral Client Record</div>
            <div className="modal-title client-record-title">{r.first_name} {r.last_name}</div>
            <div className="client-record-meta">
              <MetadataChip label="DOB">{formatDisplayDate(r.dob)}</MetadataChip>
              <MetadataChip label="Date Received">{formatDisplayDate(r.date_received)}</MetadataChip>
              <MetadataChip label="Office"><OfficePill office={r.office} /></MetadataChip>
              <MetadataChip label="Stage"><StagePill stage={intakeStage} /></MetadataChip>
            </div>
          </div>
          <div className="modal-actions client-record-head-actions">
            <div className="client-record-progress-stack" aria-label={`Referral completion ${pct(r)} percent`}>
              <div className="client-record-progress">
                <ProgressRing value={pct(r)} />
              </div>
              <span>Complete</span>
            </div>
            <button className={`btn-edit ${editMode ? 'editing' : ''}`}
              onClick={() => { if (!editMode) { setForm({
                ...r,
                autism_diagnosis: normalizeAutismDx(r.autism_diagnosis),
                referral_form: normalizeReferralFieldValue('referral_form', r.referral_form),
                iep_report: normalizeReferralFieldValue('iep_report', r.iep_report),
              }); setEditMode(true) } else handleCancelEdit() }}>
              {editMode ? 'Editing' : 'Edit Record'}
            </button>
            <button className="close-btn" onClick={onClose} aria-label="Close referral record">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body client-record-body">
          <SectionCard icon={UserRound} title="Caregiver Information">
            {editMode ? (
              <div className="client-record-form-grid">
                {[['caregiver', 'Full Name', 'Full Name'], ['caregiver_phone', 'Phone', '601-000-0000'], ['caregiver_email', 'Email', 'email@example.com']].map(([k, label, ph]) => (
                  <DetailField key={k} label={label}>
                    <input className="edit-input" value={e[k] || ''} onChange={ev => field(k)(ev.target.value)} placeholder={ph} />
                  </DetailField>
                ))}
              </div>
            ) : (
              <div className="client-record-form-grid">
                {['Name', 'Phone', 'Email'].map((label, index) => (
                  <DetailField key={label} label={label} value={[r.caregiver, r.caregiver_phone, r.caregiver_email][index]} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard icon={ShieldCheck} title="Insurance Details" className="client-record-section-wide client-record-insurance">
            <div className="client-record-verification-banner">
              <div>
                <span className="client-record-banner-label">Verification Status</span>
                <strong>{verificationStatusLabel}</strong>
              </div>
              <span className={`verification-pill verification-pill-${verificationStatusTone}`}>
                {verificationStatusLabel}
              </span>
            </div>
            {editMode ? (
              <div className="client-record-insurance-grid">
                <DetailField label="Member ID">
                  <input className="edit-input" value={e.insurance_member_id || ''} onChange={ev => field('insurance_member_id')(ev.target.value)} />
                </DetailField>
                <DetailField label="Client Address">
                  <textarea className="edit-input" rows={3} value={e.client_address || ''} onChange={ev => field('client_address')(ev.target.value)} />
                </DetailField>
                <DetailField label="Primary Insurance">
                  <select className="edit-select" value={e.insurance || ''} onChange={ev => field('insurance')(ev.target.value)}>
                    {insuranceOptions.map(i => <option key={i}>{i}</option>)}
                  </select>
                </DetailField>
                <DetailField label="Secondary Insurance">
                  <select className="edit-select" value={e.secondary_insurance || ''} onChange={ev => field('secondary_insurance')(ev.target.value)}>
                    {secondaryInsuranceOptions.map(i => <option key={i}>{i}</option>)}
                  </select>
                </DetailField>
                <DetailField label="Insurance Verification Status">
                  <select className="edit-select" value={e.insurance_verification_status ?? e.insurance_verified ?? ''} onChange={ev => field('insurance_verification_status')(ev.target.value)}>
                    {INSURANCE_VERIFICATION_STATUS_OPTIONS.map(status => <option key={status || 'ready'} value={status}>{formatInsuranceVerificationOption(status)}</option>)}
                  </select>
                  <span className={`verification-pill verification-pill-${verificationStatusTone}`}>
                    {formatInsuranceVerificationOption(e.insurance_verification_status ?? e.insurance_verified ?? '')}
                  </span>
                </DetailField>
                <DetailField label="Last Verified Date">
                  <input className="edit-input" type="date" value={e.insurance_last_verified_date || ''} onChange={ev => field('insurance_last_verified_date')(ev.target.value)} />
                </DetailField>
                <DetailField label="Verification Notes" className="client-record-field-span">
                  <textarea className="edit-input" rows={4} value={e.insurance_verification_notes || ''} onChange={ev => field('insurance_verification_notes')(ev.target.value)} />
                </DetailField>
              </div>
            ) : (
              <div className="client-record-insurance-grid">
                <DetailField label="Member ID" value={r.insurance_member_id} />
                <DetailField label="Client Address" value={r.client_address} />
                <DetailField label="Primary Insurance" value={formatInsurance(r.insurance)} />
                <DetailField label="Secondary Insurance" value={formatInsurance(r.secondary_insurance)} />
                <DetailField label="Insurance Verification Status">
                  <span className={`verification-pill verification-pill-${verificationStatusTone}`}>
                    {verificationStatusLabel}
                  </span>
                </DetailField>
                <DetailField label="Last Verified Date" value={formatDisplayDate(r.insurance_last_verified_date)} />
                <DetailField label="Verification Notes" value={r.insurance_verification_notes} className="client-record-field-span" />
              </div>
            )}
          </SectionCard>

          <SectionCard icon={PhoneCall} title="Contact Log">
            {['contact1', 'contact2', 'contact3'].map((k, i) => (
              <div className="client-record-list-row" key={k}>
                <span className="info-label">{i + 1}{['st', 'nd', 'rd'][i]} Contact</span>
                {editMode
                  ? <input className="edit-input client-record-compact-control" type="date" value={e[k] || ''} onChange={ev => field(k)(ev.target.value)} />
                  : <span className={r[k] ? 'contact-val' : 'info-val'}>{r[k] ? formatDisplayDate(r[k]) : '--'}</span>}
              </div>
            ))}
          </SectionCard>

          <SectionCard icon={ClipboardCheck} title="Intake Checklist">
            <div className="client-record-checklist">
              <div className="client-record-list-row client-record-stage-row">
                <span className="info-label">Current Intake Stage</span>
                <StagePill stage={intakeStage} />
              </div>
              {CHECKLIST_FIELDS.map(([label, key, opts]) => (
                <div className="client-record-check-row" key={key}>
                  <span className="info-label">{label}</span>
                  {editMode
                    ? <select className="edit-select" value={e[key] || ''} onChange={ev => field(key)(ev.target.value)}>
                      {opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                    : <Badge value={key === 'autism_diagnosis' ? normalizeAutismDx(r[key]) : normalizeReferralFieldValue(key, r[key])} />}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard icon={NotebookText} title="Referral Details / Notes" className="client-record-section-wide">
            <div className="client-record-form-grid client-record-form-grid-three">
              <DetailField label="Date Received">
                {editMode
                  ? <input className="edit-input" type="date" value={e.date_received || ''} onChange={ev => field('date_received')(ev.target.value)} />
                  : <div className="client-record-value">{formatDisplayDate(r.date_received)}</div>}
              </DetailField>
              <DetailField label="Office">
                {editMode
                  ? <select className="edit-select" value={e.office || ''} onChange={ev => field('office')(ev.target.value)}>
                      {officeOptions.map(o => <option key={o}>{o}</option>)}
                    </select>
                  : <OfficePill office={r.office} />}
              </DetailField>
              <DetailField label="Intake Personnel">
                {editMode
                  ? <select className="edit-select" value={e.intake_personnel || ''} onChange={ev => field('intake_personnel')(ev.target.value)}>
                      {STAFF.map(s => <option key={s}>{s}</option>)}
                    </select>
                  : <div className="client-record-value">{r.intake_personnel || '--'}</div>}
              </DetailField>
              <DetailField label="Referral Source">
                {editMode
                  ? <select className="edit-select" value={e.referral_source || ''} onChange={ev => field('referral_source')(ev.target.value)}>
                    <option value="">-- Select --</option>
                    {referralSourceOptions.map(option => <option key={option}>{option}</option>)}
                  </select>
                  : <div className="client-record-value">{r.referral_source || '--'}</div>}
              </DetailField>
              <DetailField label="Referral Source Phone">
                {editMode
                  ? <input className="edit-input" value={e.referral_source_phone || ''} onChange={ev => field('referral_source_phone')(ev.target.value)} />
                  : <div className="client-record-value">{r.referral_source_phone || '--'}</div>}
              </DetailField>
              <DetailField label="Referral Source Fax">
                {editMode
                  ? <input className="edit-input" value={e.referral_source_fax || ''} onChange={ev => field('referral_source_fax')(ev.target.value)} />
                  : <div className="client-record-value">{r.referral_source_fax || '--'}</div>}
              </DetailField>
              <DetailField label="Provider NPI">
                {editMode
                  ? <input className="edit-input" value={e.provider_npi || ''} onChange={ev => field('provider_npi')(ev.target.value)} />
                  : <div className="client-record-value">{r.provider_npi || '--'}</div>}
              </DetailField>
              <DetailField label="Point of Contact">
                {editMode
                  ? <input className="edit-input" value={e.point_of_contact || ''} onChange={ev => field('point_of_contact')(ev.target.value)} />
                  : <div className="client-record-value">{r.point_of_contact || '--'}</div>}
              </DetailField>
              <DetailField label="Reason for Referral" className="client-record-field-span">
                {editMode
                  ? <textarea className="edit-input" rows={3} value={e.reason_for_referral || ''} onChange={ev => field('reason_for_referral')(ev.target.value)} />
                  : <div className="client-record-value">{r.reason_for_referral || '--'}</div>}
              </DetailField>
            </div>
            <DetailField label="Notes" className="client-record-notes-field">
              {editMode
                ? <textarea className="edit-input client-record-notes" rows={7} value={e.notes || ''} onChange={ev => field('notes')(ev.target.value)} />
                : <div className="client-record-notes-read">{r.notes || '--'}</div>}
            </DetailField>
          </SectionCard>

          <SectionCard icon={FileText} title="Client Documents" className="client-record-section-wide">
            <div className="client-doc-card">
              {editMode && (
                <div className="client-doc-upload">
                  <div className="client-doc-upload-head">
                    <span>Upload Document</span>
                    <small>Attach referral files to this client record.</small>
                  </div>
                  <DetailField label="Document Type">
                    <select className="edit-select" value={docType} onChange={ev => setDocType(ev.target.value)}>
                      {DOCUMENT_TYPE_OPTIONS.map(option => <option key={option}>{option}</option>)}
                    </select>
                  </DetailField>

                  <DetailField label="File">
                    <div className="client-doc-file-input">
                      <UploadCloud size={20} />
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={ev => {
                          const nextFile = ev.target.files?.[0] || null
                          setSelectedFile(nextFile)
                          setUploadError(null)
                          setUploadSuccess(null)
                        }}
                      />
                    </div>
                    <div className="client-doc-helper">
                      PDF and image files only. Max 10 MB.
                    </div>
                  </DetailField>

                  {selectedFile && (
                    <div className="client-doc-selected">
                      {selectedFile.name} | {formatFileSize(selectedFile.size)}
                    </div>
                  )}

                  {uploadError && (
                    <div className="error-bar client-doc-feedback">
                      {uploadError}
                    </div>
                  )}

                  {uploadSuccess && (
                    <div className="client-doc-success">
                      {uploadSuccess}
                    </div>
                  )}

                  <button className="btn-save" onClick={handleDocumentUpload} disabled={!selectedFile || uploading}>
                    {uploading ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
              )}

              {docDeleteError && (
                <div className="error-bar client-doc-feedback">{docDeleteError}</div>
              )}

              {docDownloadError && (
                <div className="error-bar client-doc-feedback">{docDownloadError}</div>
              )}

              {docsLoading && (
                <div className="client-doc-empty">Loading documents...</div>
              )}

              {!docsLoading && docs.length > 0 && (
                <div className="client-doc-list">
                  {docs.map(doc => {
                    const viewUrl = doc.signed_url || doc.view_url
                    return (
                      <div key={doc.id} className="client-doc-tile">
                        <div className="client-doc-tile-head">
                          <span className="client-doc-file-icon">
                            <FileText size={15} strokeWidth={2.2} />
                          </span>
                          <div className="client-doc-name">{doc.file_name || doc.original_filename}</div>
                        </div>
                        <div className="client-doc-type">{doc.document_type || 'Document'}</div>
                        <div className="client-doc-meta">
                          <span>{formatFileSize(doc.file_size)}</span>
                          {doc.uploaded_by_name && <span>{doc.uploaded_by_name}</span>}
                        </div>
                        <div className="client-doc-actions">
                          <div className="client-doc-primary-actions">
                            {viewUrl && (
                              <a
                                href={viewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-sm client-doc-view-btn"
                              >
                                View
                              </a>
                            )}
                            <button
                              type="button"
                              className="btn-sm client-doc-download-btn"
                              onClick={() => handleDocumentDownload(doc)}
                              disabled={downloadingDocId === doc.id}
                              aria-label="Download document"
                            >
                              <Download size={12} />
                              {downloadingDocId === doc.id ? 'Saving' : 'Download'}
                            </button>
                          </div>
                          <button
                            className="client-doc-delete-btn"
                            onClick={() => setDocDeleteTarget(doc)}
                            disabled={deletingDocId === doc.id}
                            aria-label="Delete document"
                          >
                            {deletingDocId === doc.id ? '...' : <Trash2 size={13} />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {!docsLoading && docs.length === 0 && (
                <div className="client-doc-empty">
                  {editMode ? 'No documents yet. Use the uploader above to attach files.' : 'No documents attached.'}
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="modal-foot client-record-foot">
          <FootLeft />
          <div className="modal-actions client-record-foot-actions">
            {editMode ? (
              <>
                <button className="btn-danger" onClick={handleDeleteRequest} disabled={saving}>
                  Delete
                </button>
                <div className="client-record-action-divider" />
                <button className="btn-ghost" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                <button className="btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={onClose}>Close</button>
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteConfirmOpen}
        title="Delete Referral"
        message="Are you sure you want to delete this referral? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <ConfirmationModal
        isOpen={!!docDeleteTarget}
        title="Delete Document"
        message="Delete this uploaded document? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDocumentDelete}
        onCancel={() => setDocDeleteTarget(null)}
      />
    </div>
  )
}
