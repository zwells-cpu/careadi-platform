import { Analytics } from '@vercel/analytics/react'
import { supabase } from './lib/supabase'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTheme } from './hooks/useTheme'
import { useIdleTimeout } from './hooks/useIdleTimeout'
import { useReferrals } from './hooks/useReferrals'
import { useAssessments } from './hooks/useAssessments'
import { useLookups } from './hooks/useLookups'
import { MODULES, MODULE_NAV } from './lib/constants'

import { HomePage } from './components/HomePage'
import { Sidebar } from './components/Sidebar'
import { ThemeToggle } from './components/ThemeToggle'
import { ReferralModal } from './components/ReferralModal'
import { AssessmentDetailModal } from './components/AssessmentDetailModal'
import { NewAssessmentModal } from './components/NewAssessmentModal'

import { NewReferralPage } from './pages/NewReferralPage'
import { createActivityLog } from './lib/activityLogs'
import { getAssessmentRecordId, isActiveReferralWork, isAssessmentActiveClient, isReferralTransitioned, needsInsuranceVerification } from './lib/utils'
import { API_BASE, parseApiError } from './lib/api'
import { formatProfileAccessLabel, formatRoleLabel, isAdmin, normalizeProfile, canAccessOperations } from './lib/profileUtils'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })))
const ActivityLogPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.ActivityLogPage })))
const AllReferralsPage = lazy(() => import('./pages/AllReferralsPage').then(module => ({ default: module.AllReferralsPage })))
const PendingDocsPage = lazy(() => import('./pages/IntakePages').then(module => ({ default: module.PendingDocsPage })))
const InsuranceVerifPage = lazy(() => import('./pages/IntakePages').then(module => ({ default: module.InsuranceVerifPage })))
const NonResponsivePage = lazy(() => import('./pages/IntakePages').then(module => ({ default: module.NonResponsivePage })))
const AboutPortalPage = lazy(() => import('./pages/AboutPage').then(module => ({ default: module.AboutPortalPage })))
const LocationsPage = lazy(() => import('./pages/AboutPage').then(module => ({ default: module.LocationsPage })))
const AssessmentTracker = lazy(() => import('./pages/AssessmentPages').then(module => ({ default: module.AssessmentTracker })))
const ParentInterviewsPage = lazy(() => import('./pages/AssessmentPages').then(module => ({ default: module.ParentInterviewsPage })))
const BCBAAssignmentsPage = lazy(() => import('./pages/AssessmentPages').then(module => ({ default: module.BCBAAssignmentsPage })))
const AssessmentProgressPage = lazy(() => import('./pages/AssessmentPages').then(module => ({ default: module.AssessmentProgressPage })))
const ReadyForServicesPage = lazy(() => import('./pages/AssessmentPages').then(module => ({ default: module.ReadyForServicesPage })))
const ReferralAgingPage = lazy(() => import('./pages/OperationsPages').then(module => ({ default: module.ReferralAgingPage })))
const ClinicVolumePage = lazy(() => import('./pages/OperationsPages').then(module => ({ default: module.ClinicVolumePage })))
const ConversionRatePage = lazy(() => import('./pages/OperationsPages').then(module => ({ default: module.ConversionRatePage })))
const IntakePerformancePage = lazy(() => import('./pages/OperationsPages').then(module => ({ default: module.IntakePerformancePage })))

const NAV_STATE_KEY = 'bsom-portal-nav'
const REFERRAL_MODAL_STATE_KEY = 'bsom-portal-open-referral-modal'
const ASSESSMENT_MODAL_STATE_KEY = 'bsom-portal-open-assessment-modal'

const REFERRAL_DOCUMENT_FIELDS = new Set(['referral_form', 'permission_assessment', 'vineland', 'srs2', 'autism_diagnosis', 'intake_paperwork', 'iep_report', 'attends_school'])
const REFERRAL_CONTACT_FIELDS  = new Set(['caregiver', 'caregiver_phone', 'caregiver_email', 'referral_source', 'referral_source_phone', 'referral_source_fax', 'provider_npi', 'point_of_contact'])
const REFERRAL_INSURANCE_FIELDS = new Set(['insurance', 'secondary_insurance'])

function PageLoader({ label = 'Loading page...' }) {
  return (
    <div className="loader-wrap">
      <div className="spinner" />
      <div style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}

function describeReferralUpdate(name, changedFields, afterData) {
  const fields = changedFields.filter(f => f !== 'current_stage')
  if (!fields.length) return `${name}'s referral record was updated.`
  if (fields.every(f => REFERRAL_DOCUMENT_FIELDS.has(f)))  return `${name}'s document checklist was updated.`
  if (fields.every(f => REFERRAL_CONTACT_FIELDS.has(f)))   return `${name}'s contact information was updated.`
  if (fields.every(f => REFERRAL_INSURANCE_FIELDS.has(f))) return `${name}'s insurance information was updated.`
  if (fields.includes('office') && fields.length === 1) {
    const office = afterData?.office
    return office ? `${name} was transferred to ${office}.` : `${name}'s office was updated.`
  }
  if (fields.includes('intake_personnel') && fields.length === 1) {
    const staff = afterData?.intake_personnel
    return staff ? `${name} was assigned to ${staff}.` : `${name} was assigned to a staff member.`
  }
  if (fields.length === 1 && fields[0] === 'notes') return `Notes were updated for ${name}.`
  if (fields.length === 1 && fields[0] === 'reason_for_referral') return `Reason for referral was updated for ${name}.`
  return `${name}'s referral record was updated.`
}

function getReferralUpdateAction(changedFields) {
  const fields = changedFields.filter(f => f !== 'current_stage')
  if (fields.every(f => REFERRAL_DOCUMENT_FIELDS.has(f)))   return 'documents_updated'
  if (fields.every(f => REFERRAL_CONTACT_FIELDS.has(f)))    return 'contact_info_updated'
  if (fields.every(f => REFERRAL_INSURANCE_FIELDS.has(f)))  return 'insurance_updated'
  if (fields.includes('office') && fields.length === 1)     return 'office_transferred'
  if (fields.includes('intake_personnel') && fields.length === 1) return 'staff_assigned'
  if (fields.length === 1 && fields[0] === 'notes')         return 'notes_updated'
  return 'referral_updated'
}

function describeAssessmentUpdate(name, changedFields, afterData) {
  if (changedFields.includes('authorization_status')) {
    const val = afterData?.authorization_status
    return val ? `${name} authorization status updated to "${val}".` : `${name}'s authorization status was updated.`
  }
  if (changedFields.includes('treatment_plan_status')) {
    const val = afterData?.treatment_plan_status
    return val ? `${name} treatment plan status updated to "${val}".` : `${name}'s treatment plan was updated.`
  }
  if (changedFields.includes('parent_interview_status')) {
    const val = afterData?.parent_interview_status
    return val ? `${name} parent interview status updated to "${val}".` : `${name}'s parent interview status was updated.`
  }
  if (changedFields.includes('assigned_bcba')) {
    const bcba = afterData?.assigned_bcba
    return bcba ? `${name} was assigned to ${bcba}.` : `${name}'s BCBA assignment was removed.`
  }
  if (changedFields.includes('ready_for_services')) {
    return afterData?.ready_for_services
      ? `${name} was marked ready for services.`
      : `${name} was removed from ready-for-services.`
  }
  return `${name}'s assessment details were updated.`
}

function getAssessmentUpdateAction(changedFields) {
  if (changedFields.includes('authorization_status'))   return 'authorization_status_updated'
  if (changedFields.includes('treatment_plan_status'))  return 'treatment_plan_updated'
  if (changedFields.includes('parent_interview_status')) return 'parent_interview_updated'
  if (changedFields.includes('assigned_bcba'))          return 'bcba_assigned'
  if (changedFields.includes('ready_for_services'))     return 'ready_for_services_updated'
  return 'assessment_updated'
}

function readSavedNav() {
  try {
    const raw = sessionStorage.getItem(NAV_STATE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (saved?.screen !== 'module' || !saved?.module) return null
    if (saved.module === 'intake' && (saved.subpage === 'intakedash' || saved.subpage === 'profile')) {
      return { ...saved, subpage: 'all' }
    }
    return saved
  } catch {
    return null
  }
}

function readSavedModalId(key) {
  try {
    return sessionStorage.getItem(key) || null
  } catch {
    return null
  }
}

export default function App() {
  const { theme, setTheme } = useTheme()
  const { refs, loading, error, saving, saved, setError, load, saveReferral, updateReferral, deleteReferral, setStatus, toggleParentInterview } = useReferrals()
  const { assessData, assessLoading, loadAssessments, saveAssessEdit, deleteAssessment, ensureAssessmentForReferral, createAssessment } = useAssessments()
  const { bcbaOptions, officeOptions, insuranceOptions, referralSourceOptions, reloadLookups } = useLookups()
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [loginError, setLoginError] = useState(null)
  const [loginPending, setLoginPending] = useState(false)
  const [resetPending, setResetPending] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(null)
  const [signOutPending, setSignOutPending] = useState(false)
  const [activityRefreshKey, setActivityRefreshKey] = useState(0)
  const [workflowToast, setWorkflowToast] = useState(null)
  const [newAssessmentOpen, setNewAssessmentOpen] = useState(false)

  const [screen, setScreen] = useState(() => readSavedNav()?.screen ?? 'home')
  const [module, setModule] = useState(() => readSavedNav()?.module ?? null)
  const [subpage, setSubpage] = useState(() => readSavedNav()?.subpage ?? null)
  const [selId, setSelId] = useState(() => readSavedModalId(REFERRAL_MODAL_STATE_KEY))
  const [selAssessId, setSelAssessId] = useState(() => readSavedModalId(ASSESSMENT_MODAL_STATE_KEY))
  const [routeFilter, setRouteFilter] = useState(null)
  const assessmentLoadRequestedRef = useRef(false)
  const assessmentModalRestorePendingRef = useRef(Boolean(selAssessId))

  const requestLoadAssessments = () => {
    assessmentLoadRequestedRef.current = true
    return loadAssessments()
  }

  const showWorkflowToast = (message) => {
    setWorkflowToast(message)
    setTimeout(() => setWorkflowToast(null), 2200)
  }

  useEffect(() => {
    let mounted = true
    const isRecoveryLink = () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const searchParams = new URLSearchParams(window.location.search)
      return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery'
    }

    const initSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError) {
        setLoginError(sessionError.message)
      }

      setRecoveryMode(isRecoveryLink())
      setSession(data.session ?? null)
      setAuthLoading(false)
    }

    initSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
        setResetSuccess(null)
        setLoginError(null)
      } else if (event === 'SIGNED_OUT') {
        setRecoveryMode(false)
      } else if (!isRecoveryLink()) {
        setRecoveryMode(false)
      }

      setSession(nextSession ?? null)
      setAuthLoading(false)
      setLoginError(null)
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session || recoveryMode) return
    load()
    requestLoadAssessments()
  }, [load, recoveryMode, session])

  useEffect(() => {
    let cancelled = false

    const loadProfile = async () => {
      if (!session?.user?.id || recoveryMode) {
        setProfile(null)
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)

      let data = null
      let profileError = null
      try {
        const profileRes = await fetch(`${API_BASE}/profiles/${session.user.id}`)
        if (!profileRes.ok) throw new Error(`HTTP ${profileRes.status}`)
        data = await profileRes.json()
      } catch (err) {
        profileError = err
      }

      if (cancelled) return

      if (profileError) {
        setLoginError(profileError.message)
        setProfile(null)
      } else {
        setProfile(normalizeProfile(data))
      }

      setProfileLoading(false)
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [recoveryMode, session])

  // Navigation safety check: redirect from operations if user lacks access
  useEffect(() => {
    if (profile && module === 'operations' && !canAccessOperations(profile)) {
      goHome()
    }
  }, [profile, module])

  useEffect(() => {
    const h = (e) => enterModule(e.detail)
    window.addEventListener('enter-module', h)
    return () => window.removeEventListener('enter-module', h)
  }, [])

  // Persist navigation across browser refreshes (session-scoped).
  useEffect(() => {
    if (screen === 'module' && module) {
      sessionStorage.setItem(NAV_STATE_KEY, JSON.stringify({ screen, module, subpage }))
    } else {
      sessionStorage.removeItem(NAV_STATE_KEY)
    }
  }, [screen, module, subpage])

  // Persist open client modals across browser refreshes (session-scoped).
  useEffect(() => {
    if (selId) {
      sessionStorage.setItem(REFERRAL_MODAL_STATE_KEY, selId)
    } else {
      sessionStorage.removeItem(REFERRAL_MODAL_STATE_KEY)
    }
  }, [selId])

  useEffect(() => {
    if (selAssessId) {
      sessionStorage.setItem(ASSESSMENT_MODAL_STATE_KEY, String(selAssessId))
    } else {
      sessionStorage.removeItem(ASSESSMENT_MODAL_STATE_KEY)
    }
  }, [selAssessId])

  // When session resolves and nav was restored to assessment/operations, trigger data load.
  const _restoredModule = useRef(readSavedNav()?.module ?? null)
  useEffect(() => {
    if (!session || recoveryMode) return
    const m = _restoredModule.current
    if (m === 'assessment' || m === 'operations' || assessmentModalRestorePendingRef.current) {
      assessmentModalRestorePendingRef.current = false
      requestLoadAssessments()
    }
  }, [session, recoveryMode])

  const openModulePage = (nextModule, nextSubpage, filter = null) => {
    setModule(nextModule)
    setSubpage(nextSubpage)
    setScreen('module')
    setRouteFilter(filter)
    if ((nextModule === 'assessment' || nextModule === 'operations') && assessData.length === 0) requestLoadAssessments()
  }

  const enterModule = (id) => {
    const defaults = { dashboard: 'overview', intake: 'all', assessment: 'tracker', operations: 'aging', about: 'locations' }
    openModulePage(id, defaults[id] || 'overview')
  }

  const setSubpageAndClearFilter = (nextSubpage) => {
    setSubpage(nextSubpage)
    setRouteFilter(null)
  }

  const goHome = () => {
    setScreen('home')
    setModule(null)
    setSelId(null)
    setSelAssessId(null)
    setRouteFilter(null)
  }

  const active = useMemo(() => refs.filter(r => isActiveReferralWork(r, assessData)), [refs, assessData])
  const nr = useMemo(() => refs.filter(r => r.status === 'non-responsive' || r.status === 'referred-out'), [refs])
  const pending = useMemo(() => active.filter(r => !['signed', 'completed'].includes((r.intake_paperwork || '').toLowerCase())), [active])
  const readyForInterview = useMemo(() => refs.filter(r => isReferralTransitioned(r, assessData)), [refs, assessData])
  const noIns = useMemo(() => active.filter(r => needsInsuranceVerification(r.insurance_verified)).length, [active])
  const operationsRefs = useMemo(() => refs, [refs])
  const operationsAssessData = useMemo(() => assessData, [assessData])
  const activeAssessmentQueueData = useMemo(() => assessData.filter(record => !isAssessmentActiveClient(record)), [assessData])

  const selectedRef = selId ? refs.find(r => r.id === selId) : null
  const selectedAssess = selAssessId
    ? assessData.find(r => String(getAssessmentRecordId(r) || '') === String(selAssessId))
    : null

  useEffect(() => {
    if (!loading && selId && !refs.some(record => record.id === selId)) setSelId(null)
  }, [loading, refs, selId])

  useEffect(() => {
    if (
      !assessLoading &&
      assessmentLoadRequestedRef.current &&
      selAssessId &&
      !assessData.some(record => String(getAssessmentRecordId(record) || '') === String(selAssessId))
    ) {
      setSelAssessId(null)
    }
  }, [assessData, assessLoading, selAssessId])

  const handleSelectAssessment = (record) => {
    const id = getAssessmentRecordId(record)
    setSelAssessId(id)
  }

  const deleteRecord = async (type, id) => {
    const record = type === 'assessment'
      ? assessData.find(item => String(getAssessmentRecordId(item) || '') === String(id))
      : refs.find(item => item.id === id)

    const res = type === 'assessment'
      ? await deleteAssessment(id)
      : await deleteReferral(id)

    if (res?.success) {
      if (type === 'assessment') setSelAssessId(current => (String(current) === String(id) ? null : current))
      else setSelId(current => (current === id ? null : current))

      if (type === 'assessment' && record) {
        await writeAssessmentActivity({
          action: 'assessment_deleted',
          record,
          description: `${formatAssessmentName(record)} assessment was deleted.`,
          details_json: { deleted: true },
        })
      } else if (type === 'referral' && record) {
        await writeReferralActivity({
          action: 'referral_deleted',
          record,
          description: `${formatReferralName(record)} referral was deleted.`,
          details_json: { deleted: true, status: record.status || '' },
        })
      }
    }

    return res
  }

  const displayName = profile?.full_name || session?.user?.email || 'Signed-in user'
  const displayRole = profile ? formatRoleLabel(profile.role) : 'Role pending'
  const accessLabel = profile ? formatProfileAccessLabel(profile) : 'Role pending'
  const activityActorContext = {
    user_id: session?.user?.id || null,
    user_email: session?.user?.email || null,
    user_role: profile?.role || null,
    user_name: displayName,
  }
  const supportUserContext = {
    ...activityActorContext,
  }
  const formatReferralName = (record) => {
    if (!record) return 'Referral'
    const fullName = `${record.first_name || ''} ${record.last_name || ''}`.trim()
    return fullName || 'Referral'
  }
  const formatAssessmentName = (record) => record?.client_name || 'Assessment'
  const safeCreateActivityLog = async (entry) => {
    const result = await createActivityLog(entry)
    if (result !== null) setActivityRefreshKey(current => current + 1)
    return result !== null
  }

  const writeReferralActivity = async ({ action, record, description, details_json = {} }) => {
    if (!session?.user?.id || !record) return

    await safeCreateActivityLog({
      ...activityActorContext,
      action,
      entity_type:  'referral',
      entity_id:    String(record.id ?? ''),
      entity_label: formatReferralName(record),
      description,
      details_json: { office: record.office || '', ...details_json },
    })
  }

  const writeAssessmentActivity = async ({ action, record, description, details_json = {} }) => {
    if (!session?.user?.id || !record) return

    await safeCreateActivityLog({
      ...activityActorContext,
      action,
      entity_type:  'assessment',
      entity_id:    String(getAssessmentRecordId(record) ?? ''),
      entity_label: formatAssessmentName(record),
      description,
      details_json: { clinic: record.clinic || record.office || '', ...details_json },
    })
  }

  const isInitialAssessmentTransition = (recordOrPatch = {}) => {
    const values = [
      recordOrPatch.ready_for_parent_interview === true ? 'ready_for_parent_interview' : '',
      recordOrPatch.current_stage,
      recordOrPatch.stage,
      recordOrPatch.status,
    ]

    return values.some(value => {
      const normalized = String(value || '').trim().toLowerCase()
      return normalized === 'ready_for_parent_interview'
        || normalized === 'moved to initial assessment'
        || normalized === 'initial assessment'
    })
  }

  const writePromotionActivity = async ({ referral, assessment }) => {
    if (!referral || !assessment) return

    const assessmentId = getAssessmentRecordId(assessment)
    const timestamp = new Date().toISOString()
    await writeReferralActivity({
      action: 'referral_promoted_to_initial_assessment',
      record: referral,
      description: `${formatReferralName(referral)} was moved to the Initial Assessment Board.`,
      details_json: {
        referral_id: referral.id || referral.referral_id || '',
        assessment_id: assessmentId || null,
        moved_by: {
          user_id: session?.user?.id || null,
          user_email: session?.user?.email || null,
        },
        office: referral.office || assessment.clinic || assessment.office || '',
        clinic: assessment.clinic || referral.office || '',
        timestamp,
      },
    })
  }

  const ensureInitialAssessmentTransition = async (referral, { source = 'referral_update' } = {}) => {
    if (!referral) return { success: false, error: 'Referral is missing.' }

    const assessmentResult = await ensureAssessmentForReferral(referral)

    if (!assessmentResult?.success) {
      await Promise.all([load(), requestLoadAssessments()])
      setError(`Referral was updated, but the assessment record could not be created: ${assessmentResult?.error || 'Unknown error'}`)
      return assessmentResult
    }

    await Promise.all([load(), requestLoadAssessments()])

    await writePromotionActivity({
      referral,
      assessment: assessmentResult.data,
    })

    if (assessmentResult.created) {
      await writeAssessmentActivity({
        action: 'assessment_created_from_referral',
        record: assessmentResult.data,
        description: `${formatReferralName(referral)} was moved to the Initial Assessment Board.`,
        details_json: {
          referral_id: referral.id || referral.referral_id || '',
          source_workflow: 'referral_intake',
          destination_workflow: 'initial_assessment',
          transition_source: source,
        },
      })
      showWorkflowToast('Client moved to Initial Assessment Board.')
    }

    return assessmentResult
  }

  const showInitialAssessmentTransitionError = (error, context = {}) => {
    console.warn('Initial assessment transition failed.', {
      ...context,
      error,
    })
    setError('Could not move this client to the Initial Assessment Board. The referral was not marked ready. Please try again or contact support.')
  }

  const writeInitialAssessmentTransitionActivity = async ({ referral, assessment, source, created }) => {
    await writePromotionActivity({ referral, assessment })

    if (created) {
      await writeAssessmentActivity({
        action: 'assessment_created_from_referral',
        record: assessment,
        description: `${formatReferralName(referral)} was moved to the Initial Assessment Board.`,
        details_json: {
          referral_id: referral.id || referral.referral_id || '',
          source_workflow: 'referral_intake',
          destination_workflow: 'initial_assessment',
          transition_source: source,
        },
      })
    }
  }
  const handleUploadClientDocument = async ({ referral, documentType, file }) => {
    if (!file) return { success: false, error: 'Please select a file to upload.' }

    const referralId = referral?.id
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', documentType)
    formData.append('uploaded_by', session?.user?.id || '')
    formData.append('uploaded_by_name', displayName)
    formData.append('client_name', formatReferralName(referral))

    try {
      const res = await fetch(`${API_BASE}/referrals/${referralId}/documents`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) return { success: false, error: await parseApiError(res, 'Upload failed.') }
      const data = await res.json()
      await writeReferralActivity({
        action: 'document_uploaded',
        record: referral,
        description: `${formatReferralName(referral)} document uploaded: ${documentType}.`,
        details_json: { document_type: documentType },
      })
      return { success: true, data }
    } catch {
      return { success: false, error: 'Could not reach the server. Check your connection.' }
    }
  }

  const handleDeleteClientDocument = async ({ referral, doc }) => {
    const referralId = referral?.id
    const documentId = doc?.id
    if (!referralId || !documentId) return { success: false, error: 'Missing referral or document ID.' }

    try {
      const res = await fetch(`${API_BASE}/referrals/${referralId}/documents/${documentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) return { success: false, error: await parseApiError(res, 'Delete failed.') }
      await writeReferralActivity({
        action: 'document_deleted',
        record: referral,
        description: `${formatReferralName(referral)} document deleted: ${doc.document_type || doc.file_name}.`,
        details_json: { document_id: documentId, document_type: doc.document_type, file_name: doc.file_name },
      })
      return { success: true }
    } catch {
      return { success: false, error: 'Could not reach the server. Check your connection.' }
    }
  }

  const handleDownloadClientDocument = async ({ referral, doc }) => {
    if (!referral || !doc) return { success: false }

    const fileName = doc.file_name || doc.filename || doc.original_filename || 'document'
    await writeReferralActivity({
      action: 'document_downloaded',
      record: referral,
      description: `${formatReferralName(referral)} document downloaded: ${fileName}.`,
      details_json: {
        document_id: doc.id || '',
        document_type: doc.document_type || '',
        file_name: fileName,
      },
    })
    return { success: true }
  }

  const handleCreateReferral = async (form) => {
    const res = await saveReferral(form)

    if (res?.success && res?.data) {
      await writeReferralActivity({
        action: 'referral_created',
        record: res.data,
        description: `${formatReferralName(res.data)} was added to the intake pipeline.`,
        details_json: {
          insurance: res.data.insurance || '',
          status: res.data.status || '',
        },
      })
      openModulePage('intake', 'all')
    }

    return res
  }

  const handleUpdateReferral = async (id, patch) => {
    const before = refs.find(r => r.id === id)
    const res = await updateReferral(id, patch)

    if (res?.success && res?.data) {
      const changedFields = Object.keys(patch || {})
      const wasInitialAssessment = isInitialAssessmentTransition(before)
      const shouldCreateAssessment = !wasInitialAssessment && (isInitialAssessmentTransition(patch) || isInitialAssessmentTransition(res.data))

      if (changedFields.length === 1 && changedFields[0] === 'insurance_verified') {
        await writeReferralActivity({
          action: 'insurance_verified',
          record: res.data,
          description: `${formatReferralName(res.data)} insurance status updated.`,
          details_json: {
            changed_fields: ['insurance_verified'],
            before: { insurance_verified: before?.insurance_verified ?? null },
            after:  { insurance_verified: res.data.insurance_verified ?? null },
          },
        })
      } else {
        const criticalFields = ['status', 'intake_paperwork', 'office', 'insurance', 'assigned_bcba', 'authorization_status']
        const beforeVals = {}
        const afterVals  = {}
        criticalFields.forEach(f => {
          if (changedFields.includes(f)) {
            beforeVals[f] = before?.[f] ?? null
            afterVals[f]  = res.data[f]  ?? null
          }
        })
        const name = formatReferralName(res.data)
        await writeReferralActivity({
          action: getReferralUpdateAction(changedFields),
          record: res.data,
          description: describeReferralUpdate(name, changedFields, res.data),
          details_json: {
            changed_fields: changedFields,
            ...(Object.keys(beforeVals).length ? { before: beforeVals, after: afterVals } : {}),
          },
        })
      }

      if (shouldCreateAssessment) {
        await ensureInitialAssessmentTransition(res.data, { source: 'referral_update' })
      }
    }

    return res
  }

  const handleUpdateAssessment = async (id, patch) => {
    const before = assessData.find(r => String(getAssessmentRecordId(r) || '') === String(id))
    const wasActiveClient = isAssessmentActiveClient(before)
    const res = await saveAssessEdit(id, patch)

    if (res?.success && res?.data) {
      const isActiveClient = isAssessmentActiveClient(res.data)
      const changedFields = Object.keys(patch || {})
      if (isActiveClient && !wasActiveClient) {
        await writeAssessmentActivity({
          action: 'moved_to_active_client',
          record: res.data,
          description: `${formatAssessmentName(res.data)} was moved to active client status and closed from intake.`,
          details_json: {
            changed_fields: changedFields,
            lifecycle_status: 'active_client',
            workflow_status: 'closed',
            active_client_date: res.data.active_client_date || null,
          },
        })
        showWorkflowToast('Client moved to Active Clients.')
        return res
      }

      const criticalFields = ['authorization_status', 'assessment_status', 'treatment_plan_status', 'parent_interview_status', 'ready_for_services', 'active_client_date', 'assigned_bcba']
      const beforeVals = {}
      const afterVals  = {}
      criticalFields.forEach(f => {
        if (changedFields.includes(f)) {
          beforeVals[f] = before?.[f] ?? null
          afterVals[f]  = res.data[f] ?? null
        }
      })
      const assessName = formatAssessmentName(res.data)
      await writeAssessmentActivity({
        action: getAssessmentUpdateAction(changedFields),
        record: res.data,
        description: describeAssessmentUpdate(assessName, changedFields, res.data),
        details_json: {
          changed_fields: changedFields,
          ...(Object.keys(beforeVals).length ? { before: beforeVals, after: afterVals } : {}),
        },
      })
    }

    return res
  }

  const handleCreateAssessment = async (form) => {
    const res = await createAssessment(form)

    if (res?.success && res?.data) {
      await writeAssessmentActivity({
        action: 'assessment_manually_created',
        record: res.data,
        description: `${formatAssessmentName(res.data)} was manually added to the Initial Assessment Board.`,
        details_json: {
          referral_id: null,
          manual_entry: true,
          source_workflow: 'manual_initial_assessment_board',
        },
      })
      showWorkflowToast('Initial assessment added.')
    } else if (res?.error) {
      setError(`Could not create assessment: ${res.error}`)
    }

    return res
  }

  const handleReopenAssessment = async (id) => {
    const before = assessData.find(r => String(getAssessmentRecordId(r) || '') === String(id))
    const res = await saveAssessEdit(id, {
      ready_for_services: false,
      active_client_date: null,
    })

    if (res?.success && res?.data) {
      await writeAssessmentActivity({
        action: 'intake_reopened',
        record: res.data,
        description: `${formatAssessmentName(res.data)} intake was reopened from active client status.`,
        details_json: {
          changed_fields: ['ready_for_services', 'active_client_date'],
          before: {
            ready_for_services: before?.ready_for_services ?? null,
            active_client_date: before?.active_client_date ?? null,
          },
          after: {
            ready_for_services: res.data.ready_for_services ?? null,
            active_client_date: res.data.active_client_date ?? null,
          },
          lifecycle_status: 'in_assessment',
          workflow_status: 'open',
        },
      })
      showWorkflowToast('Intake reopened.')
    }

    return res
  }

  const handleSetReferralStatus = async (id, status) => {
    const before = refs.find(r => r.id === id)
    const res = await setStatus(id, status)

    if (res?.success && res?.data) {
      await writeReferralActivity({
        action: 'referral_status_changed',
        record: res.data,
        description: `${formatReferralName(res.data)} status changed to ${status}.`,
        details_json: {
          changed_fields: ['status'],
          before: { status: before?.status ?? null },
          after:  { status },
        },
      })

      if (!isInitialAssessmentTransition(before) && (isInitialAssessmentTransition({ status }) || isInitialAssessmentTransition(res.data))) {
        await ensureInitialAssessmentTransition(res.data, { source: 'referral_status' })
      }
    }

    return res
  }

  const handleToggleParentInterview = async (id, val) => {
    const before = refs.find(r => r.id === id)

    if (val === true) {
      const assessmentResult = await ensureAssessmentForReferral(before)

      if (!assessmentResult?.success) {
        showInitialAssessmentTransitionError(assessmentResult?.error || 'Assessment creation failed.', {
          referral_id: before?.id || before?.referral_id || id,
          source: 'ready_for_parent_interview',
        })
        await Promise.all([load(), requestLoadAssessments()])
        return { success: false }
      }

      const res = await toggleParentInterview(id, true)

      if (!res?.success || !res?.data) {
        if (assessmentResult.created) {
          const createdAssessmentId = getAssessmentRecordId(assessmentResult.data)
          if (createdAssessmentId) {
            const rollbackResult = await deleteAssessment(createdAssessmentId)
            if (!rollbackResult?.success) {
              console.warn('Could not roll back assessment after referral transition update failed.', {
                referral_id: before?.id || before?.referral_id || id,
                assessment_id: createdAssessmentId,
              })
            }
          }
        }
        showInitialAssessmentTransitionError(res?.error || 'Referral update failed after assessment creation.', {
          referral_id: before?.id || before?.referral_id || id,
          assessment_id: getAssessmentRecordId(assessmentResult.data),
          source: 'ready_for_parent_interview',
        })
        await Promise.all([load(), requestLoadAssessments()])
        return res || { success: false }
      }

      await Promise.all([load(), requestLoadAssessments()])

      await writeInitialAssessmentTransitionActivity({
        referral: res.data,
        assessment: assessmentResult.data,
        source: 'ready_for_parent_interview',
        created: assessmentResult.created,
      })

      await writeReferralActivity({
        action: 'parent_interview_ready_enabled',
        record: res.data,
        description: `${formatReferralName(res.data)} was marked ready for parent interview.`,
        details_json: {
          ready_for_parent_interview: true,
          assessment_id: getAssessmentRecordId(assessmentResult.data),
        },
      })

      showWorkflowToast('Client moved to Initial Assessment Board.')
      return res
    }

    const res = await toggleParentInterview(id, false)

    if (res?.success && res?.data) {
      await writeReferralActivity({
        action: 'parent_interview_ready_disabled',
        record: res.data,
        description: `${formatReferralName(res.data)} was unmarked from ready for parent interview.`,
        details_json: { ready_for_parent_interview: false },
      })
    }

    return res
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginPending(true)
    setLoginError(null)
    setResetSuccess(null)

    const { data: loginData, error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    })

    if (signInError) {
      setLoginError(signInError.message)
    } else if (loginData?.user) {
      await safeCreateActivityLog({
        user_id:    loginData.user.id,
        user_email: loginData.user.email || null,
        user_role:  null,
        user_name:  loginData.user.email || 'Signed-in user',
        action:     'user_signed_in',
        description: 'User signed in.',
        details_json: {},
      })
    }

    setLoginPending(false)
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault()
    setResetPending(true)
    setLoginError(null)
    setResetSuccess(null)

    if (resetPassword.length < 6) {
      setLoginError('Password must be at least 6 characters long.')
      setResetPending(false)
      return
    }

    if (resetPassword !== resetConfirmPassword) {
      setLoginError('Passwords do not match.')
      setResetPending(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: resetPassword,
    })

    if (updateError) {
      setLoginError(updateError.message)
      setResetPending(false)
      return
    }

    setResetSuccess('Password updated. Please sign in with your new password.')
    setResetPassword('')
    setResetConfirmPassword('')
    setRecoveryMode(false)

    if (window.location.hash || window.location.search.includes('type=recovery')) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    await supabase.auth.signOut()
    setResetPending(false)
  }

  const handleSignOut = async (reason = 'manual') => {
    setSignOutPending(true)
    setLoginError(null)

    if (session?.user?.id) {
      await safeCreateActivityLog({
        ...activityActorContext,
        action:      reason === 'idle' ? 'session_timeout' : 'user_signed_out',
        description: reason === 'idle' ? 'Session ended due to inactivity.' : 'User signed out.',
        details_json: { reason },
      })
    }

    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setLoginError(signOutError.message)
    } else {
      setProfile(null)
      setScreen('home')
      setModule(null)
      setSubpage(null)
      setSelId(null)
      setSelAssessId(null)
      setRouteFilter(null)
      setLoginPassword('')
    }

    setSignOutPending(false)
  }

  const { isWarning, secondsLeft, resetTimer } = useIdleTimeout({
    onTimeout: () => handleSignOut('idle'),
    enabled: !!session && !recoveryMode,
  })

  const idleWarningModal = isWarning ? (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, boxShadow: 'var(--shadow)', padding: 28,
        display: 'grid', gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
            Session Timeout
          </div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Are you still there?</h2>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
          You'll be signed out automatically due to inactivity in{' '}
          <strong style={{ color: 'var(--text)' }}>
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </strong>.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={resetTimer}
            style={{
              flex: 1, border: 'none', borderRadius: 12, padding: '12px 16px',
              background: 'var(--accent)', color: '#fff', fontWeight: 800,
              fontSize: 14, cursor: 'pointer',
            }}
          >
            Stay Logged In
          </button>
          <button
            onClick={handleSignOut}
            style={{
              flex: 1, borderRadius: 12, padding: '12px 16px',
              background: 'transparent', border: '1px solid var(--border2)',
              color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (authLoading) {
    return (
      <div className="loader-wrap">
        <div className="spinner" />
        <div style={{ color: 'var(--muted)' }}>Checking your session...</div>
      </div>
    )
  }

  if (!session || recoveryMode) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '32px',
        background: 'var(--bg)',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Subtle branded background glow — works in both light + dark */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 55% at 50% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, position: 'relative', zIndex: 1 }}>
          {/* Logo + portal name above the card */}
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <img src="/bsom-logo.jpg" alt="BSOM" style={{ width: 60, height: 60, objectFit: 'contain' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>
                Behavioral Solutions of Mississippi
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                BSOM Intake Portal
              </div>
            </div>
          </div>

          {/* Card */}
          <div style={{
            width: '100%', maxWidth: 420,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 24,
            boxShadow: '0 4px 40px rgba(0,0,0,0.15)',
            padding: 28,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                  Secure Access
                </div>
                <h1 style={{ margin: '14px 0 0', fontSize: 26, lineHeight: 1.1 }}>
                  {recoveryMode ? 'Reset password' : 'Staff Sign In'}
                </h1>
              </div>
              <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>

            <form onSubmit={recoveryMode ? handlePasswordReset : handleLogin} style={{ display: 'grid', gap: 14 }}>
              {recoveryMode ? (
                <>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>New Password</span>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      style={{ width: '100%', background: 'var(--surface2)', border: '1px solid color-mix(in srgb, var(--border2) 88%, var(--text))', borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: 14 }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Confirm Password</span>
                    <input
                      type="password"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      style={{ width: '100%', background: 'var(--surface2)', border: '1px solid color-mix(in srgb, var(--border2) 88%, var(--text))', borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: 14 }}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Email</span>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      autoComplete="email"
                      required
                      style={{ width: '100%', background: 'var(--surface2)', border: '1px solid color-mix(in srgb, var(--border2) 88%, var(--text))', borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: 14 }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Password</span>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      style={{ width: '100%', background: 'var(--surface2)', border: '1px solid color-mix(in srgb, var(--border2) 88%, var(--text))', borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: 14 }}
                    />
                  </label>
                </>
              )}

              {loginError && (
                <div className="error-bar" style={{ margin: 0 }}>{loginError}</div>
              )}

              {resetSuccess && (
                <div style={{ margin: 0, borderRadius: 12, border: '1px solid #16a34a33', background: '#16a34a12', color: '#16a34a', padding: '12px 14px', fontSize: 13, fontWeight: 600 }}>
                  {resetSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={recoveryMode ? resetPending : loginPending}
                style={{
                  border: 'none', borderRadius: 12, padding: '13px 16px',
                  background: 'var(--accent)', color: '#fff', fontWeight: 800,
                  fontSize: 14, cursor: (recoveryMode ? resetPending : loginPending) ? 'wait' : 'pointer',
                  opacity: (recoveryMode ? resetPending : loginPending) ? 0.75 : 1,
                  marginTop: 2,
                }}
              >
                {recoveryMode
                  ? (resetPending ? 'Updating password...' : 'Reset Password')
                  : (loginPending ? 'Signing in...' : 'Sign In')}
              </button>
            </form>
          </div>

          {/* Footer tagline below card */}
          <div style={{ marginTop: 20, fontSize: 11, color: 'var(--dim)', textAlign: 'center' }}>
            Internal staff portal &nbsp;·&nbsp; Authorized access only
          </div>
        </div>
      </div>
    )
  }

  if (profile && profile.is_active === false) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 32,
        background: 'var(--bg)',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: 'var(--shadow)',
          padding: 28,
          display: 'grid',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>
              Access Disabled
            </div>
            <h1 style={{ margin: 0, fontSize: 24 }}>Your portal access is inactive.</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
            This account is signed in, but the staff profile is inactive. Please contact a portal administrator if you need access restored.
          </p>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>
            {displayName} · {accessLabel}
          </div>
          <button className="btn-save" onClick={handleSignOut} disabled={signOutPending}>
            {signOutPending ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'home') {
    return (
      <>
        <HomePage
          onEnterModule={enterModule}
          onAddReferral={() => openModulePage('intake', 'new')}
          onScheduleParentInterview={() => openModulePage('assessment', 'interviews')}
          onEnterSubpage={openModulePage}
          theme={theme}
          setTheme={setTheme}
          displayName={displayName}
          activeCount={active.length}
          pendingDocsCount={pending.length}
          readyForInterviewCount={readyForInterview.length}
          assessmentsCount={activeAssessmentQueueData.length}
          statsLoading={loading}
          supportUserContext={supportUserContext}
          profile={profile}
          topRightContent={(
            <div className="home-account-card">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{profileLoading ? 'Loading profile...' : displayRole}</div>
                <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{displayName}</div>
              </div>
              <button className="btn-sm" onClick={handleSignOut} disabled={signOutPending}>
                {signOutPending ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          )}
        />
        {saved && <div className="toast">Referral saved.</div>}
        {workflowToast && <div className="toast">{workflowToast}</div>}
        {idleWarningModal}
      </>
    )
  }

  const m = MODULES.find(x => x.id === module)
  const navItems = MODULE_NAV[module] || []
  const canViewActivityLog = profile?.role === 'admin'
  const canAccessOperationsModule = canAccessOperations(profile)
  const assessmentSubpageFallbacks = { txplan: 'bcba', activeclients: 'readysvc' }
  const intakeSubpageFallbacks = { intakedash: 'all', profile: 'all' }
  const normalizedSubpage = module === 'assessment'
    ? (assessmentSubpageFallbacks[subpage] || subpage)
    : module === 'intake'
      ? (intakeSubpageFallbacks[subpage] || subpage)
      : subpage
  const activeSubpage = module === 'dashboard' && normalizedSubpage === 'activity' && !canViewActivityLog ? 'overview' : normalizedSubpage
  const currentNavLabel = navItems.find(n => n.id === activeSubpage)?.label || ''

  const renderPage = () => {
    if (loading) return (
      <div className="loader-wrap">
        <div className="spinner" />
        <div style={{ color: 'var(--muted)' }}>Connecting to database...</div>
      </div>
    )

    if (module === 'dashboard') {
      if (activeSubpage === 'activity') {
        return <ActivityLogPage activityRefreshKey={activityRefreshKey} canShowTechnicalDetails={isAdmin(profile)} />
      }

      return (
        <DashboardPage
          refs={refs}
          assessData={assessData}
          setSelectedId={setSelId}
          openModulePage={openModulePage}
          activityRefreshKey={activityRefreshKey}
          profileRole={profile?.role}
          canAccessOperations={canAccessOperationsModule}
        />
      )
    }

    if (module === 'about') {
      if (subpage === 'portal') return <AboutPortalPage />
      if (subpage === 'locations') return <LocationsPage />
    }

    if (module === 'intake') {
      if (activeSubpage === 'all') return <AllReferralsPage refs={refs} assessData={assessData} onSelectRef={setSelId} statFilter={routeFilter} onSetStatFilter={setRouteFilter} onClearStatFilter={() => setRouteFilter(null)} />
      if (activeSubpage === 'new') return <NewReferralPage onSave={handleCreateReferral} saving={saving} officeOptions={officeOptions} insuranceOptions={insuranceOptions} referralSourceOptions={referralSourceOptions} />
      if (activeSubpage === 'pending') return <PendingDocsPage refs={refs} assessData={assessData} onSelectRef={setSelId} statFilter={routeFilter} onSetStatFilter={setRouteFilter} onClearStatFilter={() => setRouteFilter(null)} />
      if (activeSubpage === 'insurance') return <InsuranceVerifPage refs={refs} assessData={assessData} onSelectRef={setSelId} statFilter={routeFilter} onSetStatFilter={setRouteFilter} onClearStatFilter={() => setRouteFilter(null)} />
      if (activeSubpage === 'nr') return <NonResponsivePage refs={refs} onRestore={(id) => handleSetReferralStatus(id, 'active')} statFilter={routeFilter} onClearStatFilter={() => setRouteFilter(null)} />
    }

    if (module === 'assessment') {
      if (activeSubpage === 'tracker') return <AssessmentTracker assessData={activeAssessmentQueueData} assessLoading={assessLoading} onSelectAssess={handleSelectAssessment} onNewAssessment={() => setNewAssessmentOpen(true)} statFilter={routeFilter} onSetStatFilter={setRouteFilter} onClearStatFilter={() => setRouteFilter(null)} />
      if (activeSubpage === 'interviews') return <ParentInterviewsPage assessData={activeAssessmentQueueData} assessLoading={assessLoading} onSelectAssess={handleSelectAssessment} statFilter={routeFilter} onSetStatFilter={setRouteFilter} onClearStatFilter={() => setRouteFilter(null)} />
      if (activeSubpage === 'bcba') return <BCBAAssignmentsPage assessData={activeAssessmentQueueData} assessLoading={assessLoading} onSelectAssess={handleSelectAssessment} statFilter={routeFilter} onSetStatFilter={setRouteFilter} onClearStatFilter={() => setRouteFilter(null)} bcbaOptions={bcbaOptions} officeOptions={officeOptions} onRefreshLookups={reloadLookups} />
      if (activeSubpage === 'progress') return <AssessmentProgressPage assessData={activeAssessmentQueueData} assessLoading={assessLoading} onSelectAssess={handleSelectAssessment} statFilter={routeFilter} onSetStatFilter={setRouteFilter} onClearStatFilter={() => setRouteFilter(null)} />
      if (activeSubpage === 'readysvc') return <ReadyForServicesPage assessData={assessData} assessLoading={assessLoading} onSelectAssess={handleSelectAssessment} statFilter={routeFilter} onSetStatFilter={setRouteFilter} onClearStatFilter={() => setRouteFilter(null)} />
    }

    if (module === 'operations') {
      if (!canAccessOperations(profile)) {
        return (
          <div style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Access Restricted</div>
            <div style={{ color: 'var(--muted)', marginBottom: 16 }}>
              Operational Insights is limited to leadership users.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>
              Please contact an administrator if you need access.
            </div>
          </div>
        )
      }
      if (subpage === 'aging') return <ReferralAgingPage refs={operationsRefs} assessData={operationsAssessData} onSelectRef={setSelId} />
      if (subpage === 'volume') return <ClinicVolumePage refs={operationsRefs} assessData={operationsAssessData} />
      if (subpage === 'conversion') return <ConversionRatePage refs={operationsRefs} assessData={operationsAssessData} />
      if (subpage === 'performance') return <IntakePerformancePage refs={operationsRefs} assessData={operationsAssessData} />
    }

    return (
      <div style={{ textAlign: 'center', padding: '80px 40px' }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Page not found</div>
      </div>
    )
  }

  return (
    <>
      {saved && <div className="toast">Referral saved.</div>}
      {workflowToast && <div className="toast">{workflowToast}</div>}

      <div className="shell">
        <Sidebar
          module={module}
          subpage={activeSubpage}
          setSubpage={setSubpageAndClearFilter}
          goHome={goHome}
          pendingCount={pending.length}
          unverifiedCount={noIns}
          supportUserContext={supportUserContext}
          canViewActivityLog={canViewActivityLog}
          canAccessOperations={canAccessOperationsModule}
        />

        <div className="content">
          <div className="topbar">
            <div className="topbar-title">
              {m?.name}{currentNavLabel ? ` - ${currentNavLabel}` : ''}
            </div>
            <div className="topbar-right">
              <div className="topbar-profile">
                <div className="topbar-profile-text">
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    {profileLoading ? 'Loading profile' : accessLabel}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                </div>
              </div>
              <span className="badge-pill">{active.length} Active Referrals</span>
              <button
                className="btn-sm topbar-refresh-btn"
                onClick={() => {
                  load()
                  if (module === 'assessment' || module === 'operations') requestLoadAssessments()
                }}
              >
                <RefreshCw size={14} strokeWidth={2} />
                Refresh
              </button>
            </div>
          </div>

          <div className="page">
            {error && (
              <div className="error-bar">
                {error}
                <button className="x-btn" onClick={() => setError(null)}>Close</button>
              </div>
            )}
            <div className={`page-inner ${module === 'intake' && activeSubpage === 'all' ? 'page-inner-wide' : ''}`}>
              <Suspense fallback={<PageLoader />}>
                {renderPage()}
              </Suspense>
            </div>
          </div>

          <footer className="footer-shell">
            <div className="footer-side">
              <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>
            <div className="footer-side footer-side-center">
            <span style={{ fontSize: 11, color: 'var(--dim)' }}>
              © 2026 Behavioral Solutions of Mississippi &nbsp;•&nbsp; Intake Operations Portal developed by Zanteria Wells
            </span>
            </div>
            <div className="footer-side footer-side-right">
              <button className="btn-sm" onClick={handleSignOut} disabled={signOutPending}>
                {signOutPending ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </footer>
        </div>
      </div>

      {selectedRef && (
        <ReferralModal
          referral={selectedRef}
          onClose={() => setSelId(null)}
          onSave={handleUpdateReferral}
          onUploadDocument={handleUploadClientDocument}
          onDeleteDocument={handleDeleteClientDocument}
          onDownloadDocument={handleDownloadClientDocument}
          officeOptions={officeOptions}
          insuranceOptions={insuranceOptions}
          referralSourceOptions={referralSourceOptions}
          onDelete={(id) => deleteRecord('referral', id)}
          onSetStatus={async (id, status) => {
            const res = await handleSetReferralStatus(id, status)
            if (res?.success) setSelId(null)
            return res
          }}
          onToggleParentInterview={handleToggleParentInterview}
        />
      )}

      {selectedAssess && (
        <AssessmentDetailModal
          assessment={selectedAssess}
          onClose={() => setSelAssessId(null)}
          onSave={handleUpdateAssessment}
          onDelete={(id) => deleteRecord('assessment', id)}
          onReopen={handleReopenAssessment}
          canReopen={isAdmin(profile)}
          bcbaOptions={bcbaOptions}
          officeOptions={officeOptions}
        />
      )}

      {newAssessmentOpen && (
        <NewAssessmentModal
          onClose={() => setNewAssessmentOpen(false)}
          onSave={handleCreateAssessment}
          bcbaOptions={bcbaOptions}
          officeOptions={officeOptions}
          insuranceOptions={insuranceOptions}
        />
      )}

      {idleWarningModal}
      <Analytics />
    </>
  )
}
