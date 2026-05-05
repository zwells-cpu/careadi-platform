import { useEffect, useMemo, useRef, useState } from 'react'
import { ACTIVE_REFERRAL_OFFICES, INSURANCE_PAYERS, REFERRAL_SOURCES, BOOL, STAT, STAFF, AUTISM_DIAGNOSIS_OPTIONS, REFERRAL_FORM_OPTIONS, IEP_REPORT_OPTIONS, emptyReferral } from '../lib/constants'
import { normalizeOptions, optionValues } from '../lib/lookups'
import { formatDisplayDate, formatPhoneNumber, normalizeAutismDx } from '../lib/utils'

const STEPS = ['Client Info', 'Caregiver', 'Insurance', 'Documents', 'Review']
const ATTEND_SCHOOL_OPTIONS = ['Yes', 'No']
const INTAKE_PERSONNEL_OPTIONS = [...STAFF.slice(0, -1), 'Nicola', STAFF[STAFF.length - 1]]
const PHONE_FIELDS = new Set(['caregiver_phone', 'referral_source_phone', 'referral_source_fax'])
const DRAFT_STORAGE_KEY = 'bsom-new-referral-draft'
const ACTIVE_REFERRAL_OFFICE_SET = new Set(ACTIVE_REFERRAL_OFFICES.map(office => office.toUpperCase()))

function activeReferralOfficeOptions(options) {
  return optionValues(options).filter(office => ACTIVE_REFERRAL_OFFICE_SET.has(office.toUpperCase()))
}

function normalizeActiveReferralOffice(value) {
  const office = String(value || '').trim()
  return ACTIVE_REFERRAL_OFFICE_SET.has(office.toUpperCase()) ? office : ''
}

function getEmptyReferral() {
  return emptyReferral()
}

function sanitizeDraftForm(value) {
  const base = getEmptyReferral()
  if (!value || typeof value !== 'object') return base

  const next = Object.keys(base).reduce((draft, key) => {
    const draftValue = value[key]
    draft[key] = typeof draftValue === 'string' ? draftValue : base[key]
    return draft
  }, {})

  return { ...next, office: normalizeActiveReferralOffice(next.office) }
}

function clampStep(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(Math.max(Math.trunc(parsed), 0), STEPS.length - 1)
}

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return {
      form: sanitizeDraftForm(parsed?.form),
      step: clampStep(parsed?.step),
    }
  } catch {
    return null
  }
}

function writeDraft(form, step) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      form: sanitizeDraftForm(form),
      step: clampStep(step),
      updatedAt: new Date().toISOString(),
    }))
    return true
  } catch {
    return false
  }
}

function removeDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // Ignore local storage failures; form submission should not depend on draft cleanup.
  }
}

function hasDraftableData(form) {
  const base = getEmptyReferral()
  return Object.keys(base).some(key => {
    if (key === 'status') return false
    return String(form?.[key] || '').trim() !== String(base[key] || '').trim()
  })
}

function StepDots({ step, setStep }) {
  return (
    <div className="step-row">
      {STEPS.map((label, index) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', flex: index < STEPS.length - 1 ? 1 : 'none' }}>
          <div
            className={`step-dot ${index < step ? 'done' : index === step ? 'active' : 'future'}`}
            onClick={() => index <= step && setStep(index)}
            style={{ cursor: index <= step ? 'pointer' : 'default' }}
          >
            {index + 1}
          </div>
          {index < STEPS.length - 1 && <div className={`step-line ${index < step ? 'done' : ''}`} />}
        </div>
      ))}
    </div>
  )
}

function Field({ label, type = 'text', options, value, onChange, inputMode, maxLength }) {
  return (
    <div>
      <label className="label">{label}</label>
      {options ? (
        <select className="input-field" value={value || ''} onChange={onChange}>
          <option value="">-- Select --</option>
          {options.map(option => <option key={option}>{option}</option>)}
        </select>
      ) : (
        <input className="input-field" type={type} value={value || ''} onChange={onChange} inputMode={inputMode} maxLength={maxLength} />
      )}
    </div>
  )
}

function StepSection({ label, helper, children }) {
  return (
    <section className="new-referral-section">
      <div className="new-referral-section-header">
        <div className="new-referral-section-label">{label}</div>
        {helper && <div className="new-referral-section-helper">{helper}</div>}
      </div>
      {children}
    </section>
  )
}

export function NewReferralPage({ onSave, saving, officeOptions: liveOfficeOptions = [], insuranceOptions: liveInsuranceOptions = [], referralSourceOptions: liveReferralSourceOptions = [] }) {
  const restoredDraft = useMemo(() => readDraft(), [])
  const [step, setStep] = useState(() => restoredDraft?.step ?? 0)
  const [form, setForm] = useState(() => restoredDraft?.form ?? getEmptyReferral())
  const [draftStatus, setDraftStatus] = useState(() => restoredDraft ? 'restored' : null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [draftEnabled, setDraftEnabled] = useState(() => Boolean(restoredDraft))
  const formRef = useRef(form)
  const stepRef = useRef(step)
  const draftEnabledRef = useRef(draftEnabled)
  const draftSaveReadyRef = useRef(false)
  const suppressDraftRef = useRef(false)
  const officeOptions = activeReferralOfficeOptions(liveOfficeOptions.length ? liveOfficeOptions : normalizeOptions(ACTIVE_REFERRAL_OFFICES))
  const insuranceOptions = optionValues(liveInsuranceOptions.length ? liveInsuranceOptions : normalizeOptions(INSURANCE_PAYERS))
  const referralSourceOptions = optionValues(liveReferralSourceOptions.length ? liveReferralSourceOptions : normalizeOptions(REFERRAL_SOURCES))

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    stepRef.current = step
  }, [step])

  useEffect(() => {
    draftEnabledRef.current = draftEnabled
  }, [draftEnabled])

  useEffect(() => {
    if (!draftSaveReadyRef.current) {
      draftSaveReadyRef.current = true
      return undefined
    }

    if (!draftEnabled || suppressDraftRef.current) return undefined

    const timer = setTimeout(() => {
      if (writeDraft(form, step)) {
        setHasUnsavedChanges(false)
        setDraftStatus('saved')
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [draftEnabled, form, step])

  useEffect(() => {
    const flushDraft = () => {
      if (!draftEnabledRef.current || suppressDraftRef.current) return
      writeDraft(formRef.current, stepRef.current)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushDraft()
    }

    window.addEventListener('pagehide', flushDraft)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      flushDraft()
      window.removeEventListener('pagehide', flushDraft)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges || suppressDraftRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const markDraftChanged = () => {
    setDraftEnabled(true)
    setHasUnsavedChanges(true)
    setDraftStatus('unsaved')
  }

  const handleStepChange = (nextStepOrUpdater) => {
    setStep(current => {
      const nextStep = clampStep(typeof nextStepOrUpdater === 'function' ? nextStepOrUpdater(current) : nextStepOrUpdater)
      if (nextStep !== current) markDraftChanged()
      return nextStep
    })
  }

  const f = (key) => (event) => {
    let nextValue = event.target.value

    if (PHONE_FIELDS.has(key)) nextValue = formatPhoneNumber(nextValue)
    if (key === 'autism_diagnosis') nextValue = normalizeAutismDx(nextValue)

    setForm(prev => ({ ...prev, [key]: nextValue }))
    markDraftChanged()
  }

  const handleSubmit = async () => {
    const res = await onSave({
      ...form,
      office: normalizeActiveReferralOffice(form.office),
      autism_diagnosis: normalizeAutismDx(form.autism_diagnosis, { emptyAsNotReceived: false }),
    })
    if (res?.success) {
      suppressDraftRef.current = true
      removeDraft()
      setDraftEnabled(false)
      setHasUnsavedChanges(false)
      setDraftStatus(null)
      setForm(getEmptyReferral())
      setStep(0)
      setTimeout(() => {
        suppressDraftRef.current = false
      }, 0)
    }
  }

  const handleClearDraft = () => {
    const hasLocalDraft = Boolean(readDraft())
    if (!hasLocalDraft && !draftEnabled && !hasDraftableData(form) && step === 0) return
    if (!window.confirm('Clear the saved new referral draft? This will wipe the local draft on this browser only.')) return

    suppressDraftRef.current = true
    removeDraft()
    setForm(getEmptyReferral())
    setStep(0)
    setDraftEnabled(false)
    setHasUnsavedChanges(false)
    setDraftStatus(null)
    setTimeout(() => {
      suppressDraftRef.current = false
    }, 0)
  }

  const draftStatusLabel = draftStatus === 'restored'
    ? 'Draft restored'
    : draftStatus === 'unsaved'
      ? 'Unsaved changes'
      : draftStatus === 'saved'
        ? 'Draft saved locally'
        : ''

  const steps = [
    <StepSection label="Client Details" helper="Capture the identifying referral details before moving into contact and payer information.">
      <div className="form-grid">
        <Field label="First Name" value={form.first_name} onChange={f('first_name')} />
        <Field label="Last Name" value={form.last_name} onChange={f('last_name')} />
        <Field label="Date of Birth" type="date" value={form.dob} onChange={f('dob')} />
        <Field label="Date Received" type="date" value={form.date_received} onChange={f('date_received')} />
        <Field label="Office" options={officeOptions} value={form.office} onChange={f('office')} />
        <Field label="Reason for Referral" value={form.reason_for_referral} onChange={f('reason_for_referral')} />
        <Field label="Referral Source" options={referralSourceOptions} value={form.referral_source} onChange={f('referral_source')} />
        <Field label="Referral Source Phone" value={form.referral_source_phone} onChange={f('referral_source_phone')} inputMode="numeric" maxLength={12} />
        <Field label="Referral Source Fax" value={form.referral_source_fax} onChange={f('referral_source_fax')} inputMode="numeric" maxLength={12} />
        <Field label="Point of Contact" value={form.point_of_contact} onChange={f('point_of_contact')} />
        <Field label="Provider NPI" value={form.provider_npi} onChange={f('provider_npi')} />
      </div>
    </StepSection>,

    <StepSection label="Caregiver Contact" helper="Add the primary caregiver and outreach dates used by the intake queue.">
      <div className="form-grid">
        <Field label="Caregiver Name" value={form.caregiver} onChange={f('caregiver')} />
        <Field label="Phone" value={form.caregiver_phone} onChange={f('caregiver_phone')} inputMode="numeric" maxLength={12} />
        <Field label="Email" value={form.caregiver_email} onChange={f('caregiver_email')} />
        <Field label="1st Contact Date" type="date" value={form.contact1} onChange={f('contact1')} />
        <Field label="2nd Contact Date" type="date" value={form.contact2} onChange={f('contact2')} />
        <Field label="3rd Contact Date" type="date" value={form.contact3} onChange={f('contact3')} />
      </div>
    </StepSection>,

    <StepSection label="Insurance" helper="Record payer coverage and whether intake has verified current benefits.">
      <div className="form-grid">
        <Field label="Primary Insurance" options={insuranceOptions} value={form.insurance} onChange={f('insurance')} />
        <Field label="Secondary Insurance" options={['None', ...insuranceOptions]} value={form.secondary_insurance} onChange={f('secondary_insurance')} />
        <Field label="Insurance Verified" options={BOOL} value={form.insurance_verified} onChange={f('insurance_verified')} />
      </div>
    </StepSection>,

    <StepSection label="Documents & Intake Status" helper="Track required forms and intake readiness without changing assessment workflow behavior.">
      <div className="form-grid">
        <Field label="Referral Form Received" options={REFERRAL_FORM_OPTIONS} value={form.referral_form} onChange={f('referral_form')} />
        <Field label="Permission for Assessment" options={STAT} value={form.permission_assessment} onChange={f('permission_assessment')} />
        <Field label="Vineland" options={STAT} value={form.vineland} onChange={f('vineland')} />
        <Field label="SRS-2" options={STAT} value={form.srs2} onChange={f('srs2')} />
        <Field label="Attends School" options={ATTEND_SCHOOL_OPTIONS} value={form.attends_school} onChange={f('attends_school')} />
        <Field label="IEP Report" options={IEP_REPORT_OPTIONS} value={form.iep_report} onChange={f('iep_report')} />
        <Field label="Autism Diagnosis" options={AUTISM_DIAGNOSIS_OPTIONS} value={form.autism_diagnosis} onChange={f('autism_diagnosis')} />
        <Field label="Intake Paperwork" options={STAT} value={form.intake_paperwork} onChange={f('intake_paperwork')} />
        <Field label="Intake Personnel" options={INTAKE_PERSONNEL_OPTIONS} value={form.intake_personnel} onChange={f('intake_personnel')} />
      </div>
    </StepSection>,

    <div>
      <StepSection label="Review Referral" helper="Confirm referral details before creating the intake record.">
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="section-hdr">Client</div>
        <div className="responsive-review-grid">
          {[['Name', `${form.first_name} ${form.last_name}`], ['DOB', formatDisplayDate(form.dob)], ['Office', form.office], ['Date Received', formatDisplayDate(form.date_received)]].map(([label, value]) => (
            <div key={label}><div className="label">{label}</div><div style={{ color: 'var(--text)' }}>{value || '--'}</div></div>
          ))}
        </div>
      </div>
      <div className="card card-pad">
        <div className="section-hdr">Caregiver & Insurance</div>
        <div className="responsive-review-grid">
          {[['Caregiver', form.caregiver], ['Phone', form.caregiver_phone], ['Insurance', form.insurance], ['Verified', form.insurance_verified]].map(([label, value]) => (
            <div key={label}><div className="label">{label}</div><div style={{ color: 'var(--text)' }}>{value || '--'}</div></div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <label className="label">Notes</label>
        <textarea className="input-field" rows={3} value={form.notes || ''} onChange={f('notes')} style={{ resize: 'vertical' }} />
      </div>
      </StepSection>
    </div>,
  ]

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="pg-hdr new-referral-header" style={{ marginBottom: 28 }}>
        <div>
          <div className="pg-hdr-title">New Referral</div>
          <div className="pg-hdr-sub">Step {step + 1} of {STEPS.length}: {STEPS[step]}</div>
        </div>
        <div className="new-referral-draft-tools">
          <button className="btn-ghost new-referral-clear-draft" type="button" onClick={handleClearDraft}>
            Clear Draft
          </button>
        </div>
      </div>

      <StepDots step={step} setStep={handleStepChange} />

      <div className="card card-pad" style={{ marginBottom: 24 }}>
        {steps[step]}
      </div>

      <div className="responsive-form-actions">
        <button className="btn-ghost" onClick={() => handleStepChange(current => Math.max(0, current - 1))} disabled={step === 0}>
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn-primary" onClick={() => handleStepChange(current => current + 1)}>
            Next
          </button>
        ) : (
          <button className="btn-save" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Submit Referral'}
          </button>
        )}
      </div>
    </div>
  )
}
