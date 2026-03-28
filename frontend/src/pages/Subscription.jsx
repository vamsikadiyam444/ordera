import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Layout from '../components/Layout'
import { subscriptionApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { CheckIcon, SpinnerIcon } from '../components/Icons'

/* ── Apple-inspired plan theming ── */
const PLAN_THEMES = {
  essential: {
    accent: '#6366f1',
    accentLight: 'rgba(99,102,241,0.08)',
    gradient: 'linear-gradient(145deg, #818cf8, #6366f1)',
    iconBg: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
    ring: 'rgba(99,102,241,0.2)',
    label: 'Get Started',
  },
  pro: {
    accent: '#0071e3',
    accentLight: 'rgba(0,113,227,0.06)',
    gradient: 'linear-gradient(145deg, #0077ED, #0071e3)',
    iconBg: 'linear-gradient(135deg, #d6e8ff, #b3d4fc)',
    ring: 'rgba(0,113,227,0.15)',
    label: 'Most Popular',
  },
  enterprise: {
    accent: '#1d1d1f',
    accentLight: 'rgba(29,29,31,0.04)',
    gradient: 'linear-gradient(145deg, #2d2d2f, #1d1d1f)',
    iconBg: 'linear-gradient(135deg, #e8e8ed, #d2d2d7)',
    ring: 'rgba(29,29,31,0.12)',
    label: 'For Teams',
  },
}

const PLAN_ICONS = {
  essential: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.56 5.56l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  pro: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  enterprise: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  ),
}

/* ── Premium Usage Card ── */
function UsageCard({ used, limit, label, subtitle, color = '#0071e3', icon }) {
  const unlimited = limit === -1
  const pct = unlimited ? 0 : limit === 0 ? 0 : Math.min((used / limit) * 100, 100)
  const remaining = unlimited ? null : Math.max(limit - used, 0)

  const statusColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : color
  const statusLabel = unlimited ? 'Unlimited' : pct >= 90 ? 'Critical' : pct >= 70 ? 'High usage' : 'Healthy'
  const statusDot = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#34c759'

  // Ring math — thinner, larger
  const size = 120
  const stroke = 7
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <div style={{
      position: 'relative',
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: '22px 24px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 160, height: 160, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: `linear-gradient(135deg, ${color}22, ${color}10)`,
            border: `1px solid ${color}25`,
            color: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              {label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        {/* Status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: `${statusColor}12`,
          border: `1px solid ${statusColor}25`,
          borderRadius: 999, padding: '4px 10px',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusDot, boxShadow: `0 0 6px ${statusDot}` }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
        </div>
      </div>

      {/* Main content: ring + hero stat */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>

        {/* Ring */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
            <defs>
              <linearGradient id={`grad-${label.replace(/\s/g,'')}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={color} />
                <stop offset="100%" stopColor={statusColor} />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
            {/* Progress */}
            <circle
              cx={size/2} cy={size/2} r={r} fill="none"
              stroke={unlimited ? `${color}40` : `url(#grad-${label.replace(/\s/g,'')})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={unlimited ? circ * 0.15 : offset}
              style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.34, 1.56, 0.64, 1)', filter: `drop-shadow(0 0 4px ${color}88)` }}
            />
          </svg>
          {/* Center */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            {unlimited ? (
              <span style={{ fontSize: 22, fontWeight: 800, color: color }}>∞</span>
            ) : (
              <>
                <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-1)', lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {Math.round(pct)}<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)' }}>%</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stat stack */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Remaining — hero */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {unlimited ? 'Available' : 'Remaining'}
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: statusColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
              {unlimited ? '∞' : remaining.toLocaleString()}
            </div>
          </div>

          {/* Used / Limit row */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>Used</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '-0.02em' }}>
                {used.toLocaleString()}
              </div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>Limit</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '-0.02em' }}>
                {unlimited ? '∞' : limit.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ height: 5, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: unlimited ? '8%' : `${pct}%`,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${color}, ${statusColor})`,
            boxShadow: `0 0 8px ${color}66`,
            transition: 'width 1.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>0</span>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{unlimited ? 'Unlimited' : limit.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Premium plan card (Apple product card style) ── */
function PlanCard({ planKey, plan, isCurrent, onSelect, changing, index }) {
  const theme = PLAN_THEMES[planKey] || PLAN_THEMES.essential
  const isPopular = plan.popular
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="relative flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        animation: `fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 100}ms both`,
      }}
    >
      {/* Popular label */}
      {isPopular && (
        <div className="flex justify-center mb-3">
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{
              background: theme.accentLight,
              color: theme.accent,
              border: `1px solid ${theme.ring}`,
              letterSpacing: '0.02em',
            }}
          >
            {theme.label}
          </span>
        </div>
      )}
      {!isPopular && <div style={{ height: 30 }} />}

      <div
        className="flex-1 rounded-2xl overflow-hidden transition-all duration-500"
        style={{
          background: 'var(--card-bg)',
          border: isCurrent ? `2px solid ${theme.accent}` : '1px solid var(--border)',
          boxShadow: hovered
            ? `0 20px 60px rgba(0,0,0,0.08), 0 8px 20px rgba(0,0,0,0.04)`
            : 'var(--shadow-sm)',
          transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        }}
      >
        <div className="p-7">
          {/* Icon + name */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: 48,
                height: 48,
                background: theme.iconBg,
                color: theme.accent,
              }}
            >
              {PLAN_ICONS[planKey]}
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
                {plan.name}
              </h3>
              {!isPopular && (
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>{theme.label}</span>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="mb-1">
            <div className="flex items-baseline gap-0.5">
              <span
                className="font-extrabold tracking-tight"
                style={{ fontSize: 40, lineHeight: 1, color: 'var(--text-1)', letterSpacing: '-0.03em' }}
              >
                ${plan.price}
              </span>
            </div>
            <span className="text-sm" style={{ color: 'var(--text-3)' }}>per month</span>
          </div>

          {/* Divider */}
          <div className="my-5" style={{ height: 1, background: 'var(--border)' }} />

          {/* AI Model chip */}
          <div className="mb-5">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
              style={{
                background: theme.accentLight,
                color: theme.accent,
                border: `1px solid ${theme.ring}`,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2z" />
                <path d="M12 6v6l4 2" />
              </svg>
              {plan.ai_model}
            </span>
          </div>

          {/* Features */}
          <ul className="space-y-3 mb-7">
            {plan.features.map((feat, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-2)' }}>
                <span
                  className="flex items-center justify-center rounded-full flex-shrink-0 mt-0.5"
                  style={{ width: 20, height: 20, background: theme.accentLight, color: theme.accent }}
                >
                  <CheckIcon size={11} />
                </span>
                <span style={{ lineHeight: '1.5' }}>{feat}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          {isCurrent ? (
            <div
              className="w-full py-3 rounded-xl text-sm font-semibold text-center"
              style={{
                background: theme.accentLight,
                color: theme.accent,
                border: `1.5px solid ${theme.ring}`,
              }}
            >
              Your Current Plan
            </div>
          ) : (
            <button
              onClick={() => onSelect(planKey)}
              disabled={changing}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2"
              style={{
                background: theme.gradient,
                boxShadow: hovered ? `0 4px 16px ${theme.ring}` : 'none',
                opacity: changing ? 0.7 : 1,
              }}
            >
              {changing ? (
                <><SpinnerIcon size={14} /> Processing...</>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  Get {plan.name}
                </>
              )}
            </button>
          )}
          {!isCurrent && (
            <div className="flex items-center justify-center gap-1 mt-2.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Secure checkout</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Billing row item ── */
function BillingRow({ label, value, isLast }) {
  return (
    <div
      className="flex justify-between items-center py-3.5"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
    >
      <span className="text-sm" style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{value}</span>
    </div>
  )
}

/* ── FAQ Accordion item ── */
function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="py-4 cursor-pointer select-none"
      style={{ borderBottom: '1px solid var(--border)' }}
      onClick={() => setOpen(!open)}
    >
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{question}</h4>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)"
          strokeWidth="2" strokeLinecap="round"
          style={{
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: open ? 'rotate(45deg)' : 'rotate(0)',
            flexShrink: 0,
            marginLeft: 16,
          }}
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      <div
        style={{
          maxHeight: open ? 120 : 0,
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
        }}
      >
        <p className="text-sm mt-2.5 pr-8" style={{ color: 'var(--text-3)', lineHeight: 1.7 }}>
          {answer}
        </p>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════ */

/* ── OTP Verification Modal ── */
function OtpModal({ targetPlan, planName, email, phone, devOtp, onVerify, onClose, verifying }) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const inputRefs = [null, null, null, null, null, null].map(() => ({ current: null }))

  const handleDigit = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const next = [...digits]
    next[index] = value.slice(-1)
    setDigits(next)
    setError('')
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`)
      if (nextInput) nextInput.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`)
      if (prevInput) prevInput.focus()
    }
    if (e.key === 'Enter') {
      const code = digits.join('')
      if (code.length === 6) onVerify(code)
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = [...digits]
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setDigits(next)
    if (text.length === 6) {
      const lastInput = document.getElementById('otp-input-5')
      if (lastInput) lastInput.focus()
    }
  }

  const handleResend = async () => {
    setResending(true)
    setResent(false)
    try {
      await subscriptionApi.sendPlanOtp(targetPlan)
      setResent(true)
      setTimeout(() => setResent(false), 3000)
    } catch { }
    setResending(false)
  }

  const code = digits.join('')
  const isComplete = code.length === 6

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card-bg, #fff)', borderRadius: 20,
          width: '100%', maxWidth: 420, padding: '36px 32px 28px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          animation: 'fadeInUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #d6e8ff, #0071e3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>
            Verify to Continue
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '8px 0 0', lineHeight: 1.5 }}>
            Enter the 6-digit code sent to<br />
            <strong style={{ color: 'var(--text-2)' }}>{email}</strong>
            {phone && <><br />and <strong style={{ color: 'var(--text-2)' }}>{phone}</strong></>}
          </p>
        </div>

        {/* Dev mode hint */}
        {devOtp && (
          <div style={{
            background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10,
            padding: '8px 12px', marginBottom: 16, textAlign: 'center',
            fontSize: 12, color: '#92400e',
          }}>
            Dev mode — your code is: <strong style={{ letterSpacing: 2 }}>{devOtp}</strong>
          </div>
        )}

        {/* OTP Inputs */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              id={`otp-input-${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              autoFocus={i === 0}
              style={{
                width: 48, height: 56, borderRadius: 12, border: `2px solid ${d ? '#0071e3' : 'var(--border)'}`,
                background: 'var(--card-bg)', fontSize: 22, fontWeight: 700, textAlign: 'center',
                color: 'var(--text-1)', outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: d ? '0 0 0 3px rgba(0,113,227,0.1)' : 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#0071e3'; e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.1)' }}
              onBlur={e => { if (!d) { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' } }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', margin: '0 0 12px' }}>{error}</p>
        )}

        {/* Verify Button */}
        <button
          onClick={() => isComplete && onVerify(code)}
          disabled={!isComplete || verifying}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
            background: isComplete ? 'linear-gradient(145deg, #0077ED, #0071e3)' : 'var(--border)',
            color: isComplete ? '#fff' : 'var(--text-3)',
            fontSize: 15, fontWeight: 700, cursor: isComplete ? 'pointer' : 'default',
            opacity: verifying ? 0.7 : 1,
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {verifying ? (
            <><SpinnerIcon size={16} /> Verifying...</>
          ) : (
            <>Verify & Switch to {planName}</>
          )}
        </button>

        {/* Resend + Cancel */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <button
            onClick={handleResend}
            disabled={resending}
            style={{
              background: 'none', border: 'none', fontSize: 13, fontWeight: 600,
              color: resent ? '#16a34a' : '#0071e3', cursor: 'pointer', padding: 0,
            }}
          >
            {resent ? 'Code resent!' : resending ? 'Sending...' : 'Resend code'}
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: 13, fontWeight: 500,
              color: 'var(--text-3)', cursor: 'pointer', padding: 0,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Subscription() {
  const { owner, setOwner } = useAuth()
  const [plans, setPlans] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [changing, setChanging] = useState(null)
  const [message, setMessage] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)

  // OTP modal state
  const [otpModal, setOtpModal] = useState(null) // { plan, planName, email, phone, devOtp }
  const [otpVerifying, setOtpVerifying] = useState(false)

  // Handle Stripe redirect query params (?payment=success&plan=pro)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    const plan = params.get('plan')

    if (payment === 'success' && plan) {
      setMessage({ type: 'success', text: `Payment successful! You are now on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan.` })
      // Update owner context
      if (owner) {
        const updated = { ...owner, plan }
        setOwner(updated)
        localStorage.setItem('owner', JSON.stringify(updated))
      }
      // Clean URL
      window.history.replaceState({}, '', '/subscription')
    } else if (payment === 'cancelled') {
      setMessage({ type: 'error', text: 'Payment was cancelled. You can try again anytime.' })
      window.history.replaceState({}, '', '/subscription')
    }
  }, [])

  useEffect(() => {
    Promise.all([subscriptionApi.getPlans(), subscriptionApi.getCurrent()])
      .then(([plansRes, subRes]) => {
        setPlans(plansRes.data.plans)
        setSubscription(subRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Step 1: User clicks plan button → send OTP, show modal
  const handlePlanChange = async (newPlan) => {
    setChanging(newPlan)
    setMessage(null)
    try {
      const res = await subscriptionApi.sendPlanOtp(newPlan)
      const planName = plans?.[newPlan]?.name || newPlan
      setOtpModal({
        plan: newPlan,
        planName,
        email: res.data.email,
        phone: res.data.phone,
        devOtp: res.data.otp || null, // dev mode only
      })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to send verification code' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setChanging(null)
    }
  }

  // Step 2: User enters OTP → verify and proceed with checkout
  const handleOtpVerify = async (code) => {
    if (!otpModal) return
    setOtpVerifying(true)
    try {
      const res = await subscriptionApi.createCheckout(otpModal.plan, code)

      if (res.data.mode === 'live' && res.data.redirect_url) {
        window.location.href = res.data.redirect_url
        return
      }

      // Dev mode: plan changed directly
      setOtpModal(null)
      setMessage({ type: 'success', text: res.data.message })
      const subRes = await subscriptionApi.getCurrent()
      setSubscription(subRes.data)
      if (owner) {
        const updated = { ...owner, plan: otpModal.plan }
        setOwner(updated)
        localStorage.setItem('owner', JSON.stringify(updated))
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Verification failed' })
    } finally {
      setOtpVerifying(false)
      setTimeout(() => setMessage(null), 8000)
    }
  }

  const handleManageBilling = async () => {
    setPortalLoading(true)
    try {
      const res = await subscriptionApi.createPortal()
      if (res.data.portal_url) {
        window.location.href = res.data.portal_url
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Unable to open billing portal. Subscribe to a plan first.',
      })
      setPortalLoading(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <SpinnerIcon size={24} />
        </div>
      </Layout>
    )
  }

  const currentPlan = subscription?.current_plan || 'essential'
  const billing = subscription?.billing || {}
  const usage = subscription?.usage || {}
  const currentTheme = PLAN_THEMES[currentPlan] || PLAN_THEMES.essential

  return (
    <Layout>
      <div className="px-8 py-10 max-w-6xl mx-auto">

        {/* ── Hero header ── */}
        <div className="text-center mb-12" style={{ animation: 'fadeInUp 0.5s ease both' }}>
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-4"
            style={{
              background: currentTheme.accentLight,
              color: currentTheme.accent,
              border: `1px solid ${currentTheme.ring}`,
            }}
          >
            <span className="capitalize">{currentPlan} Plan</span>
            <span style={{ color: 'var(--text-3)' }}>Active</span>
          </div>
          <h1
            className="font-extrabold tracking-tight"
            style={{ fontSize: 38, color: 'var(--text-1)', letterSpacing: '-0.035em', lineHeight: 1.15 }}
          >
            Subscription
          </h1>
          <p className="text-base mt-2" style={{ color: 'var(--text-3)', maxWidth: 380, margin: '8px auto 0' }}>
            Manage your plan, track your usage, and update billing details.
          </p>
        </div>

        {/* Alert */}
        {message && (
          <div
            className="mb-8 rounded-2xl px-5 py-4 text-sm font-medium flex items-center gap-3"
            style={{
              animation: 'fadeInUp 0.3s ease both',
              background: message.type === 'success' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
              color: message.type === 'success' ? '#16a34a' : '#dc2626',
              border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {message.type === 'success'
                ? <><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" /></>
                : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>}
            </svg>
            {message.text}
          </div>
        )}

        {/* ── Usage This Period ── */}
        <div style={{ animation: 'fadeInUp 0.5s ease 0.1s both', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0 }}>
                Usage This Period
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
                Track how much of your plan you've used this billing cycle.
              </p>
            </div>
            <span
              style={{
                fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                background: 'var(--card-bg)', border: '1px solid var(--border)',
                color: 'var(--text-3)',
              }}
            >
              Resets {billing.next_billing_date
                ? new Date(billing.next_billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'N/A'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <UsageCard
              used={usage.calls_used || 0}
              limit={usage.calls_limit || 100}
              label="AI Phone Calls"
              subtitle="Inbound calls handled by AI this period"
              color={currentTheme.accent}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.56 5.56l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              }
            />
            <UsageCard
              used={usage.documents_used || 0}
              limit={usage.documents_limit || 1}
              label="Knowledge Docs"
              subtitle="Uploaded documents powering your AI"
              color="#34c759"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              }
            />
          </div>
        </div>

        {/* ── Billing ── */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-5 mb-14" style={{ animation: 'fadeInUp 0.5s ease 0.15s both' }}>


          <div
            className="rounded-2xl p-7"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
              Billing
            </h2>
            <BillingRow label="Plan" value={<span className="capitalize">{currentPlan}</span>} />
            <BillingRow label="Monthly" value={billing.price_label || '$0'} />
            <BillingRow
              label="Next Invoice"
              value={billing.next_billing_date
                ? new Date(billing.next_billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'N/A'}
            />
            <BillingRow
              label="Payment"
              value={billing.payment_method || 'No card on file'}
              isLast
            />
            <button
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: 'transparent',
                color: '#0071e3',
                border: '1.5px solid rgba(0,113,227,0.2)',
                opacity: portalLoading ? 0.6 : 1,
              }}
              disabled={portalLoading}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0,113,227,0.06)'
                e.currentTarget.style.borderColor = 'rgba(0,113,227,0.35)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'rgba(0,113,227,0.2)'
              }}
              onClick={handleManageBilling}
            >
              {portalLoading ? (
                <><SpinnerIcon size={14} /> Opening...</>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  Manage Payment Method
                </>
              )}
            </button>
            {/* Stripe badge */}
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Secured by Stripe</span>
            </div>
          </div>
        </div>

        {/* ── Plan section header ── */}
        <div className="text-center mb-10" style={{ animation: 'fadeInUp 0.5s ease 0.2s both' }}>
          <h2
            className="font-extrabold tracking-tight"
            style={{ fontSize: 28, color: 'var(--text-1)', letterSpacing: '-0.03em' }}
          >
            Choose your plan.
          </h2>
          <p className="text-sm mt-2" style={{ color: 'var(--text-3)' }}>
            Start with what you need. Upgrade anytime as you grow.
          </p>
        </div>

        {/* ── Plan cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16 items-start">
          {plans &&
            Object.entries(plans).map(([key, plan], index) => (
              <PlanCard
                key={key}
                planKey={key}
                plan={plan}
                isCurrent={key === currentPlan}
                onSelect={handlePlanChange}
                changing={changing === key}
                index={index}
              />
            ))}
        </div>

        {/* ── FAQ ── */}
        <div
          className="rounded-2xl p-7 max-w-2xl mx-auto"
          style={{
            animation: 'fadeInUp 0.5s ease 0.3s both',
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h2
            className="text-base font-bold mb-2"
            style={{ color: 'var(--text-1)', letterSpacing: '-0.01em' }}
          >
            Frequently Asked Questions
          </h2>
          <FaqItem
            question="Can I change my plan at any time?"
            answer="Yes. Upgrade or downgrade whenever you like. Changes take effect immediately and your billing is prorated automatically."
          />
          <FaqItem
            question="What happens if I exceed my call limit?"
            answer="We'll notify you at 80% usage. Additional calls beyond your limit are billed at $0.50 each. Upgrade for a higher limit."
          />
          <FaqItem
            question="Do you offer annual billing?"
            answer="Yes. Annual plans include a 20% discount. Contact our team to switch to yearly billing."
          />
          <FaqItem
            question="Can I cancel my subscription?"
            answer="Cancel anytime from this page. Your service continues through the end of the current billing period with no further charges."
          />
        </div>

        {/* Bottom spacer */}
        <div style={{ height: 40 }} />
      </div>

      {/* OTP Verification Modal */}
      {otpModal && (
        <OtpModal
          targetPlan={otpModal.plan}
          planName={otpModal.planName}
          email={otpModal.email}
          phone={otpModal.phone}
          devOtp={otpModal.devOtp}
          onVerify={handleOtpVerify}
          onClose={() => setOtpModal(null)}
          verifying={otpVerifying}
        />
      )}
    </Layout>
  )
}
