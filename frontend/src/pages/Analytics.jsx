import { useState, useEffect, useRef } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import Layout from '../components/Layout'
import { dashboardApi } from '../services/api'
import { generateReportPDF } from '../utils/generatePDF'
import { PhoneIcon, SpinnerIcon } from '../components/Icons'

/* ── Options ── */
const CHART_DAYS = [
  { value: 7,  label: '7d'  },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
]
const PERIODS = [
  { value: 'week',  label: 'Last 7 Days'   },
  { value: 'month', label: 'Last 30 Days'  },
  { value: 'year',  label: 'Last 12 Months'},
]

/* ── Icons ── */
function DownloadIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}
function TrendIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  )
}
function CalendarIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function CheckIcon({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function PhoneCallIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.5 16.5z"/>
    </svg>
  )
}
function WalkInIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2"/>
      <path d="M12 22V12m0 0l-3 4m3-4l3 4M8.5 8.5C9.5 7 11 6 12 6s2.5 1 3.5 2.5L17 12h-5"/>
    </svg>
  )
}

/* ── Custom chart tooltip ── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(27,28,29,0.10)',
      fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-1)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--primary)', marginTop: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

/* ── Progress bar row ── */
function ProgressRow({ label, value, total, color, textColor }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: textColor || color }}>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 99,
          background: color,
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  )
}

/* ── Small metric card ── */
function MetricCard({ label, value, sub, color, progress }) {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-3)', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Noto Serif, Georgia, serif', fontSize: 32, fontWeight: 700, color: color || 'var(--text-1)', lineHeight: 1.1, marginBottom: 4 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: progress != null ? 12 : 0 }}>{sub}</div>}
      {progress != null && (
        <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden', marginTop: 8 }}>
          <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, borderRadius: 99, background: color || 'var(--primary)', transition: 'width 0.8s ease' }} />
        </div>
      )}
    </div>
  )
}

/* ── Skeleton ── */
function Skel({ w, h, r = 8 }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r }} />
}

export default function Analytics() {
  const [callData,    setCallData]    = useState(null)
  const [statsData,   setStatsData]   = useState(null)
  const [days,        setDays]        = useState(7)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [dlPeriod,    setDlPeriod]    = useState('week')
  const [downloading, setDownloading] = useState(false)
  const [dlSuccess,   setDlSuccess]   = useState(false)
  const [cardFilter,       setCardFilter]       = useState({ mode: 'days', value: 7 })
  const [cardCallData,     setCardCallData]     = useState(null)
  const [cardLoading,      setCardLoading]      = useState(true)
  const [calendarDate,     setCalendarDate]     = useState('')
  const [cardCalendarDate, setCardCalendarDate] = useState('')
  const calInputRef     = useRef(null)
  const cardCalInputRef = useRef(null)

  const computeDays = (dateStr) =>
    Math.max(1, Math.ceil((new Date() - new Date(dateStr + 'T00:00:00')) / (1000 * 60 * 60 * 24)))

  const fetchData = (isBackground = false) => {
    if (isBackground) setRefreshing(true)
    else setLoading(true)
    return Promise.all([dashboardApi.calls(days), dashboardApi.stats(days)])
      .then(([callsRes, statsRes]) => {
        setCallData(callsRes.data)
        setStatsData(statsRes.data)
        setLastUpdated(new Date())
      })
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    fetchData(false)
    const interval = setInterval(() => fetchData(true), 30000)
    return () => clearInterval(interval)
  }, [days])

  useEffect(() => {
    setCardLoading(true)
    setCardCallData(null)
    const req = cardFilter.mode === 'hours'
      ? dashboardApi.calls(7, cardFilter.value)
      : dashboardApi.calls(cardFilter.value)
    req.then(res => setCardCallData(res.data))
       .catch(console.error)
       .finally(() => setCardLoading(false))
  }, [cardFilter])

  const handleDownload = async () => {
    setDownloading(true)
    setDlSuccess(false)
    try {
      const res = await dashboardApi.report(dlPeriod)
      await generateReportPDF(res.data)
      setDlSuccess(true)
      setTimeout(() => setDlSuccess(false), 3000)
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('Failed to generate report. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  /* ── Derived stats ── */
  const orders         = statsData?.orders ?? []
  const phoneOrders    = orders.filter(o => o.call_sid).length
  const walkInOrders   = orders.filter(o => !o.call_sid).length
  const completedOrds  = statsData?.completed_orders ?? orders.filter(o => o.status === 'picked_up').length
  const totalOrders    = (statsData?.total_orders_today ?? orders.length) || 1
  const completionRate = callData?.completion_rate ?? 0
  const avgDuration    = callData?.avg_duration_seconds ?? 0
  const totalCalls     = callData?.total_calls ?? 0

  /* ── Dynamic insight ── */
  const insightRate = completionRate
  const insightHeadline = insightRate >= 75
    ? `Your AI is completing ${insightRate}% of all calls`
    : insightRate >= 50
    ? `AI completion rate at ${insightRate}% — room to grow`
    : `${totalCalls} calls handled this period`
  const insightBody = insightRate >= 75
    ? 'Strong AI performance. Most callers are completing their orders without dropping off — a sign your menu and AI prompts are well-tuned.'
    : insightRate >= 50
    ? 'Moderate completion rate detected. Consider reviewing your menu item descriptions and AI response flow to reduce drop-offs.'
    : 'Your AI is handling calls and capturing orders. Monitor for trends as more data accumulates over the coming days.'

  return (
    <Layout>
      <div className="page-enter" style={{ padding: '28px 28px 40px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ════════════════════════════════════════
            HEADER
        ════════════════════════════════════════ */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--primary)' }}>
                AI Voice Analytics
              </div>
              {/* Live indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 99, padding: '2px 8px' }}>
                <span className={refreshing ? '' : 'live-dot'} style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0, ...(refreshing ? { animation: 'spin 0.8s linear infinite', borderTop: '2px solid #10b981', borderRight: '2px solid transparent', background: 'transparent' } : {}) }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', letterSpacing: '0.04em' }}>
                  {refreshing ? 'Updating…' : 'Live'}
                </span>
              </div>
            </div>
            <h1 style={{ fontFamily: 'Noto Serif, Georgia, serif', fontSize: 30, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>
              Performance Analytics
            </h1>
            {lastUpdated && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Period pills */}
            <div style={{ display: 'flex', background: 'var(--surface-3)', borderRadius: 10, padding: 3, gap: 2 }}>
              {CHART_DAYS.map(d => (
                <button
                  key={d.value}
                  onClick={() => { setDays(d.value); setCalendarDate('') }}
                  style={{
                    padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, transition: 'all 0.15s ease',
                    background: days === d.value && !calendarDate ? '#fff' : 'transparent',
                    color: days === d.value && !calendarDate ? 'var(--primary)' : 'var(--text-3)',
                    boxShadow: days === d.value && !calendarDate ? '0 1px 4px rgba(27,28,29,0.10)' : 'none',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Calendar custom range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                ref={calInputRef}
                type="date"
                value={calendarDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => {
                  const d = e.target.value
                  setCalendarDate(d)
                  if (d) setDays(computeDays(d))
                }}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
              />
              <button
                onClick={() => calInputRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  background: calendarDate ? 'rgba(9,76,178,0.08)' : 'var(--surface-3)',
                  border: calendarDate ? '1.5px solid rgba(9,76,178,0.30)' : '1.5px solid transparent',
                  fontSize: 12, fontWeight: 600,
                  color: calendarDate ? '#094cb2' : 'var(--text-3)',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                <CalendarIcon size={12} />
                {calendarDate
                  ? new Date(calendarDate + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Custom date'}
              </button>
              {calendarDate && (
                <button onClick={() => { setCalendarDate(''); setDays(7) }}
                  style={{ background: 'rgba(0,0,0,0.08)', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 13, color: '#86868b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >×</button>
              )}
            </div>

            {/* Manual refresh */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              title="Refresh data"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 9, border: '1.5px solid var(--border)',
                background: 'var(--card-bg)', cursor: 'pointer', color: 'var(--text-3)',
                transition: 'all 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)' }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>

            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #094cb2, #3366cc)',
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(9,76,178,0.30)',
                opacity: downloading ? 0.7 : 1,
              }}
            >
              {downloading ? <SpinnerIcon size={12} /> : <DownloadIcon size={12} />}
              {dlSuccess ? 'Downloaded!' : downloading ? 'Generating…' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════
            MAIN CALL VOLUME CARD
        ════════════════════════════════════════ */}
        <div className="card" style={{ padding: '28px 32px', marginBottom: 20 }}>
          {loading ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skel w={140} h={14} />
                  <Skel w={80}  h={40} r={6} />
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <Skel w={100} h={14} />
                  <Skel w={60}  h={28} r={6} />
                </div>
              </div>
              <Skel w="100%" h={200} />
            </div>
          ) : callData && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 6, margin: '0 0 6px' }}>
                    Call Volume — last {days} days
                  </p>
                  <div style={{ fontFamily: 'Noto Serif, Georgia, serif', fontSize: 40, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {totalCalls.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    calls received via AI phone line
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Noto Serif, Georgia, serif', fontSize: 30, fontWeight: 700, color: '#094cb2', lineHeight: 1 }}>
                    {completionRate}%
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 12, fontWeight: 600, color: completionRate >= 70 ? '#059669' : completionRate >= 50 ? '#d97706' : '#dc2626' }}>
                    <TrendIcon />
                    {completionRate >= 70 ? 'Strong' : completionRate >= 50 ? 'Moderate' : 'Low'} completion rate
                  </div>
                </div>
              </div>

              {/* Area chart with gradient */}
              <defs>
                <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#094cb2" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#094cb2" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={callData.calls_by_date} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="callAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor="#094cb2" stopOpacity={0.18}/>
                      <stop offset="100%" stopColor="#094cb2" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 0" stroke="var(--surface-3)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#938f99' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#938f99' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Calls"
                    stroke="#094cb2"
                    strokeWidth={2.5}
                    fill="url(#callAreaFill)"
                    dot={{ fill: '#094cb2', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: '#094cb2', strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* ════════════════════════════════════════
            ROW 2: Call Stats + Order Breakdown
        ════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Call Performance */}
          <div className="card" style={{ padding: '24px 24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PhoneCallIcon size={17} style={{ color: '#15803d' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>Call Inquiries</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
                  {cardFilter.mode === 'hours' ? `Last ${cardFilter.value}h` : `Last ${cardFilter.value} days`}
                </div>
              </div>
            </div>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 2, gap: 1 }}>
                {[{ value: 7, label: '7d' }, { value: 14, label: '14d' }, { value: 30, label: '30d' }].map(f => {
                  const active = cardFilter.mode === 'days' && cardFilter.value === f.value && !cardCalendarDate
                  return (
                    <button key={f.label} onClick={() => { setCardCalendarDate(''); setCardFilter({ mode: 'days', value: f.value }) }}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
                        background: active ? '#fff' : 'transparent',
                        color: active ? '#094cb2' : 'var(--text-3)',
                        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                      }}>{f.label}</button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 2, gap: 1 }}>
                {[{ value: 6, label: '6h' }, { value: 12, label: '12h' }, { value: 24, label: '24h' }].map(f => {
                  const active = cardFilter.mode === 'hours' && cardFilter.value === f.value
                  return (
                    <button key={f.label} onClick={() => { setCardCalendarDate(''); setCardFilter({ mode: 'hours', value: f.value }) }}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
                        background: active ? '#f0fdf4' : 'transparent',
                        color: active ? '#059669' : 'var(--text-3)',
                        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      }}>{f.label}</button>
                  )
                })}
              </div>

              {/* Card calendar picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <input
                  ref={cardCalInputRef}
                  type="date"
                  value={cardCalendarDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => {
                    const d = e.target.value
                    setCardCalendarDate(d)
                    if (d) setCardFilter({ mode: 'days', value: computeDays(d) })
                  }}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
                />
                <button
                  onClick={() => cardCalInputRef.current?.click()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 9px', borderRadius: 6, cursor: 'pointer',
                    background: cardCalendarDate ? '#f0fdf4' : 'var(--surface-2)',
                    border: cardCalendarDate ? '1px solid #bbf7d0' : '1px solid transparent',
                    fontSize: 11, fontWeight: 600,
                    color: cardCalendarDate ? '#059669' : 'var(--text-3)',
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  <CalendarIcon size={11} />
                  {cardCalendarDate
                    ? new Date(cardCalendarDate + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
                    : 'Pick date'}
                </button>
                {cardCalendarDate && (
                  <button onClick={() => { setCardCalendarDate(''); setCardFilter({ mode: 'days', value: 7 }) }}
                    style={{ background: 'rgba(0,0,0,0.08)', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: 11, color: '#86868b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >×</button>
                )}
              </div>
            </div>

            {cardLoading ? (
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120 }}>
                {[60, 80, 100, 70, 90, 50, 75].map((h, i) => (
                  <div key={i} className="skeleton" style={{ flex: 1, height: h, borderRadius: 4 }} />
                ))}
              </div>
            ) : cardCallData && (
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={cardCallData.calls_by_date} barSize={14} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 0" stroke="var(--surface-3)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#938f99' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={tick => {
                      if (cardFilter.mode === 'hours') return tick  // already "14:00"
                      try {
                        return new Date(tick + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
                      } catch { return tick }
                    }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#938f99' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Calls"
                    fill={cardFilter.mode === 'hours' ? '#059669' : '#10b981'}
                    radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Bottom stats row */}
            {!cardLoading && cardCallData && (
              <div style={{ display: 'flex', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                {[
                  { label: 'Total',     value: cardCallData.total_calls,     color: 'var(--text-1)' },
                  { label: 'Completed', value: cardCallData.completed_calls, color: '#059669'       },
                  { label: 'Abandoned', value: cardCallData.abandoned_calls, color: '#dc2626'       },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order Breakdown */}
          <div className="card" style={{ padding: '24px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <WalkInIcon size={17} style={{ color: '#6d28d9' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>Order Volume</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Last {days} days breakdown</div>
              </div>
            </div>

            {/* Today's quick stats row */}
            {!loading && statsData && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Total',     value: statsData.total_orders_today ?? totalOrders, color: 'var(--text-1)' },
                  { label: 'Active',    value: statsData.active_orders ?? 0,    color: '#d97706' },
                  { label: 'Completed', value: statsData.completed_orders ?? 0, color: '#059669' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '10px 4px', background: 'var(--surface-2)', borderRadius: 10 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'Noto Serif, serif' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[1,2,3].map(i => <div key={i}><Skel w="100%" h={8} r={99} /></div>)}
              </div>
            ) : (
              <div style={{ marginTop: 4 }}>
                <ProgressRow label="Phone Orders"     value={phoneOrders}   total={totalOrders} color="#094cb2" textColor="#094cb2" />
                <ProgressRow label="Walk-in Orders"   value={walkInOrders}  total={totalOrders} color="#6d28d9" textColor="#6d28d9" />
                <ProgressRow label="Completed Today"  value={completedOrds} total={totalOrders} color="#059669" textColor="#059669" />
              </div>
            )}

            {/* Revenue today */}
            {!loading && statsData && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Revenue — last {days} days</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#094cb2', fontFamily: 'Noto Serif, serif' }}>
                  ${(statsData.revenue_today ?? 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════
            ROW 3: AI Insight + Metric Cards
        ════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* AI Performance Insight */}
          <div className="card" style={{
            padding: '28px 28px',
            background: 'linear-gradient(135deg, #0a1628 0%, #0d2040 100%)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Background glow */}
            <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(9,76,178,0.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -20, left: -20, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(51,102,204,0.20) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(9,76,178,0.40)', border: '1px solid rgba(9,76,178,0.50)', borderRadius: 99, padding: '4px 12px', marginBottom: 16 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3366cc', boxShadow: '0 0 6px #3366cc', display: 'inline-block' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.70)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>Top Insight</span>
              </div>

              <h2 style={{ fontFamily: 'Noto Serif, Georgia, serif', fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 12, letterSpacing: '-0.01em' }}>
                {loading ? '...' : insightHeadline}
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', lineHeight: 1.65, marginBottom: 20 }}>
                {loading ? '...' : insightBody}
              </p>

              {!loading && callData && (
                <div style={{ display: 'flex', gap: 12 }}>
                  {/* Inline mini-stats */}
                  {[
                    { label: 'Completed',  value: callData.completed_calls, color: '#4ade80' },
                    { label: 'Abandoned',  value: callData.abandoned_calls, color: '#f87171' },
                    { label: 'Avg/call',   value: `${avgDuration}s`,         color: '#93c5fd' },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: two stacked metric cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {loading ? (
              <>
                <div className="card" style={{ flex: 1 }}><Skel w="60%" h={14} /><div style={{ marginTop: 12 }}><Skel w="40%" h={36} r={6} /></div></div>
                <div className="card" style={{ flex: 1 }}><Skel w="60%" h={14} /><div style={{ marginTop: 12 }}><Skel w="40%" h={36} r={6} /></div></div>
              </>
            ) : (
              <>
                <MetricCard
                  label="Avg. Call Duration"
                  value={`${avgDuration}s`}
                  sub={avgDuration > 0 ? (avgDuration < 90 ? 'Quick & efficient' : avgDuration < 180 ? 'Typical length' : 'Longer calls') : 'No data yet'}
                  color="#094cb2"
                  progress={Math.min((avgDuration / 300) * 100, 100)}
                />
                <MetricCard
                  label="Completion Rate"
                  value={`${completionRate}%`}
                  sub={completionRate >= 70 ? 'Excellent performance' : completionRate >= 50 ? 'Good, improving' : 'Needs attention'}
                  color={completionRate >= 70 ? '#059669' : completionRate >= 50 ? '#d97706' : '#dc2626'}
                  progress={completionRate}
                />
              </>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════
            DOWNLOAD REPORT
        ════════════════════════════════════════ */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #e8eef8 0%, #eef3fa 100%)', padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <DownloadIcon size={15} />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>Download Business Report</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 400, lineHeight: 1.6, margin: '0 0 16px' }}>
                Export a full PDF including order history, revenue breakdown, call analytics, and daily performance — ready for your team or accountant.
              </p>

              {/* Period pills */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {PERIODS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setDlPeriod(p.value)}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: '1.5px solid',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                      background:   dlPeriod === p.value ? '#094cb2'  : '#fff',
                      color:        dlPeriod === p.value ? '#fff'     : '#475569',
                      borderColor:  dlPeriod === p.value ? '#094cb2'  : '#c2d4ef',
                      boxShadow:    dlPeriod === p.value ? '0 2px 8px rgba(9,76,178,0.25)' : 'none',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Checklist */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', maxWidth: 380 }}>
                {['Order summary & revenue','AI call analytics','Daily call volume table','Revenue by date','Full order history','Payment status breakdown'].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0741a3' }}>
                    <span style={{ color: '#094cb2', flexShrink: 0 }}><CheckIcon size={10} /></span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Download CTA */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 4 }}>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="btn-primary"
                style={{ padding: '13px 28px', fontSize: 14, minWidth: 160 }}
              >
                {downloading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SpinnerIcon size={15} /> Generating…
                  </span>
                ) : dlSuccess ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckIcon size={13} /> Downloaded!
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DownloadIcon size={14} /> Download PDF
                  </span>
                )}
              </button>
              <span style={{ fontSize: 11, color: '#094cb2', fontWeight: 500 }}>
                {PERIODS.find(p => p.value === dlPeriod)?.label}
              </span>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  )
}
