import {
  Activity,
  BadgeCheck,
  BarChart3,
  ClipboardList,
  ClipboardPenLine,
  Clock,
  FileClock,
  FilePlus2,
  Info,
  LayoutDashboard,
  MapPin,
  MessagesSquare,
  ShieldCheck,
  TrendingUp,
  Users,
  UserX,
} from 'lucide-react'

export const OFFICES = ['MERIDIAN', 'FOREST', 'FLOWOOD', 'DAY TREATMENT']
export const ACTIVE_REFERRAL_OFFICES = ['MERIDIAN', 'FOREST']

export const INSURANCES = [
  'Medicaid of MS', 'UHC', 'UHC Community', 'Magnolia', 'Molina',
  'BCBSMS', 'Aetna', 'Tricare', 'Cigna', 'TruCare', 'Other',
]

export const INSURANCE_PAYERS = INSURANCES

export const REFERRAL_SOURCES = ['Provider Referral', 'Parent/Caregiver', 'School', 'Physician', 'Other']

export const BOOL = ['YES', 'NO', 'AWAITING']

export const STAT = ['Completed', 'Emailed', 'Awaiting', 'Please Send', 'N/A']
export const REFERRAL_FORM_OPTIONS = ['Received', 'Not Received', 'Provider Referral']
export const IEP_REPORT_OPTIONS = ['Requested', 'Received', 'Not Received', 'Too Young']
export const AUTISM_DIAGNOSIS_OPTIONS = ['Received', 'Not Received', 'Requested']

export const STAFF = ['Zanteria', 'Aerianna', 'LaShannon', 'Keiara', 'Celia', 'Other']

export const ALL_ROLES = ['All Staff', ...STAFF.filter((s) => s !== 'Other')]

export const MODULES = [
  { id: 'dashboard', icon: '', name: 'Dashboard', desc: 'At-a-glance stats, alerts, and recent activity', color: '#6366f1' },
  { id: 'intake', icon: '', name: 'Intake', desc: 'Manage referrals, add new clients, track status', color: '#22c55e' },
  { id: 'assessment', icon: '', name: 'Initial Assessments', desc: 'Vineland, SRS-2, IEP and assessment tracking', color: '#f59e0b' },
  { id: 'operations', icon: '', name: 'Operational Insights', desc: 'Aging reports, volume, conversion rates, and team performance', color: '#fb923c' },
  { id: 'about', icon: '', name: 'About', desc: 'Office locations, version history, portal info', color: '#8b5cf6' },
]

export const MODULE_NAV = {
  dashboard: [
    { id: 'overview', icon: '', label: 'Overview' },
    { id: 'activity', icon: Activity, label: 'Activity Log' },
  ],
  intake: [
    { id: 'all', icon: ClipboardList, label: 'All Referrals' },
    { id: 'new', icon: FilePlus2, label: 'New Referral' },
    { id: 'pending', icon: FileClock, label: 'Pending Documents' },
    { id: 'insurance', icon: ShieldCheck, label: 'Insurance Verification' },
    { id: 'nr', icon: UserX, label: 'Non-Responsive' },
  ],
  assessment: [
    { id: 'tracker', icon: ClipboardPenLine, label: 'Initial Assessment Board' },
    { id: 'interviews', icon: MessagesSquare, label: 'Parent Interviews' },
    { id: 'bcba', icon: Users, label: 'BCBA Waitlist' },
    { id: 'progress', icon: TrendingUp, label: 'Assessment Progress' },
    { id: 'readysvc', icon: BadgeCheck, label: 'Ready for Services' },
  ],
  operations: [
    { id: 'aging', icon: Clock, label: 'Referral Aging' },
    { id: 'volume', icon: BarChart3, label: 'Clinic Volume' },
    { id: 'conversion', icon: TrendingUp, label: 'Conversion Rate' },
    { id: 'performance', icon: Activity, label: 'Intake Performance' },
  ],
  about: [
    { id: 'locations', icon: MapPin, label: 'Office Locations' },
    { id: 'portal', icon: Info, label: 'About the Portal' },
  ],
}

export const TX_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Finalized']

export const PA_COLORS = {
  Approved: '#22c55e',
  'Partially Approved': '#0891b2',
  'Approved/Discharged': '#64748b',
  'No PA Needed': '#22c55e',
  'Not Submitted': '#64748b',
  'Pending Submission': '#f59e0b',
  'Submitted / In Review': '#6366f1',
  Pending: '#f59e0b',
  'In Review': '#6366f1',
  'Reauthorization Needed': '#f59e0b',
  'Appeal Pending': '#fb923c',
  Denied: '#ef4444',
  'Referred Out': '#64748b',
}

export const PA_BADGE_STYLES = {
  'Partially Approved': {
    color: '#0891b2',
    background: '#0891b218',
    border: '#0891b235',
  },
}

export const LIFECYCLE_BADGE_STYLES = {
  'In Assessment': {
    color: '#f59e0b',
    background: '#f59e0b20',
    border: '#f59e0b35',
  },
  'Ready for Services': {
    color: '#22c55e',
    background: '#22c55e20',
    border: '#22c55e35',
  },
  'Active Client': {
    color: '#22c55e',
    background: '#22c55e20',
    border: '#22c55e35',
  },
  'Referred Out': {
    color: '#8b5cf6',
    background: '#8b5cf620',
    border: '#8b5cf635',
  },
}

export const PA_ICONS = {
  Approved: '',
  'Partially Approved': '',
  'Approved/Discharged': '',
  'No PA Needed': '',
  'Pending Submission': '',
  'Submitted / In Review': '',
  Pending: '',
  'In Review': '',
  'Reauthorization Needed': '',
  'Appeal Pending': '',
  Denied: '',
  'Referred Out': '',
}

export const STAGE_COLORS = {
  'New Referral': '#6366f1',
  Intake: '#8b5cf6',
  'Ready for Interview': '#22c55e',
  'Initial Assessment': '#f59e0b',
  'Moved to Initial Assessment': '#f59e0b',
  'PA Submitted': '#fb923c',
  'PA In Review': '#fb923c',
  'PA Approved': '#22c55e',
  'Active Client': '#22c55e',
  'Referred Out': '#64748b',
  'Reauth Needed': '#f59e0b',
  Discharged: '#64748b',
}

export const STAGE_ICONS = {
  'New Referral': '',
  Intake: '',
  'Ready for Interview': '',
  'Initial Assessment': '',
  'Moved to Initial Assessment': '',
  'PA Submitted': '',
  'PA In Review': '',
  'PA Approved': '',
  'Active Client': '',
  'Referred Out': '',
  'Reauth Needed': '',
  Discharged: '',
}

export const CHECKLIST_FIELDS = [
  ['Referral Form Received', 'referral_form', REFERRAL_FORM_OPTIONS],
  ['Permission Assessment', 'permission_assessment', STAT],
  ['Vineland', 'vineland', STAT],
  ['SRS-2', 'srs2', STAT],
  ['Attends School', 'attends_school', BOOL],
  ['IEP Report', 'iep_report', IEP_REPORT_OPTIONS],
  ['Insurance Verified', 'insurance_verified', BOOL],
  ['Autism Diagnosis', 'autism_diagnosis', AUTISM_DIAGNOSIS_OPTIONS],
  ['Intake Paperwork', 'intake_paperwork', STAT],
]

export function emptyReferral() {
  return {
    first_name: '',
    last_name: '',
    dob: '',
    caregiver: '',
    caregiver_phone: '',
    caregiver_email: '',
    office: '',
    insurance: '',
    secondary_insurance: '',
    insurance_member_id: '',
    client_address: '',
    insurance_last_verified_date: '',
    insurance_verification_notes: '',
    insurance_verification_status: '',
    date_received: new Date().toISOString().split('T')[0],
    contact1: '',
    contact2: '',
    contact3: '',
    referral_form: '',
    permission_assessment: '',
    vineland: '',
    srs2: '',
    attends_school: '',
    iep_report: '',
    insurance_verified: '',
    autism_diagnosis: '',
    intake_paperwork: '',
    intake_personnel: '',
    referral_source: '',
    referral_source_phone: '',
    referral_source_fax: '',
    provider_npi: '',
    point_of_contact: '',
    reason_for_referral: '',
    notes: '',
    status: 'active',
  }
}
