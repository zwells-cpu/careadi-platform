import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardCheck,
  Eye,
  FileText,
  NotebookText,
  PhoneCall,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { ConfirmationModal } from './ConfirmationModal'
import { OFFICES } from '../lib/constants'
import { cleanLookupValue, includeCurrentOption, normalizeOptions, optionValues } from '../lib/lookups'
import {
  ASSESSMENT_COMPONENT_STATUSES,
  AUTHORIZATION_STATUSES,
  PARENT_INTERVIEW_STATUSES,
  TREATMENT_PLAN_STATUSES,
  getAssessmentLifecycleStatus,
  isAssessmentActiveClient,
  normalizeAuthorizationStatus,
  normalizeAssessmentComponentStatus,
  normalizeParentInterviewStatus,
  normalizeTreatmentPlanStatus,
} from '../lib/utils'

function asBoolString(value) {
  return value === true || value === 'true' ? 'true' : 'false'
}

function displayValue(value) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return value || '--'
}

function assessmentStatusTone(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'yes' || normalized === 'true' || normalized.includes('ready for services') || normalized.includes('approved') || normalized.includes('active')) return 'confirmed'
  if (normalized.includes('referred out') || normalized.includes('denied')) return 'needs-follow-up'
  if (normalized.includes('assessment') || normalized.includes('pending') || normalized.includes('review') || normalized.includes('submitted') || normalized.includes('progress')) return 'awaiting'
  return 'ready'
}

function AssessmentSection({ icon: Icon, title, children, className = '' }) {
  return (
    <section className={`client-record-section assessment-record-section ${className}`}>
      <div className="client-record-section-head">
        <span className="client-record-section-icon"><Icon size={17} strokeWidth={2.2} /></span>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function AssessmentField({ label, value, children, className = '' }) {
  return (
    <div className={`client-record-field assessment-record-field ${className}`}>
      <div className="label">{label}</div>
      {children || <div className="client-record-value">{displayValue(value)}</div>}
    </div>
  )
}

function TextField({ label, value, onChange, placeholder = '', className = '' }) {
  return (
    <div className={`client-record-field assessment-record-field ${className}`}>
      <div className="label">{label}</div>
      <input className="edit-input" value={value || ''} placeholder={placeholder} onChange={ev => onChange(ev.target.value)} />
    </div>
  )
}

function SelectField({ label, value, onChange, options, placeholder = '-- Select --' }) {
  return (
    <div className="client-record-field assessment-record-field">
      <div className="label">{label}</div>
      <select className="edit-select" value={value || ''} onChange={ev => onChange(ev.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  )
}

function DateField({ label, value, onChange }) {
  return (
    <div className="client-record-field assessment-record-field">
      <div className="label">{label}</div>
      <div className="assessment-record-date-control">
        <input className="edit-input" type="date" value={value || ''} onChange={ev => onChange(ev.target.value)} />
        <button className="btn-ghost assessment-record-clear-btn" type="button" onClick={() => onChange('')}>Clear</button>
      </div>
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

function StatusPill({ value, children, className = '' }) {
  const display = children || displayValue(value)
  return (
    <span className={`verification-pill verification-pill-${assessmentStatusTone(display)} ${className}`}>
      {display}
    </span>
  )
}

function getBcbaValues(bcbaOptions) {
  return (bcbaOptions.length ? bcbaOptions : normalizeOptions([]))
    .map(option => cleanLookupValue(option.value ?? option.label ?? option))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

function getSelectedBcbaValue(record, bcbaOptions) {
  const currentBcba = cleanLookupValue(record?.assigned_bcba)
  const bcbaValues = getBcbaValues(bcbaOptions)
  const matchingBcbaOption = bcbaValues.find(option => option.toLowerCase() === currentBcba.toLowerCase())
  return matchingBcbaOption || currentBcba
}

function getEditableAssessmentPatch(record = {}, assignedBcba = '') {
  return {
    client_name: record.client_name || '',
    clinic: record.clinic || record.office || '',
    assigned_bcba: assignedBcba,
    caregiver: record.caregiver || '',
    caregiver_phone: record.caregiver_phone || '',
    caregiver_email: record.caregiver_email || '',
    insurance: record.insurance || '',
    vineland: normalizeAssessmentComponentStatus(record.vineland),
    srs2: normalizeAssessmentComponentStatus(record.srs2),
    vbmapp: normalizeAssessmentComponentStatus(record.vbmapp),
    socially_savvy: normalizeAssessmentComponentStatus(record.socially_savvy),
    parent_interview_status: normalizeParentInterviewStatus(record.parent_interview_status),
    parent_interview_scheduled_date: record.parent_interview_scheduled_date || null,
    parent_interview_completed_date: record.parent_interview_completed_date || null,
    direct_obs_status: normalizeAssessmentComponentStatus(record.direct_obs_status || record.direct_obs),
    direct_obs_scheduled_date: record.direct_obs_scheduled_date || null,
    direct_obs_completed_date: record.direct_obs_completed_date || null,
    treatment_plan_status: normalizeTreatmentPlanStatus(record.treatment_plan_status || 'Not Started'),
    treatment_plan_started_date: record.treatment_plan_started_date || null,
    treatment_plan_completed_date: record.treatment_plan_completed_date || null,
    authorization_status: normalizeAuthorizationStatus(record.authorization_status),
    authorization_submitted_date: record.authorization_submitted_date || null,
    authorization_approved_date: record.authorization_approved_date || null,
    ready_for_services: record.ready_for_services === true || record.ready_for_services === 'true',
    active_client_date: record.active_client_date || null,
    other_services: record.other_services || '',
    notes: record.notes || '',
  }
}

export function AssessmentDetailModal({ assessment, onClose, onSave, onDelete, onReopen, canReopen = false, bcbaOptions = [], officeOptions: liveOfficeOptions = [] }) {
  const [form, setForm] = useState(assessment)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    setForm(assessment)
  }, [assessment])

  const recordId = form?.assessment_id ?? form?.id ?? null
  const clinic = form?.clinic || form?.office || ''
  const lifecycleStatus = getAssessmentLifecycleStatus(form)
  const isActiveClient = isAssessmentActiveClient(form)
  const officeOptions = includeCurrentOption(optionValues(liveOfficeOptions.length ? liveOfficeOptions : normalizeOptions(OFFICES)), clinic)
  const currentBcba = cleanLookupValue(form?.assigned_bcba)
  const bcbaValues = useMemo(() => getBcbaValues(bcbaOptions), [bcbaOptions])
  const matchingBcbaOption = bcbaValues.find(option => option.toLowerCase() === currentBcba.toLowerCase())
  const selectedBcbaValue = matchingBcbaOption || currentBcba
  const assignedBcbaOptions = currentBcba && !matchingBcbaOption
    ? [currentBcba, ...bcbaValues]
    : bcbaValues
  const originalSelectedBcbaValue = useMemo(() => getSelectedBcbaValue(assessment, bcbaOptions), [assessment, bcbaOptions])
  const originalPatch = useMemo(() => getEditableAssessmentPatch(assessment, originalSelectedBcbaValue), [assessment, originalSelectedBcbaValue])
  const currentPatch = useMemo(() => getEditableAssessmentPatch(form, selectedBcbaValue), [form, selectedBcbaValue])
  const hasUnsavedChanges = JSON.stringify(currentPatch) !== JSON.stringify(originalPatch)

  const setField = (key) => (value) => setForm(prev => ({ ...prev, [key]: value }))

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
    if (!recordId) return
    setSaving(true)
    const patch = getEditableAssessmentPatch(form, selectedBcbaValue)
    const res = await onSave(recordId, patch)
    if (res?.success) onClose()
    setSaving(false)
  }

  const performDelete = async () => {
    if (!recordId || !onDelete) return
    setDeleting(true)
    const res = await onDelete(recordId)
    if (res?.success) onClose()
    setDeleting(false)
  }

  const handleDeleteRequest = () => {
    if (!recordId || !onDelete) return
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteConfirmOpen(false)
    await performDelete()
  }

  const handleMarkReferredOut = async () => {
    if (!recordId) return
    setSaving(true)
    const res = await onSave(recordId, {
      authorization_status: 'Referred Out',
      ready_for_services: false,
      active_client_date: null,
    })
    if (res?.success) onClose()
    setSaving(false)
  }

  const handleReopenIntake = async () => {
    if (!recordId || !onReopen) return
    setSaving(true)
    const res = await onReopen(recordId)
    if (res?.success) onClose()
    setSaving(false)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal client-record-modal assessment-record-modal" onClick={ev => ev.stopPropagation()}>
        <div className="modal-head client-record-head assessment-record-head">
          <div className="client-record-identity">
            <div className="client-record-kicker">Initial Assessment Record</div>
            <div className="modal-title client-record-title">{displayValue(form?.client_name)}</div>
            <div className="client-record-meta">
              <MetadataChip label="Clinic / Office">{displayValue(clinic)}</MetadataChip>
              <MetadataChip label="Assigned BCBA">{displayValue(selectedBcbaValue)}</MetadataChip>
              <MetadataChip label="Lifecycle Status"><StatusPill value={lifecycleStatus} /></MetadataChip>
              <MetadataChip label="Ready for Services"><StatusPill>{form?.ready_for_services === true ? 'Yes' : 'No'}</StatusPill></MetadataChip>
            </div>
          </div>
          <div className="modal-actions client-record-head-actions">
            <div className="assessment-record-status-summary">
              <span>Current State</span>
              <StatusPill value={lifecycleStatus} />
            </div>
            <button className="close-btn" onClick={onClose} aria-label="Close assessment record">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body client-record-body assessment-record-body">
          <AssessmentSection icon={UserRound} title="Client Details">
            <div className="client-record-form-grid assessment-record-grid">
              <TextField label="Client Name" value={form?.client_name} onChange={setField('client_name')} />
              <SelectField label="Clinic" value={form?.clinic || form?.office || ''} onChange={setField('clinic')} options={officeOptions} />
              <SelectField label="Assigned BCBA" value={selectedBcbaValue} onChange={setField('assigned_bcba')} options={assignedBcbaOptions} placeholder="Select BCBA" />
              <AssessmentField label="Lifecycle Status">
                <StatusPill value={lifecycleStatus} />
              </AssessmentField>
            </div>
          </AssessmentSection>

          <AssessmentSection icon={ShieldCheck} title="Caregiver / Insurance">
            <div className="client-record-form-grid assessment-record-grid">
              <TextField label="Caregiver" value={form?.caregiver} onChange={setField('caregiver')} />
              <TextField label="Caregiver Phone" value={form?.caregiver_phone} onChange={setField('caregiver_phone')} />
              <TextField label="Caregiver Email" value={form?.caregiver_email} onChange={setField('caregiver_email')} />
              <TextField label="Insurance" value={form?.insurance} onChange={setField('insurance')} />
              <TextField label="Other Services" value={form?.other_services} onChange={setField('other_services')} placeholder="ABA, OT, speech, etc." className="client-record-field-span" />
            </div>
          </AssessmentSection>

          <AssessmentSection icon={ClipboardCheck} title="Assessment Components" className="client-record-section-wide">
            <div className="client-record-form-grid client-record-form-grid-three assessment-record-grid">
              <SelectField label="Vineland" value={normalizeAssessmentComponentStatus(form?.vineland)} onChange={setField('vineland')} options={ASSESSMENT_COMPONENT_STATUSES} />
              <SelectField label="SRS-2" value={normalizeAssessmentComponentStatus(form?.srs2)} onChange={setField('srs2')} options={ASSESSMENT_COMPONENT_STATUSES} />
              <SelectField label="VBMAPP" value={normalizeAssessmentComponentStatus(form?.vbmapp)} onChange={setField('vbmapp')} options={ASSESSMENT_COMPONENT_STATUSES} />
              <SelectField label="Socially Savvy" value={normalizeAssessmentComponentStatus(form?.socially_savvy)} onChange={setField('socially_savvy')} options={ASSESSMENT_COMPONENT_STATUSES} />
            </div>
          </AssessmentSection>

          <AssessmentSection icon={PhoneCall} title="Parent Interview Workflow">
            <div className="client-record-form-grid assessment-record-grid">
              <SelectField label="Parent Interview Status" value={normalizeParentInterviewStatus(form?.parent_interview_status)} onChange={setField('parent_interview_status')} options={PARENT_INTERVIEW_STATUSES} />
              <DateField label="Interview Scheduled" value={form?.parent_interview_scheduled_date} onChange={setField('parent_interview_scheduled_date')} />
              <DateField label="Interview Completed" value={form?.parent_interview_completed_date} onChange={setField('parent_interview_completed_date')} />
            </div>
          </AssessmentSection>

          <AssessmentSection icon={Eye} title="Direct Observation Workflow">
            <div className="client-record-form-grid assessment-record-grid">
              <SelectField label="Direct Observation Status" value={normalizeAssessmentComponentStatus(form?.direct_obs_status || form?.direct_obs)} onChange={setField('direct_obs_status')} options={ASSESSMENT_COMPONENT_STATUSES} />
              <DateField label="Direct Observation Scheduled" value={form?.direct_obs_scheduled_date} onChange={setField('direct_obs_scheduled_date')} />
              <DateField label="Direct Observation Completed" value={form?.direct_obs_completed_date} onChange={setField('direct_obs_completed_date')} />
            </div>
          </AssessmentSection>

          <AssessmentSection icon={FileText} title="Treatment Plan / Authorization" className="client-record-section-wide assessment-record-treatment">
            <div className="assessment-record-handoff">
              <div>
                <span className="client-record-banner-label">Final Handoff State</span>
                <strong>Ready for Services</strong>
              </div>
              <StatusPill className="assessment-record-ready-pill">{form?.ready_for_services === true ? 'Yes' : 'No'}</StatusPill>
            </div>
            <div className="client-record-form-grid client-record-form-grid-three assessment-record-grid">
              <SelectField label="Treatment Plan Status" value={normalizeTreatmentPlanStatus(form?.treatment_plan_status)} onChange={setField('treatment_plan_status')} options={TREATMENT_PLAN_STATUSES} />
              <DateField label="Treatment Plan Started" value={form?.treatment_plan_started_date} onChange={setField('treatment_plan_started_date')} />
              <DateField label="Treatment Plan Completed" value={form?.treatment_plan_completed_date} onChange={setField('treatment_plan_completed_date')} />
              <SelectField label="Authorization Status" value={normalizeAuthorizationStatus(form?.authorization_status)} onChange={setField('authorization_status')} options={AUTHORIZATION_STATUSES} />
              <DateField label="Auth Submitted" value={form?.authorization_submitted_date} onChange={setField('authorization_submitted_date')} />
              <DateField label="Auth Approved" value={form?.authorization_approved_date} onChange={setField('authorization_approved_date')} />
              <div className="client-record-field assessment-record-field assessment-record-ready-field">
                <div className="label">Ready for Services</div>
                <select className="edit-select" value={asBoolString(form?.ready_for_services)} onChange={ev => setField('ready_for_services')(ev.target.value)}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <DateField label="Active Client Date" value={form?.active_client_date} onChange={setField('active_client_date')} />
            </div>
          </AssessmentSection>

          <AssessmentSection icon={NotebookText} title="Notes" className="client-record-section-wide">
            <div className="client-record-field assessment-record-field client-record-notes-field">
              <div className="label">Notes</div>
              <textarea
                className="edit-input client-record-notes assessment-record-notes"
                rows={8}
                value={form?.notes || ''}
                onChange={ev => setField('notes')(ev.target.value)}
              />
            </div>
          </AssessmentSection>
        </div>

        <div className="modal-foot client-record-foot assessment-record-foot">
          <div className="assessment-record-foot-left">
            {canReopen && isActiveClient ? (
              <button
                className="client-record-action client-record-action-success"
                onClick={handleReopenIntake}
                disabled={saving || deleting || !recordId}
              >
                Reopen Intake
              </button>
            ) : null}
            {lifecycleStatus !== 'Referred Out' && !isActiveClient ? (
              <button
                className="client-record-action assessment-record-referred-action"
                onClick={handleMarkReferredOut}
                disabled={saving || deleting || !recordId}
              >
                Mark Referred Out
              </button>
            ) : null}
          </div>
          <div className="modal-actions client-record-foot-actions">
            {!isActiveClient ? (
              <button
                className="btn-danger"
                onClick={handleDeleteRequest}
                disabled={saving || deleting || !recordId}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            ) : null}
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            {!isActiveClient ? (
              <button className="btn-save" onClick={handleSave} disabled={saving || deleting || !recordId}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteConfirmOpen}
        title="Delete Assessment"
        message="Deleting this assessment will remove all associated data."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  )
}
