import { useMemo, useState } from 'react'
import { OFFICES, INSURANCES } from '../lib/constants'
import { cleanLookupValue, includeCurrentOption, normalizeOptions, optionValues } from '../lib/lookups'
import {
  ASSESSMENT_COMPONENT_STATUSES,
  AUTHORIZATION_STATUSES,
  PARENT_INTERVIEW_STATUSES,
  TREATMENT_PLAN_STATUSES,
  normalizeAssessmentComponentStatus,
  normalizeAuthorizationStatus,
  normalizeParentInterviewStatus,
  normalizeTreatmentPlanStatus,
} from '../lib/utils'

const DEFAULT_FORM = {
  client_name: '',
  clinic: '',
  assigned_bcba: '',
  insurance: '',
  parent_interview_status: 'Awaiting Assignment',
  assessment_status: 'Not Started',
  treatment_plan_status: 'Not Started',
  authorization_status: 'Not Submitted',
  ready_for_services: false,
  notes: '',
}

function getBcbaValues(bcbaOptions) {
  return (bcbaOptions.length ? bcbaOptions : normalizeOptions([]))
    .map(option => cleanLookupValue(option.value ?? option.label ?? option))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

function TextField({ label, value, onChange, required = false, placeholder = '' }) {
  return (
    <div>
      <div className="label">{label}{required ? ' *' : ''}</div>
      <input className="edit-input" value={value || ''} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
    </div>
  )
}

function SelectField({ label, value, onChange, options, required = false, placeholder = '-- Select --' }) {
  return (
    <div>
      <div className="label">{label}{required ? ' *' : ''}</div>
      <select className="edit-select" value={value || ''} onChange={event => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  )
}

export function NewAssessmentModal({ onClose, onSave, bcbaOptions = [], officeOptions: liveOfficeOptions = [], insuranceOptions: liveInsuranceOptions = [] }) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const officeValues = useMemo(
    () => includeCurrentOption(optionValues(liveOfficeOptions.length ? liveOfficeOptions : normalizeOptions(OFFICES)), form.clinic),
    [form.clinic, liveOfficeOptions],
  )
  const insuranceValues = useMemo(
    () => includeCurrentOption(optionValues(liveInsuranceOptions.length ? liveInsuranceOptions : normalizeOptions(INSURANCES)), form.insurance),
    [form.insurance, liveInsuranceOptions],
  )
  const assignedBcbaOptions = useMemo(() => getBcbaValues(bcbaOptions), [bcbaOptions])

  const setField = (key) => (value) => {
    setError(null)
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    const clientName = cleanLookupValue(form.client_name)
    const clinic = cleanLookupValue(form.clinic)
    const assignedBcba = cleanLookupValue(form.assigned_bcba)

    if (!clientName) {
      setError('Client name is required.')
      return
    }
    if (!clinic) {
      setError('Clinic is required.')
      return
    }
    setSaving(true)
    const res = await onSave({
      referral_id: null,
      client_name: clientName,
      clinic,
      assigned_bcba: assignedBcba,
      insurance: cleanLookupValue(form.insurance),
      parent_interview_status: normalizeParentInterviewStatus(form.parent_interview_status),
      assessment_status: normalizeAssessmentComponentStatus(form.assessment_status),
      treatment_plan_status: normalizeTreatmentPlanStatus(form.treatment_plan_status),
      authorization_status: normalizeAuthorizationStatus(form.authorization_status),
      ready_for_services: false,
      notes: form.notes || '',
    })

    if (res?.success) {
      setSaving(false)
      onClose()
      return
    } else {
      setError(res?.error || 'Could not create assessment.')
    }
    setSaving(false)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={event => event.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">New Initial Assessment</div>
            <div className="modal-sub">Create a manual assessment board record</div>
          </div>
          <button className="close-btn" onClick={onClose}>x</button>
        </div>

        <div className="modal-body" style={{ display: 'block' }}>
          {error ? (
            <div className="error-bar" style={{ marginBottom: 16 }}>
              {error}
              <button className="x-btn" onClick={() => setError(null)}>Close</button>
            </div>
          ) : null}

          <div className="section-hdr">Client Details</div>
          <div className="responsive-review-grid" style={{ gap: 12 }}>
            <TextField label="Client Name" value={form.client_name} onChange={setField('client_name')} required />
            <SelectField label="Clinic" value={form.clinic} onChange={setField('clinic')} options={officeValues} required />
            <SelectField label="Assigned BCBA" value={form.assigned_bcba} onChange={setField('assigned_bcba')} options={assignedBcbaOptions} placeholder={assignedBcbaOptions.length ? 'Unassigned' : 'No active BCBAs available'} />
            <SelectField label="Insurance" value={form.insurance} onChange={setField('insurance')} options={insuranceValues} placeholder="Optional" />
          </div>

          <div className="section-hdr" style={{ marginTop: 18 }}>Workflow Status</div>
          <div className="responsive-review-grid" style={{ gap: 12 }}>
            <SelectField label="Parent Interview Status" value={form.parent_interview_status} onChange={setField('parent_interview_status')} options={PARENT_INTERVIEW_STATUSES} />
            <SelectField label="Assessment Status" value={form.assessment_status} onChange={setField('assessment_status')} options={ASSESSMENT_COMPONENT_STATUSES} />
            <SelectField label="Treatment Plan Status" value={form.treatment_plan_status} onChange={setField('treatment_plan_status')} options={TREATMENT_PLAN_STATUSES} />
            <SelectField label="Authorization Status" value={form.authorization_status} onChange={setField('authorization_status')} options={AUTHORIZATION_STATUSES} />
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="label">Notes</div>
            <textarea
              className="edit-input"
              rows={4}
              value={form.notes}
              onChange={event => setField('notes')(event.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div className="modal-foot">
          <div />
          <div className="modal-actions">
            <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn-save" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Creating...' : 'Create Assessment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
