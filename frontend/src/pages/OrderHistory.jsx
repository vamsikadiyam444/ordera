import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { ordersApi } from '../services/api'

/* ─── STATUS CONFIG ─────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  new:       { label: 'New',       color: '#FF9F0A', bg: 'rgba(255,159,10,0.10)',  icon: '●', glow: 'rgba(255,159,10,0.25)' },
  confirmed: { label: 'Confirmed', color: '#30D158', bg: 'rgba(48,209,88,0.10)',   icon: '◉', glow: 'rgba(48,209,88,0.18)' },
  preparing: { label: 'Preparing', color: '#FF6B35', bg: 'rgba(255,107,53,0.10)',  icon: '◎', glow: 'rgba(255,107,53,0.18)' },
  ready:     { label: 'Ready',     color: '#32D74B', bg: 'rgba(50,215,75,0.10)',   icon: '◈', glow: 'rgba(50,215,75,0.20)' },
  picked_up: { label: 'Picked Up', color: '#86868b', bg: 'rgba(134,134,139,0.08)', icon: '✓', glow: 'transparent' },
  cancelled: { label: 'Cancelled', color: '#FF453A', bg: 'rgba(255,69,58,0.08)',   icon: '✕', glow: 'transparent' },
}

const AUTO_CONFIRM_SECONDS = 60  // Must match backend

const NEXT_STATUS = { new: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'picked_up' }
const NEXT_LABEL  = { new: 'Confirm Order', confirmed: 'Start Preparing', preparing: 'Mark Ready', ready: 'Mark Picked Up' }

const FILTER_TABS = [
  { key: '',          label: 'All Orders' },
  { key: 'new',       label: 'New' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready',     label: 'Ready' },
  { key: 'picked_up', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

/* ─── ICONS ─────────────────────────────────────────────────────────────────── */
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  )
}
function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}
function ChevronIcon({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function RefreshIcon({ spinning }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ animation: spinning ? 'spin 0.8s linear infinite' : 'none' }}>
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}
function NoteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}
function PrinterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
    </svg>
  )
}

/* ─── AUTO-CONFIRM COUNTDOWN RING ───────────────────────────────────────────── */
function CountdownRing({ createdAt }) {
  const [remaining, setRemaining] = useState(() => {
    const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000
    return Math.max(0, AUTO_CONFIRM_SECONDS - elapsed)
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000
      const r = Math.max(0, AUTO_CONFIRM_SECONDS - elapsed)
      setRemaining(r)
      if (r <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [createdAt])

  const pct = remaining / AUTO_CONFIRM_SECONDS
  const secs = Math.ceil(remaining)
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - pct)
  const urgent = secs <= 15
  const ringColor = urgent ? '#FF453A' : '#FF9F0A'

  if (secs <= 0) return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600, color: '#30D158',
      animation: 'fadeIn 0.3s ease',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Auto-confirmed
    </div>
  )

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px 6px 8px',
      borderRadius: 12,
      background: urgent ? 'rgba(255,69,58,0.06)' : 'rgba(255,159,10,0.06)',
      border: `1px solid ${urgent ? 'rgba(255,69,58,0.12)' : 'rgba(255,159,10,0.1)'}`,
      transition: 'all 0.3s ease',
    }}>
      <svg width="42" height="42" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)' }}>
        {/* Background track */}
        <circle cx="21" cy="21" r={radius} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3"/>
        {/* Progress ring */}
        <circle cx="21" cy="21" r={radius} fill="none"
          stroke={ringColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
        />
        {/* Center text */}
        <text x="21" y="22" textAnchor="middle" dominantBaseline="central"
          fill={ringColor}
          fontSize="12" fontWeight="700"
          style={{ transform: 'rotate(90deg)', transformOrigin: '21px 21px' }}
        >
          {secs}
        </text>
      </svg>
      <div>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: urgent ? '#FF453A' : '#FF9F0A',
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}>
          {urgent ? 'Auto-confirming soon' : 'Auto-confirm in'}
        </div>
        <div style={{
          fontSize: 10, color: '#aeaeb2', fontWeight: 500, marginTop: 1,
        }}>
          {secs}s remaining
        </div>
      </div>
    </div>
  )
}

/* ─── 3D CARD STYLES (Apple depth system) ───────────────────────────────────── */
const card3D = {
  background: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: `
    0 0.5px 0 rgba(0,0,0,0.02),
    0 1px 2px rgba(0,0,0,0.03),
    0 4px 8px rgba(0,0,0,0.04),
    0 12px 32px rgba(0,0,0,0.06),
    0 24px 60px rgba(0,0,0,0.04),
    inset 0 1px 0 rgba(255,255,255,0.8)
  `,
  transition: 'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
}

const card3DHover = {
  transform: 'translateY(-2px) scale(1.003)',
  boxShadow: `
    0 0.5px 0 rgba(0,0,0,0.02),
    0 2px 4px rgba(0,0,0,0.04),
    0 8px 16px rgba(0,0,0,0.06),
    0 20px 48px rgba(0,0,0,0.08),
    0 32px 72px rgba(0,0,0,0.05),
    inset 0 1px 0 rgba(255,255,255,0.9)
  `,
}

/* ─── PROGRESS TIMELINE ────────────────────────────────────────────────────── */
const TIMELINE_STEPS = ['new', 'confirmed', 'preparing', 'ready', 'picked_up']

function OrderTimeline({ status }) {
  const idx = TIMELINE_STEPS.indexOf(status)
  const isCancelled = status === 'cancelled'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '8px 0' }}>
      {TIMELINE_STEPS.map((step, i) => {
        const done = !isCancelled && i <= idx
        const active = !isCancelled && i === idx
        const cfg = STATUS_CONFIG[step]
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < TIMELINE_STEPS.length - 1 ? 1 : 'none' }}>
            {/* Dot */}
            <div style={{
              width: active ? 14 : 10,
              height: active ? 14 : 10,
              borderRadius: '50%',
              background: done ? cfg.color : '#e5e7eb',
              boxShadow: active ? `0 0 0 4px ${cfg.glow}, 0 2px 8px ${cfg.glow}` : 'none',
              transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
              flexShrink: 0,
              position: 'relative',
            }}>
              {active && (
                <div style={{
                  position: 'absolute', inset: -4,
                  borderRadius: '50%',
                  border: `2px solid ${cfg.color}`,
                  opacity: 0.3,
                  animation: 'timelinePulse 2s ease-in-out infinite',
                }} />
              )}
            </div>
            {/* Line */}
            {i < TIMELINE_STEPS.length - 1 && (
              <div style={{
                flex: 1,
                height: 2,
                background: done && i < idx ? cfg.color : '#e5e7eb',
                borderRadius: 1,
                transition: 'background 0.4s ease',
                margin: '0 2px',
              }} />
            )}
          </div>
        )
      })}
      {isCancelled && (
        <div style={{
          marginLeft: 12,
          fontSize: 11,
          fontWeight: 600,
          color: '#FF453A',
          letterSpacing: '-0.01em',
        }}>
          Cancelled
        </div>
      )}
    </div>
  )
}

/* ─── STATS PILL ────────────────────────────────────────────────────────────── */
function StatPill({ label, value, color, glow }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '14px 20px',
      borderRadius: 16,
      background: 'rgba(255,255,255,0.6)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.4)',
      boxShadow: `0 2px 12px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)`,
      minWidth: 90,
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      cursor: 'default',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.06), 0 0 20px ${glow || 'transparent'}`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)'
      }}
    >
      <span style={{
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: '-0.03em',
        color: color || '#1d1d1f',
        lineHeight: 1,
      }}>{value}</span>
      <span style={{
        fontSize: 11,
        fontWeight: 500,
        color: '#86868b',
        marginTop: 4,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  )
}

/* ─── ORDER CARD ────────────────────────────────────────────────────────────── */
function OrderCard3D({ order, onStatusChange, onRefresh }) {
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.new
  const next = NEXT_STATUS[order.status]
  const isDone = order.status === 'picked_up' || order.status === 'cancelled'
  const isNew = order.status === 'new'

  const time = order.created_at
    ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''
  const dateStr = order.created_at
    ? new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : ''

  const handleAdvance = async (e) => {
    e.stopPropagation()
    if (!next || advancing) return
    setAdvancing(true)
    try {
      await ordersApi.updateStatus(order.id, next)
      onRefresh?.()
    } finally { setAdvancing(false) }
  }

  const handleCancel = async (e) => {
    e.stopPropagation()
    if (!confirmCancel) { setConfirmCancel(true); return }
    setCancelling(true)
    try {
      await ordersApi.cancel(order.id)
      onRefresh?.()
    } finally { setCancelling(false); setConfirmCancel(false) }
  }

  const itemCount = order.items?.reduce((a, i) => a + (i.quantity || 1), 0) || 0

  return (
    <div
      style={{
        ...card3D,
        ...(hovered && !isDone ? card3DHover : {}),
        opacity: isDone ? 0.7 : 1,
        overflow: 'hidden',
        position: 'relative',
        animation: 'cardEnter 0.5s cubic-bezier(0.25,0.46,0.45,0.94) both',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmCancel(false) }}
    >
      {/* Status accent bar (3D glass edge) */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 3,
        background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)`,
        borderRadius: '20px 20px 0 0',
      }} />

      {/* New order pulse */}
      {isNew && (
        <div style={{
          position: 'absolute',
          top: 16, right: 16,
          width: 10, height: 10,
          borderRadius: '50%',
          background: '#FF9F0A',
          animation: 'newPulse 2s ease-in-out infinite',
          boxShadow: '0 0 12px rgba(255,159,10,0.5)',
        }} />
      )}

      {/* Main content */}
      <div style={{ padding: '20px 22px 16px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#1d1d1f',
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
            }}>
              {order.customer_name || 'Walk-in Customer'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
              {order.customer_phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#86868b', fontWeight: 500 }}>
                  <PhoneIcon /> {order.customer_phone}
                </span>
              )}
              {time && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#86868b', fontWeight: 500 }}>
                  <ClockIcon /> {time}
                </span>
              )}
              {dateStr && (
                <span style={{ fontSize: 12, color: '#aeaeb2', fontWeight: 500 }}>
                  {dateStr}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            {/* Status badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 100,
              background: cfg.bg,
              color: cfg.color,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              boxShadow: isNew ? `0 0 16px ${cfg.glow}` : 'none',
            }}>
              <span style={{ fontSize: 8 }}>{cfg.icon}</span>
              {cfg.label}
            </div>

            {/* Total */}
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#1d1d1f',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}>
              ${order.total?.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Timeline */}
        {!isDone && <OrderTimeline status={order.status} />}

        {/* Auto-confirm countdown for new orders */}
        {isNew && order.created_at && (
          <div style={{ marginTop: 8, marginBottom: 2 }}>
            <CountdownRing createdAt={order.created_at} />
          </div>
        )}

        {/* Summary row */}
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            marginTop: 6,
            borderRadius: 12,
            background: expanded ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
          onMouseLeave={e => e.currentTarget.style.background = expanded ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.02)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26, height: 26,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #094cb2, #3366cc)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(9,76,178,0.22)',
            }}>{itemCount}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em' }}>
              {itemCount === 1 ? '1 item' : `${itemCount} items`}
            </span>
            {order.special_instructions && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 11, color: '#FF9F0A', fontWeight: 500,
              }}>
                <NoteIcon /> Note
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Payment badge */}
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 6,
              background: order.payment_status === 'paid'
                ? 'rgba(48,209,88,0.1)' : 'rgba(0,0,0,0.04)',
              color: order.payment_status === 'paid' ? '#30D158' : '#86868b',
            }}>
              {order.payment_status === 'paid' ? '● Paid' : order.payment_status}
            </span>
            <span style={{
              fontSize: 11,
              color: '#aeaeb2',
              fontWeight: 500,
            }}>
              {order.pay_method === 'stripe_link' ? '💳 Stripe' : order.pay_method === 'cash' ? '💵 Cash' : '💳 Card'}
            </span>
            <ChevronIcon open={expanded} />
          </div>
        </div>

        {/* Expanded details */}
        <div style={{
          maxHeight: expanded ? 600 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease',
          opacity: expanded ? 1 : 0,
        }}>
          <div style={{ paddingTop: 14 }}>
            {/* Items list */}
            <div style={{
              borderRadius: 14,
              border: '1px solid rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}>
              {order.items?.map((item, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 16px',
                  borderBottom: i < order.items.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  background: i % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24, height: 24,
                      borderRadius: 7,
                      background: 'rgba(9,76,178,0.08)',
                      color: '#094cb2',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>{item.quantity}x</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                        {item.name}
                      </div>
                      {item.modification && (
                        <div style={{ fontSize: 11, color: '#86868b', marginTop: 1, fontStyle: 'italic' }}>
                          {item.modification}
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1d1d1f',
                    letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}

              {/* Subtotal row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'rgba(0,0,0,0.025)',
                borderTop: '1px solid rgba(0,0,0,0.06)',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1d1d1f' }}>Total</span>
                <span style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                }}>${order.total?.toFixed(2)}</span>
              </div>
            </div>

            {/* Special instructions */}
            {order.special_instructions && (
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 12,
                background: 'rgba(255,159,10,0.06)',
                border: '1px solid rgba(255,159,10,0.12)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}>
                <NoteIcon />
                <span style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5, fontWeight: 500 }}>
                  {order.special_instructions}
                </span>
              </div>
            )}

            {/* Detail grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginTop: 12,
            }}>
              <DetailCell label="Order ID" value={`#${order.id?.slice(0, 8)}`} />
              <DetailCell label="Payment" value={order.pay_method === 'stripe_link' ? 'Stripe SMS Link' : order.pay_method === 'cash' ? 'Cash' : 'Card at Pickup'} />
              <DetailCell label="Status" value={cfg.label} valueColor={cfg.color} />
              <DetailCell label="Payment Status" value={order.payment_status} valueColor={order.payment_status === 'paid' ? '#30D158' : '#86868b'} />
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isDone && (
          <div style={{
            display: 'flex',
            gap: 8,
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid rgba(0,0,0,0.04)',
          }}>
            {/* Print */}
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.08)',
                background: 'rgba(0,0,0,0.02)',
                color: '#86868b',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(9,76,178,0.06)'
                e.currentTarget.style.color = '#094cb2'
                e.currentTarget.style.borderColor = 'rgba(9,76,178,0.18)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.02)'
                e.currentTarget.style.color = '#86868b'
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'
              }}
            >
              <PrinterIcon /> Print
            </button>

            {/* Advance */}
            {next && (
              <button
                onClick={handleAdvance}
                disabled={advancing}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  cursor: advancing ? 'wait' : 'pointer',
                  opacity: advancing ? 0.7 : 1,
                  boxShadow: `0 2px 12px ${cfg.glow}, 0 1px 3px rgba(0,0,0,0.1)`,
                  transition: 'all 0.25s ease',
                  transform: 'translateZ(0)',
                }}
                onMouseEnter={e => {
                  if (!advancing) {
                    e.currentTarget.style.transform = 'translateY(-1px) translateZ(0)'
                    e.currentTarget.style.boxShadow = `0 4px 20px ${cfg.glow}, 0 2px 6px rgba(0,0,0,0.12)`
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateZ(0)'
                  e.currentTarget.style.boxShadow = `0 2px 12px ${cfg.glow}, 0 1px 3px rgba(0,0,0,0.1)`
                }}
              >
                {advancing ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                ) : (
                  <>
                    {NEXT_LABEL[order.status]}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            )}

            {/* Cancel */}
            <button
              onClick={handleCancel}
              disabled={cancelling}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 14px',
                borderRadius: 10,
                border: confirmCancel ? '1px solid rgba(255,69,58,0.3)' : '1px solid rgba(255,69,58,0.12)',
                background: confirmCancel ? 'rgba(255,69,58,0.08)' : 'transparent',
                color: '#FF453A',
                fontSize: 12,
                fontWeight: 600,
                cursor: cancelling ? 'wait' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,69,58,0.08)'
                e.currentTarget.style.borderColor = 'rgba(255,69,58,0.25)'
              }}
              onMouseLeave={e => {
                if (!confirmCancel) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'rgba(255,69,58,0.12)'
                }
              }}
            >
              {cancelling ? 'Cancelling...' : confirmCancel ? 'Confirm Cancel' : 'Cancel'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── DETAIL CELL ───────────────────────────────────────────────────────────── */
function DetailCell({ label, value, valueColor }) {
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 10,
      background: 'rgba(0,0,0,0.015)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#aeaeb2', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 600,
        color: valueColor || '#1d1d1f',
        marginTop: 2,
        letterSpacing: '-0.01em',
      }}>
        {value}
      </div>
    </div>
  )
}

/* ─── EMPTY STATE ───────────────────────────────────────────────────────────── */
function EmptyState({ filter }) {
  return (
    <div style={{
      ...card3D,
      padding: '60px 40px',
      textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72,
        borderRadius: 22,
        background: 'linear-gradient(135deg, rgba(9,76,178,0.07), rgba(51,102,204,0.07))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px',
        fontSize: 32,
      }}>
        📋
      </div>
      <h3 style={{
        fontSize: 20,
        fontWeight: 700,
        color: '#1d1d1f',
        letterSpacing: '-0.025em',
        marginBottom: 8,
      }}>
        {filter ? 'No matching orders' : 'No orders yet'}
      </h3>
      <p style={{
        fontSize: 14,
        color: '#86868b',
        lineHeight: 1.5,
        maxWidth: 320,
        margin: '0 auto',
      }}>
        {filter
          ? 'Try adjusting your filters or search to find what you are looking for.'
          : 'When customers place orders through the AI phone agent, they will appear here.'}
      </p>
    </div>
  )
}

/* ─── SKELETON LOADER ───────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{ ...card3D, padding: '22px 24px', animation: 'shimmer 1.5s ease-in-out infinite' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ width: 140, height: 18, borderRadius: 6, background: 'rgba(0,0,0,0.06)' }} />
          <div style={{ width: 180, height: 12, borderRadius: 4, background: 'rgba(0,0,0,0.04)', marginTop: 8 }} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ width: 80, height: 24, borderRadius: 12, background: 'rgba(0,0,0,0.04)' }} />
          <div style={{ width: 60, height: 18, borderRadius: 6, background: 'rgba(0,0,0,0.06)', marginTop: 6, marginLeft: 'auto' }} />
        </div>
      </div>
      <div style={{ width: '100%', height: 40, borderRadius: 10, background: 'rgba(0,0,0,0.03)' }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */
const PERIOD_TABS = [
  { value: null, label: 'All' },
  { value: 7,   label: '7 Days' },
  { value: 15,  label: '15 Days' },
  { value: 30,  label: '30 Days' },
]

export default function OrderHistory() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [periodDays, setPeriodDays] = useState(7)
  const [search, setSearch] = useState('')

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    else setRefreshing(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (dateFilter) params.order_date = dateFilter
      else if (periodDays) params.days = periodDays
      const res = await ordersApi.list(params)
      setOrders(res.data)
    } catch (err) {
      console.error('Failed to load orders:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter, dateFilter, periodDays])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(() => load(false), 15000)
    return () => clearInterval(interval)
  }, [load])

  // Client-side search
  const filtered = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.customer_phone || '').includes(q) ||
      (o.id || '').toLowerCase().includes(q)
    )
  })

  // Stats — revenue matches Analytics backend logic (cash + paid, not cancelled)
  const stats = {
    total: orders.length,
    active: orders.filter(o => ['new', 'confirmed', 'preparing'].includes(o.status)).length,
    ready: orders.filter(o => o.status === 'ready').length,
    completed: orders.filter(o => o.status === 'picked_up').length,
    revenue: orders
      .filter(o => o.status !== 'cancelled' && (o.payment_status === 'paid' || ['cash', 'card_on_pickup'].includes(o.pay_method)))
      .reduce((a, o) => a + (o.total || 0), 0),
  }

  return (
    <Layout>
      {/* CSS */}
      <style>{`
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.5; }
        }
        @keyframes newPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(1.4); }
        }
        @keyframes timelinePulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50%      { transform: scale(1.3); opacity: 0.1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .orders-page::-webkit-scrollbar { width: 6px; }
        .orders-page::-webkit-scrollbar-track { background: transparent; }
        .orders-page::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 3px; }
        .orders-page::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.18); }
      `}</style>

      <div className="orders-page" style={{
        padding: '32px 40px 60px',
        maxWidth: 1280,
        margin: '0 auto',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, rgba(245,245,247,0.5) 0%, rgba(255,255,255,0) 40%)',
      }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 24, animation: 'fadeIn 0.4s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h1 style={{
                fontSize: 34,
                fontWeight: 700,
                color: '#1d1d1f',
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
                margin: 0,
              }}>
                Orders
              </h1>
              <p style={{
                fontSize: 15,
                color: '#86868b',
                marginTop: 6,
                fontWeight: 400,
                letterSpacing: '-0.01em',
              }}>
                {periodDays ? `Last ${periodDays} days` : 'All orders'} · {stats.total} total
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Period tabs */}
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: 10, padding: 3, gap: 2 }}>
                {PERIOD_TABS.map(t => (
                  <button
                    key={String(t.value)}
                    onClick={() => { setPeriodDays(t.value); setDateFilter('') }}
                    style={{
                      padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, transition: 'all 0.15s ease',
                      background: periodDays === t.value ? '#fff' : 'transparent',
                      color: periodDays === t.value ? '#094cb2' : '#86868b',
                      boxShadow: periodDays === t.value ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => load(false)}
                disabled={refreshing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(20px)',
                  color: '#1d1d1f',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: refreshing ? 'wait' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.95)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.7)'
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'
                }}
              >
                <RefreshIcon spinning={refreshing} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginBottom: 24,
          animation: 'fadeIn 0.5s ease 0.1s both',
        }}>
          <StatPill label="Total" value={stats.total} />
          <StatPill label="Active" value={stats.active} color="#FF9F0A" glow="rgba(255,159,10,0.15)" />
          <StatPill label="Ready" value={stats.ready} color="#30D158" glow="rgba(48,209,88,0.15)" />
          <StatPill label="Done" value={stats.completed} color="#86868b" />
          <StatPill label="Revenue" value={`$${stats.revenue.toFixed(0)}`} color="#094cb2" glow="rgba(9,76,178,0.12)" />
        </div>

        {/* ── Filters ── */}
        <div style={{
          ...card3D,
          borderRadius: 16,
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          animation: 'fadeIn 0.5s ease 0.15s both',
        }}>
          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 12px',
            borderRadius: 10,
            background: 'rgba(0,0,0,0.03)',
            border: '1px solid rgba(0,0,0,0.04)',
            flex: '1 1 200px',
            minWidth: 180,
          }}>
            <span style={{ color: '#aeaeb2', flexShrink: 0 }}><SearchIcon /></span>
            <input
              type="text"
              placeholder="Search by name, phone, or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                color: '#1d1d1f',
                width: '100%',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  border: 'none', background: 'rgba(0,0,0,0.08)',
                  borderRadius: '50%', width: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#86868b', fontSize: 11, fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: 'rgba(0,0,0,0.06)', flexShrink: 0 }} />

          {/* Date picker */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px',
            borderRadius: 10,
            background: dateFilter ? 'rgba(9,76,178,0.06)' : 'rgba(0,0,0,0.03)',
            border: dateFilter ? '1px solid rgba(9,76,178,0.15)' : '1px solid rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
          }}>
            <span style={{ color: dateFilter ? '#094cb2' : '#aeaeb2', flexShrink: 0 }}><CalendarIcon /></span>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 12,
                color: dateFilter ? '#094cb2' : '#86868b',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                style={{
                  border: 'none', background: 'rgba(9,76,178,0.10)',
                  borderRadius: '50%', width: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#094cb2', fontSize: 10, fontWeight: 700,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: 'rgba(0,0,0,0.06)', flexShrink: 0 }} />

          {/* Status filter pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: '2 1 auto' }}>
            {FILTER_TABS.map(tab => {
              const active = statusFilter === tab.key
              const tabCfg = tab.key ? STATUS_CONFIG[tab.key] : null
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(active ? '' : tab.key)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: active
                      ? (tabCfg ? tabCfg.bg : 'rgba(9,76,178,0.08)')
                      : 'transparent',
                    color: active
                      ? (tabCfg ? tabCfg.color : '#094cb2')
                      : '#86868b',
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    letterSpacing: '-0.01em',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(0,0,0,0.03)'
                      e.currentTarget.style.color = '#1d1d1f'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = '#86868b'
                    }
                  }}
                >
                  {tab.label}
                  {active && tab.key && (
                    <span style={{
                      marginLeft: 4,
                      fontSize: 10,
                      opacity: 0.7,
                    }}>
                      ({filtered.length})
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Order list ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
        }}>
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filtered.length === 0 ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyState filter={statusFilter || search || dateFilter} />
            </div>
          ) : (
            filtered.map((order, i) => (
              <div key={order.id} style={{ animationDelay: `${i * 0.04}s` }}>
                <OrderCard3D
                  order={order}
                  onRefresh={() => load(false)}
                />
              </div>
            ))
          )}
        </div>

        {/* ── Results count ── */}
        {!loading && filtered.length > 0 && (
          <div style={{
            textAlign: 'center',
            marginTop: 28,
            fontSize: 12,
            color: '#aeaeb2',
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}>
            Showing {filtered.length} of {orders.length} orders
            {(statusFilter || search || dateFilter) && (
              <button
                onClick={() => { setStatusFilter(''); setSearch(''); setDateFilter('') }}
                style={{
                  marginLeft: 8,
                  border: 'none',
                  background: 'none',
                  color: '#094cb2',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
