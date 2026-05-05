import { Activity, BarChart3, Clock, FileText, PieChart, UserCheck, Users, UserX } from 'lucide-react'
import { StagePill } from '../components/Badge'
import { ClickableStatCard } from '../components/StatFilterControls'
import { displayStaffName, getAuthorizationStatus, getReferralStage, isActiveReferralWork, isAssessmentActiveClient, isInsuranceVerified, needsInsuranceVerification, normalizeAutismDx, normalizeOffice, normalizeParentInterviewStatus, normalizeStaffName, normalizeTreatmentPlanStatus } from '../lib/utils'

// ── Shared helpers ──
function daysSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function daysBetween(startStr, endStr) {
  if (!startStr || !endStr) return null
  const s = new Date(startStr), e = new Date(endStr)
  if (isNaN(s) || isNaN(e)) return null
  return Math.max(0, Math.floor((e - s) / 86400000))
}

function AgeBadge({ days, warn = 14, danger = 30 }) {
  if (days === null) return <span style={{ color: 'var(--dim)', fontSize: 12 }}>--</span>
  const c = days >= danger ? '#ef4444' : days >= warn ? '#f59e0b' : '#22c55e'
  return <span className="bdg" style={{ background: `${c}20`, color: c, border: `1px solid ${c}35` }}>{days}d</span>
}

function MiniBar({ val, max, color = '#6366f1' }) {
  const p = max > 0 ? Math.min(100, Math.round(val / max * 100)) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 3, height: 6, minWidth: 60 }}>
        <div style={{ width: `${p}%`, height: 6, borderRadius: 3, background: color, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 24 }}>{val}</span>
    </div>
  )
}

function StatCard({ num, label, color, sub }) {
  return (
    <div className="stat-box">
      <div className="stat-num" style={{ color }}>{num}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function SectionHeader({ icon: Icon, children }) {
  return (
    <div className="section-title-with-icon">
      {Icon ? (
        <span className="section-title-icon" aria-hidden="true">
          <Icon size={16} strokeWidth={1.8} />
        </span>
      ) : null}
      <span>{children}</span>
    </div>
  )
}

// ══════════════════════════════════════
// REFERRAL AGING
// ══════════════════════════════════════
export function ReferralAgingPage({ refs, assessData = [], onSelectRef }) {
  const active = refs.filter(r => isActiveReferralWork(r, assessData))
  const WARN = 14, DANGER = 30

  const aged = active.map(r => {
    const received  = r.referral_received_date || r.date_received || null
    const daysTotal = daysSince(received)
    const daysAwaitPW  = !['signed','completed'].includes((r.intake_paperwork || '').toLowerCase()) ? daysSince(received) : null
    const daysAwaitIns = needsInsuranceVerification(r.insurance_verified) ? daysSince(received) : null
    const daysToActive = r.active_client_date ? daysBetween(received, r.active_client_date) : null
    return { ...r, received, daysTotal, daysAwaitPW, daysAwaitIns, daysToActive }
  }).filter(r => r.received)

  const stalled     = aged.filter(r => r.daysTotal >= DANGER)
  const avgDays     = aged.length ? Math.round(aged.reduce((s, r) => s + (r.daysTotal || 0), 0) / aged.length) : 0
  const completed   = aged.filter(r => r.daysToActive !== null)
  const avgToActive = completed.length ? Math.round(completed.reduce((s, r) => s + r.daysToActive, 0) / completed.length) : null
  const longest     = aged.reduce((max, r) => (r.daysTotal || 0) > (max.daysTotal || 0) ? r : max, aged[0] || {})
  const sorted      = [...aged].sort((a, b) => (b.daysTotal || 0) - (a.daysTotal || 0))

  return (
    <>
      <div className="pg-hdr">
        <div className="pg-hdr-title">Referral Aging</div>
        <div className="pg-hdr-sub">
          How long referrals have been in the system. &nbsp;
          <span style={{ color: '#22c55e' }}>● &lt;{WARN}d</span>
          <span style={{ marginLeft: 8, color: '#f59e0b' }}>● {WARN}–{DANGER}d</span>
          <span style={{ marginLeft: 8, color: '#ef4444' }}>● {DANGER}d+</span>
        </div>
      </div>

      <div className="stats-row stats-4" style={{ marginBottom: 22 }}>
        <StatCard num={aged.length}               label="Referrals with Dates"  color="#6366f1" sub="date received on record" />
        <StatCard num={avgDays + 'd'}              label="Avg. Time in System"   color="#f59e0b" sub="across all active" />
        <StatCard num={stalled.length}             label="Stalled (30d+)"        color="#ef4444" sub="need immediate attention" />
        <StatCard num={avgToActive !== null ? avgToActive + 'd' : '--'} label="Avg. to Active Client" color="#22c55e" sub="referral → services" />
      </div>

      {aged.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>No date data yet</div>
          <div style={{ fontSize: 13 }}>Add date_received to records to enable aging reports.</div>
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>All Active Referrals — Sorted by Age</div>
            {longest.first_name && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Longest waiting: <strong style={{ color: '#ef4444' }}>{longest.first_name} {longest.last_name}</strong> ({longest.daysTotal}d)</div>}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client</th><th>Stage</th><th>Staff</th><th>Date Received</th><th>Days in System</th><th>Awaiting Paperwork</th><th>Awaiting Insurance</th><th>Days to Active</th></tr></thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r.id} className="row-hover" onClick={() => onSelectRef(r.id)}>
                    <td><div style={{ fontWeight: 700 }}>{r.first_name} {r.last_name}</div><div style={{ fontSize: 11, color: 'var(--dim)' }}>{r.office || ''}</div></td>
                    <td><StagePill stage={getReferralStage(r)} /></td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.intake_personnel || '--'}</td>
                    <td style={{ fontSize: 11, color: 'var(--dim)' }}>{r.received || '--'}</td>
                    <td><AgeBadge days={r.daysTotal} warn={WARN} danger={DANGER} /></td>
                    <td>{r.daysAwaitPW !== null ? <AgeBadge days={r.daysAwaitPW} warn={WARN} danger={DANGER} /> : <span style={{ color: '#22c55e', fontSize: 12 }}>Done</span>}</td>
                    <td>{r.daysAwaitIns !== null ? <AgeBadge days={r.daysAwaitIns} warn={WARN} danger={DANGER} /> : <span style={{ color: '#22c55e', fontSize: 12 }}>Done</span>}</td>
                    <td>{r.daysToActive !== null ? <span style={{ color: '#22c55e', fontSize: 12 }}>{r.daysToActive}d</span> : <span style={{ color: 'var(--dim)', fontSize: 12 }}>--</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// ══════════════════════════════════════
// CLINIC VOLUME
// ══════════════════════════════════════
const OFFICE_COLORS = { 'MERIDIAN': '#6366f1', 'FOREST': '#22c55e', 'FLOWOOD': '#f59e0b', 'DAY TREATMENT': '#fb923c' }

export function ClinicVolumePage({ refs, assessData = [] }) {
  const active  = refs.filter(r => isActiveReferralWork(r, assessData))
  const nr      = refs.filter(r => r.status === 'non-responsive' || r.status === 'referred-out')
  const all     = [...active, ...nr]
  const offices = ['MERIDIAN','FOREST','FLOWOOD','DAY TREATMENT']

  const stats = offices.map(o => ({
    office: o, color: OFFICE_COLORS[o] || '#64748b',
    total:    all.filter(r => normalizeOffice(r.office) === o).length,
    open:     active.filter(r => normalizeOffice(r.office) === o).length,
    nr:       nr.filter(r => normalizeOffice(r.office) === o).length,
    signed:   active.filter(r => normalizeOffice(r.office) === o && (r.intake_paperwork || '').toLowerCase().includes('signed')).length,
    verified: active.filter(r => normalizeOffice(r.office) === o && isInsuranceVerified(r.insurance_verified)).length,
  })).filter(s => s.total > 0).sort((a, b) => b.total - a.total)

  const maxTotal  = Math.max(...stats.map(s => s.total), 1)
  const topClinic = stats[0]

  const months = {}
  all.forEach(r => {
    const d = r.date_received || r.referral_received_date
    if (!d) return
    const key = d.slice(0, 7)
    if (!months[key]) months[key] = {}
    const o = normalizeOffice(r.office) || 'Other'
    months[key][o] = (months[key][o] || 0) + 1
  })
  const monthKeys = Object.keys(months).sort().slice(-6)

  return (
    <>
      <div className="pg-hdr">
        <div className="pg-hdr-title">Clinic Referral Volume</div>
        <div className="pg-hdr-sub">Referral counts, open intake volume, and monthly trends by clinic</div>
      </div>

      {topClinic && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '16px 20px', marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Highest Volume Clinic</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: topClinic.color }}>{topClinic.office}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{topClinic.total} total referrals · {topClinic.open} currently open</div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[['Signed', topClinic.signed, '#22c55e'], ['Ins. Verified', topClinic.verified, '#a5b4fc'], ['Non-Responsive', topClinic.nr, '#ef4444']].map(([l, v, c]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="responsive-auto-grid" style={{ marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={s.office} className="stat-box" style={{ borderTop: i === 0 ? `3px solid ${s.color}` : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div className="stat-num" style={{ color: s.color }}>{s.total}</div>
              {i === 0 && <span style={{ fontSize: 9, fontWeight: 700, color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}30`, borderRadius: 4, padding: '2px 6px' }}>TOP</span>}
            </div>
            <div className="stat-label">{s.office}</div>
            <div className="stat-sub">{s.open} open · {s.nr} NR</div>
          </div>
        ))}
      </div>

      <div className="responsive-two-col">
        <div className="card card-pad">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Open Referrals by Clinic</div>
          {stats.map(s => (
            <div key={s.office} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: s.color }}>{s.office}</span>
                <span style={{ fontSize: 11, color: 'var(--dim)' }}>{s.open} open of {s.total} total</span>
              </div>
              {[['Open Referrals', s.open, s.color], ['Paperwork Signed', s.signed, '#22c55e'], ['Ins. Verified', s.verified, '#a5b4fc'], ['Non-Responsive', s.nr, '#ef4444']].map(([l, v, c]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', width: 100, flexShrink: 0 }}>{l}</span>
                  <MiniBar val={v} max={maxTotal} color={c} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="card card-pad">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Monthly Volume by Clinic</div>
          {monthKeys.length === 0 ? (
            <div style={{ color: 'var(--dim)', fontSize: 13, textAlign: 'center', padding: 20 }}>No date data yet.</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {offices.filter(o => stats.find(s => s.office === o)).map(o => (
                  <span key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: OFFICE_COLORS[o], display: 'inline-block' }} />{o}
                  </span>
                ))}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--dim)', fontSize: 10, borderBottom: '1px solid var(--border)' }}>Month</th>
                  {offices.filter(o => stats.find(s => s.office === o)).map(o => (
                    <th key={o} style={{ textAlign: 'center', padding: '6px 8px', color: OFFICE_COLORS[o], fontSize: 10, borderBottom: '1px solid var(--border)' }}>{o.split(' ')[0]}</th>
                  ))}
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--dim)', fontSize: 10, borderBottom: '1px solid var(--border)' }}>TOTAL</th>
                </tr></thead>
                <tbody>
                  {monthKeys.map(m => {
                    const [y, mo] = m.split('-')
                    const label = new Date(parseInt(y), parseInt(mo) - 1).toLocaleString('default', { month: 'short', year: '2-digit' })
                    const rowTotal = Object.values(months[m]).reduce((s, v) => s + v, 0)
                    return (
                      <tr key={m} style={{ borderBottom: '1px solid #0a1525' }}>
                        <td style={{ padding: '7px 8px', color: 'var(--muted)' }}>{label}</td>
                        {offices.filter(o => stats.find(s => s.office === o)).map(o => (
                          <td key={o} style={{ textAlign: 'center', padding: '7px 8px', fontWeight: months[m][o] ? 600 : 400, color: months[m][o] ? OFFICE_COLORS[o] : 'var(--dim)' }}>
                            {months[m][o] || '--'}
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', padding: '7px 8px', fontWeight: 700, color: 'var(--text)' }}>{rowTotal}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════
// CONVERSION RATE
// ══════════════════════════════════════
export function ConversionRatePage({ refs, assessData = [] }) {
  const active = refs.filter(r => isActiveReferralWork(r, assessData))
  const nr     = refs.filter(r => r.status === 'non-responsive' || r.status === 'referred-out')
  const all    = [...active, ...nr]
  const total  = all.length
  const activeClientCount = assessData.filter(record => isAssessmentActiveClient(record)).length

  const FUNNEL = [
    { label: 'Referral Received',         count: total,                                                                                                      color: '#6366f1' },
    { label: 'Paperwork Completed',        count: active.filter(r => ['signed','completed'].some(v => (r.intake_paperwork||'').toLowerCase().includes(v))).length, color: '#8b5cf6' },
    { label: 'Insurance Verified',         count: active.filter(r => isInsuranceVerified(r.insurance_verified)).length,                             color: '#f59e0b' },
    { label: 'Parent Interview Completed', count: active.filter(r => normalizeParentInterviewStatus(r.parent_interview_status || r.permission_assessment) === 'Completed').length, color: '#fb923c' },
    { label: 'Assessment Completed',       count: active.filter(r => normalizeAutismDx(r.autism_diagnosis) === 'Received').length,                    color: '#fb923c' },
    { label: 'Active Client',              count: activeClientCount,                                                                                         color: '#22c55e' },
  ]

  let maxDrop = -1, maxDropIdx = 0
  FUNNEL.forEach((step, i) => {
    if (i === 0) return
    const drop = FUNNEL[i - 1].count - step.count
    if (drop > maxDrop) { maxDrop = drop; maxDropIdx = i }
  })

  const convRate = total > 0 ? Math.round(FUNNEL[5].count / total * 100) : 0
  const paRate   = total > 0 ? Math.round(active.filter(r => ['PA Approved', 'Active Client'].includes(getReferralStage(r))).length / total * 100) : 0
  const dropRate = total > 0 ? Math.round(nr.length / total * 100) : 0

  return (
    <>
      <div className="pg-hdr">
        <div className="pg-hdr-title">Conversion Rate</div>
        <div className="pg-hdr-sub">Where families enter the pipeline — and where they are lost</div>
      </div>

      <div className="stats-row stats-3" style={{ marginBottom: 20 }}>
        <StatCard num={total}         label="Total Referrals"        color="#6366f1" sub="all time" />
        <StatCard num={FUNNEL[5].count} label="Active Clients"       color="#22c55e" sub="receiving services" />
        <StatCard num={convRate + '%'} label="Referral → Active Rate" color="#f59e0b" sub={`${FUNNEL[5].count} of ${total} referrals`} />
      </div>

      {maxDrop > 0 && (
        <div style={{ background: '#ef444412', border: '1px solid #ef444430', borderRadius: 12, padding: '14px 20px', marginBottom: 20 }}>
          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>
            Biggest drop-off: {FUNNEL[maxDropIdx - 1].label} to {FUNNEL[maxDropIdx].label} ({maxDrop} referrals lost)
          </span>
        </div>
      )}

      <div className="responsive-two-col">
        <div className="card card-pad">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Intake Funnel</div>
          {FUNNEL.map((step, i) => {
            const pct = total > 0 ? Math.round(step.count / total * 100) : 0
            return (
              <div key={step.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{step.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: step.color }}>{step.count} ({pct}%)</span>
                </div>
                <div style={{ background: 'var(--surface2)', borderRadius: 4, height: 8 }}>
                  <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: step.color, transition: 'width 0.5s' }} />
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Drop-off Analysis</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--dim)', fontSize: 10, borderBottom: '1px solid var(--border)' }}>Stage</th>
                <th style={{ textAlign: 'center', padding: '6px 0', color: 'var(--dim)', fontSize: 10, borderBottom: '1px solid var(--border)' }}>Count</th>
                <th style={{ textAlign: 'center', padding: '6px 0', color: 'var(--dim)', fontSize: 10, borderBottom: '1px solid var(--border)' }}>Lost</th>
                <th style={{ textAlign: 'center', padding: '6px 0', color: 'var(--dim)', fontSize: 10, borderBottom: '1px solid var(--border)' }}>Drop %</th>
              </tr></thead>
              <tbody>
                {FUNNEL.map((step, i) => {
                  const lost    = i === 0 ? 0 : FUNNEL[i - 1].count - step.count
                  const lostPct = i === 0 ? 0 : FUNNEL[i - 1].count > 0 ? Math.round(lost / FUNNEL[i - 1].count * 100) : 0
                  const isBig   = i === maxDropIdx && maxDrop > 0
                  return (
                    <tr key={step.label}>
                      <td style={{ padding: '7px 0', color: isBig ? '#ef4444' : 'var(--muted)', fontSize: 11 }}>{step.label.split(' ').slice(0, 2).join(' ')}</td>
                      <td style={{ textAlign: 'center', padding: '7px 0', fontWeight: 700, color: step.color }}>{step.count}</td>
                      <td style={{ textAlign: 'center', padding: '7px 0', color: lost > 0 ? '#ef4444' : 'var(--dim)' }}>{lost > 0 ? `-${lost}` : '--'}</td>
                      <td style={{ textAlign: 'center', padding: '7px 0', color: isBig ? '#ef4444' : lostPct > 20 ? '#f59e0b' : 'var(--dim)', fontWeight: isBig ? 700 : 400 }}>{lostPct > 0 ? `${lostPct}%` : '--'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Other Metrics</div>
            <div className="info-row"><span className="info-label">PA Approval Rate</span><span style={{ color: '#22c55e', fontWeight: 700 }}>{paRate}%</span></div>
            <div className="info-row"><span className="info-label">Non-Responsive Rate</span><span style={{ color: '#ef4444', fontWeight: 700 }}>{dropRate}%</span></div>
            <div className="info-row"><span className="info-label">Non-Responsive Count</span><span style={{ color: '#ef4444', fontWeight: 700 }}>{nr.length}</span></div>
            <div className="info-row" style={{ border: 'none' }}><span className="info-label">Referred Out</span><span style={{ color: '#8b5cf6', fontWeight: 700 }}>{nr.filter(r => r.status === 'referred-out').length}</span></div>
          </div>
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════
// INTAKE PERFORMANCE
// ══════════════════════════════════════
export function IntakePerformancePage({ refs, assessData = [] }) {
  const active     = refs.filter(r => isActiveReferralWork(r, assessData))
  const STAFF_LIST = [...new Set(active.map(r => normalizeStaffName(r.intake_personnel)).filter(Boolean))].sort()

  const perf = STAFF_LIST.map(staff => {
    const mine     = active.filter(r => normalizeStaffName(r.intake_personnel) === normalizeStaffName(staff))
    const signed   = mine.filter(r => (r.intake_paperwork || '').toLowerCase().includes('signed')).length
    const verified = mine.filter(r => isInsuranceVerified(r.insurance_verified)).length
    const dxRecvd  = mine.filter(r => normalizeAutismDx(r.autism_diagnosis) === 'Received').length
    const activeC  = mine.filter(r => Boolean(r.active_client_date)).length
    const pending  = mine.filter(r => !['signed','completed'].includes((r.intake_paperwork || '').toLowerCase())).length
    const score    = mine.length > 0 ? Math.round(((signed + verified + dxRecvd) / ((mine.length * 3) || 1)) * 100) : 0
    return { staff: displayStaffName(staff), total: mine.length, signed, verified, dxRecvd, active: activeC, pending, score }
  })

  const totalActive   = active.length
  const totalSigned   = active.filter(r => (r.intake_paperwork || '').toLowerCase().includes('signed')).length
  const totalVerified = active.filter(r => isInsuranceVerified(r.insurance_verified)).length
  const overallScore  = totalActive > 0 ? Math.round(((totalSigned + totalVerified) / (totalActive * 2)) * 100) : 0

  const months = {}
  active.forEach(r => {
    const d = r.date_received || r.referral_received_date
    if (!d) return
    const key = d.slice(0, 7)
    months[key] = (months[key] || 0) + 1
  })
  const monthKeys = Object.keys(months).sort().slice(-6)
  const maxM = Math.max(...monthKeys.map(m => months[m]), 1)

  return (
    <>
      <div className="pg-hdr">
        <div className="pg-hdr-title">Intake Performance</div>
        <div className="pg-hdr-sub">Staff productivity, completion rates, and monthly intake trends</div>
      </div>

      <div className="stats-row stats-4" style={{ marginBottom: 24 }}>
        <StatCard num={totalActive}    label="Total Active"       color="#6366f1" />
        <StatCard num={totalSigned}    label="Paperwork Signed"   color="#22c55e" sub={Math.round(totalSigned / totalActive * 100 || 0) + '% completion'} />
        <StatCard num={totalVerified}  label="Insurance Verified" color="#f59e0b" sub={Math.round(totalVerified / totalActive * 100 || 0) + '% completion'} />
        <StatCard num={overallScore + '%'} label="Overall Score"  color="#8b5cf6" sub="signed + verified" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Staff Performance</div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Staff Member</th><th>Assigned</th><th>Paperwork Signed</th><th>Insurance Verified</th><th>Dx Received</th><th>Active Clients</th><th>Pending Docs</th><th>Score</th></tr></thead>
              <tbody>
                {perf.sort((a, b) => b.score - a.score).map(p => {
                  const scoreColor = p.score >= 80 ? '#22c55e' : p.score >= 50 ? '#f59e0b' : '#ef4444'
                  return (
                    <tr key={p.staff}>
                      <td style={{ fontWeight: 700 }}>{p.staff}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.total}</td>
                      <td><MiniBar val={p.signed}   max={p.total} color="#22c55e" /></td>
                      <td><MiniBar val={p.verified} max={p.total} color="#f59e0b" /></td>
                      <td><MiniBar val={p.dxRecvd}  max={p.total} color="#a5b4fc" /></td>
                      <td style={{ fontSize: 12, color: '#22c55e' }}>{p.active}</td>
                      <td>{p.pending > 0 ? <span className="bdg" style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b30' }}>{p.pending}</span> : <span style={{ color: '#22c55e', fontSize: 12 }}>Clear</span>}</td>
                      <td><span style={{ fontSize: 14, fontWeight: 800, color: scoreColor }}>{p.score}%</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Monthly Intake Trend</div>
        {monthKeys.length === 0 ? (
          <div style={{ color: 'var(--dim)', fontSize: 13, textAlign: 'center', padding: 20 }}>No date data available yet.</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, paddingTop: 8 }}>
            {monthKeys.map(m => {
              const [y, mo] = m.split('-')
              const label = new Date(parseInt(y), parseInt(mo) - 1).toLocaleString('default', { month: 'short' })
              const h = Math.round(months[m] / maxM * 70)
              return (
                <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{months[m]}</span>
                  <div style={{ width: '100%', height: h, background: '#6366f1', borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height 0.5s' }} />
                  <span style={{ fontSize: 10, color: 'var(--dim)' }}>{label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
