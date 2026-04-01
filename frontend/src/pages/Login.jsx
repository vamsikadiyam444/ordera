import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SpinnerIcon, CheckIcon, PhoneIcon } from '../components/Icons'

const STATS = [
  { value: '24/7', label: 'Always on' },
  { value: '< 2s', label: 'Response time' },
  { value: '98%', label: 'Accuracy' },
]

// Colour palette — 3 distinct jewel tones against #07070d
// Cyan (customer) → Violet (Ringa AI) → Amber/Gold (kitchen)
const C = {
  cyan:   { main: '#22d3ee', dim: 'rgba(34,211,238,', border: 'rgba(34,211,238,' },
  violet: { main: '#a78bfa', dim: 'rgba(167,139,250,', border: 'rgba(167,139,250,' },
  amber:  { main: '#fbbf24', dim: 'rgba(251,191,36,',  border: 'rgba(251,191,36,' },
}

const ANIMATION_CSS = `
  @keyframes rf_ring1{0%,100%{transform:scale(1);opacity:.6}15%{transform:scale(1.85);opacity:0}}
  @keyframes rf_ring2{0%,100%{transform:scale(1);opacity:.25}22%{transform:scale(2.5);opacity:0}}
  @keyframes rf_pkt1{0%,2%{left:-5px;opacity:0}6%{left:-5px;opacity:1}46%{left:calc(100% + 5px);opacity:1}50%,100%{left:calc(100% + 5px);opacity:0}}
  @keyframes rf_pkt2{0%,52%{left:-5px;opacity:0}56%{left:-5px;opacity:1}91%{left:calc(100% + 5px);opacity:1}95%,100%{left:calc(100% + 5px);opacity:0}}
  @keyframes rf_phoneGlow{0%,100%{box-shadow:0 0 0 rgba(34,211,238,0)}7%,16%{box-shadow:0 0 20px rgba(34,211,238,.6),0 0 40px rgba(34,211,238,.22)}22%{box-shadow:0 0 0 rgba(34,211,238,0)}}
  @keyframes rf_kitchen{0%,75%,100%{box-shadow:0 0 0 rgba(251,191,36,0);border-color:rgba(251,191,36,.35)}83%,93%{box-shadow:0 0 22px rgba(251,191,36,.55),0 0 44px rgba(251,191,36,.2);border-color:rgba(251,191,36,.95)}}
  @keyframes rf_ticket{0%,22%{opacity:0;transform:translateY(10px) scale(.97)}29%,58%{opacity:1;transform:translateY(0) scale(1)}65%,100%{opacity:0;transform:translateY(-6px) scale(.97)}}
  @keyframes rf_check{0%,78%{opacity:0;transform:scale(0)}86%{opacity:1;transform:scale(1.25)}91%,100%{opacity:1;transform:scale(1)}}
  @keyframes rf_sA{0%,3%,100%{opacity:1}16%,98%{opacity:0}}
  @keyframes rf_sB{0%,25%{opacity:0}32%,57%{opacity:1}64%,100%{opacity:0}}
  @keyframes rf_sC{0%,78%{opacity:0}85%,95%{opacity:1}100%{opacity:0}}
  @keyframes rf_ringViolet{0%,100%{box-shadow:0 0 18px rgba(167,139,250,.3)}50%{box-shadow:0 0 32px rgba(167,139,250,.55)}}
`

function OrderFlowAnimation({ glass }) {
  const T = '5s'
  return (
    <>
      <style>{ANIMATION_CSS}</style>
      <div style={{ ...glass, padding: '18px 20px 16px', marginBottom: 24, position: 'relative' }}>
        {/* tri-colour ambient glow behind each node */}
        <div style={{ position: 'absolute', top: 20, left: 20, width: 60, height: 60, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 20, right: 20, width: 60, height: 60, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>Live Call Flow</div>

        {/* nodes row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* ── Customer node — CYAN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <div style={{ position: 'relative', width: 48, height: 48 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${C.cyan.border}.5)`, animation: `rf_ring1 ${T} ease-in-out infinite` }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${C.cyan.border}.2)`, animation: `rf_ring2 ${T} ease-in-out infinite` }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `${C.cyan.dim}.12)`, border: `1.5px solid ${C.cyan.border}.45)`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: `rf_phoneGlow ${T} ease-in-out infinite` }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.cyan.main} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-5-5 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                </svg>
              </div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: `${C.cyan.dim}.5)`, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Customer</span>
          </div>

          {/* Connector 1 — cyan dashes */}
          <div style={{ flex: 1, position: 'relative', height: 2, margin: '0 8px', marginBottom: 16 }}>
            <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(90deg,${C.cyan.dim}.25) 0,${C.cyan.dim}.25) 5px,transparent 5px,transparent 10px)` }} />
            <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 9, height: 9, borderRadius: '50%', background: C.cyan.main, boxShadow: `0 0 10px ${C.cyan.main},0 0 22px ${C.cyan.dim}.5)`, animation: `rf_pkt1 ${T} linear infinite` }} />
          </div>

          {/* ── Ringa AI node — VIOLET ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: `linear-gradient(135deg,${C.violet.dim}.22),${C.violet.dim}.35))`, border: `1.5px solid ${C.violet.border}.7)`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: `rf_ringViolet ${T} ease-in-out infinite` }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.violet.main} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: `${C.violet.dim}.5)`, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ringa AI</span>
          </div>

          {/* Connector 2 — amber dashes */}
          <div style={{ flex: 1, position: 'relative', height: 2, margin: '0 8px', marginBottom: 16 }}>
            <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(90deg,${C.amber.dim}.25) 0,${C.amber.dim}.25) 5px,transparent 5px,transparent 10px)` }} />
            <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 9, height: 9, borderRadius: '50%', background: C.amber.main, boxShadow: `0 0 10px ${C.amber.main},0 0 22px ${C.amber.dim}.5)`, animation: `rf_pkt2 ${T} linear infinite` }} />
          </div>

          {/* ── Kitchen node — AMBER ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <div style={{ position: 'relative', width: 48, height: 48 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `${C.amber.dim}.1)`, border: `1.5px solid ${C.amber.border}.35)`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: `rf_kitchen ${T} ease-in-out infinite` }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.amber.main} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="8" y1="13" x2="16" y2="13"/>
                  <line x1="8" y1="17" x2="12" y2="17"/>
                </svg>
              </div>
              <div style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: C.amber.main, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, animation: `rf_check ${T} ease-in-out infinite`, transformOrigin: 'center' }}>
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#07070d" strokeWidth="2.4" strokeLinecap="round"><polyline points="2,6.5 4.5,9 10,3"/></svg>
              </div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: `${C.amber.dim}.5)`, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Kitchen</span>
          </div>
        </div>

        {/* Floating order ticket */}
        <div style={{ textAlign: 'center', marginTop: 14, position: 'relative', height: 62 }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', background: 'rgba(10,10,20,0.97)', border: `1px solid ${C.violet.border}.3)`, borderRadius: 10, padding: '7px 14px', boxShadow: `0 6px 28px rgba(0,0,0,.6), 0 0 0 1px ${C.violet.border}.08)`, animation: `rf_ticket ${T} ease-in-out infinite`, pointerEvents: 'none' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: `${C.violet.dim}.45)`, letterSpacing: '0.12em', marginBottom: 4 }}>ORDER #1042</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'rgba(255,255,255,.88)' }}>
              <span>🍔 Classic Burger ×1</span>
              <span>🍟 Fries ×2</span>
            </div>
          </div>
        </div>

        {/* Cycling status text */}
        <div style={{ position: 'relative', height: 18, marginTop: 4, textAlign: 'center' }}>
          {[
            { text: 'Incoming call from customer...', color: C.cyan.main,   anim: `rf_sA ${T} ease-in-out infinite` },
            { text: 'AI taking order — Burger ×1, Fries ×2', color: C.violet.main, anim: `rf_sB ${T} ease-in-out infinite` },
            { text: '✓ Order #1042 sent to kitchen',   color: C.amber.main,  anim: `rf_sC ${T} ease-in-out infinite` },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: s.color, animation: s.anim }}>{s.text}</div>
          ))}
        </div>
      </div>
    </>
  )
}

/* ── Premium glass card ── */
const glass = {
  background: 'rgba(255,255,255,0.055)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 24,
  backdropFilter: 'blur(48px)',
  WebkitBackdropFilter: 'blur(48px)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.65), 0 8px 32px rgba(99,102,241,0.15), inset 0 1.5px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(0,0,0,0.25)',
}

/* ── Input base (no left-pad; icon wrappers add it) ── */
const inputStyle = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 14,
  color: 'rgba(255,255,255,0.93)',
  fontSize: 14,
  padding: '13px 14px 13px 44px',
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.25s, box-shadow 0.25s, background 0.2s',
  boxSizing: 'border-box',
}

const PREMIUM_CSS = `
  .prem-input:focus {
    border-color: rgba(139,92,246,0.7) !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.18), 0 0 16px rgba(139,92,246,0.12) !important;
    background: rgba(255,255,255,0.10) !important;
  }
  .prem-btn {
    position: relative;
    overflow: hidden;
    transition: opacity 0.2s, box-shadow 0.25s, transform 0.15s !important;
  }
  .prem-btn:not(:disabled):hover {
    box-shadow: 0 8px 32px rgba(99,102,241,0.65), 0 0 60px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.22) !important;
    transform: translateY(-1px) !important;
  }
  .prem-btn:not(:disabled):active { transform: translateY(0) !important; }
  .prem-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%);
    background-size: 200% 100%;
    background-position: -200% center;
    transition: background-position 0.5s;
  }
  .prem-btn:not(:disabled):hover::after { background-position: 200% center; }
  .icon-input-wrap { position: relative; }
  .icon-input-wrap .field-icon {
    position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
    pointer-events: none; opacity: 0.38;
  }
  .show-pw-btn {
    position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; padding: 2px; opacity: 0.42;
    color: rgba(255,255,255,0.8); transition: opacity 0.2s;
  }
  .show-pw-btn:hover { opacity: 0.75; }
`

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'otp' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const { loginRequest, login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await loginRequest(email, password)
      if (res.access_token) {
        navigate('/dashboard')
        return
      }
      setDevOtp(res.otp || '')
      setMode('otp')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, otpCode)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired verification code.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    setForgotSent(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#03030a', position: 'relative', overflow: 'hidden' }}>

      {/* ── SVG scene background ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <img src="/login-bg.svg" alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />

        {/* Fine grid overlay on top of SVG */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }} />
      </div>

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex" style={{
        width: 500, flexShrink: 0, flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 52px', position: 'relative', zIndex: 1,
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 0 24px rgba(99,102,241,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PhoneIcon size={18} className="text-white" />
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em' }}>Ringa</span>
        </div>

        {/* Hero */}
        <div>
          {/* pill badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.28)',
            borderRadius: 999, padding: '5px 14px', marginBottom: 22,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6ee7b7', boxShadow: '0 0 8px #6ee7b7', flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Never miss a customer call again</span>
          </div>

          <h2 style={{ fontSize: 40, fontWeight: 900, color: '#fff', lineHeight: 1.12, letterSpacing: '-0.045em', marginBottom: 18 }}>
            Never miss a<br />
            <span style={{ background: 'linear-gradient(90deg, #818cf8 0%, #c084fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              customer call
            </span><br />again.
          </h2>

          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.42)', lineHeight: 1.75, marginBottom: 36, maxWidth: 360 }}>
            Ringa answers every call, takes orders, and sends confirmations — while you focus on running your restaurant.
          </p>

          {/* Animated order flow */}
          <OrderFlowAnimation glass={glass} />

          {/* Stat strip */}
          <div style={{ ...glass, padding: '14px 20px', display: 'flex', gap: 0 }}>
            {STATS.map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none', padding: '0 10px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{s.value}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>Trusted by 500+ restaurants worldwide</div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', position: 'relative', zIndex: 1 }}>
        <style>{PREMIUM_CSS}</style>
        {/* Ambient glow orbs */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(32px)' }} />
        <div style={{ position: 'absolute', bottom: '18%', right: '10%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(24px)' }} />

        {/* Mobile logo — 3D glass, matches Signup */}
        <div className="lg:hidden" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 36 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: -10, borderRadius: 28,
              background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)',
              filter: 'blur(8px)',
            }} />
            <div style={{
              width: 64, height: 64, borderRadius: 20, position: 'relative',
              background: 'linear-gradient(145deg, rgba(148,150,255,0.6) 0%, rgba(99,102,241,0.45) 40%, rgba(139,92,246,0.6) 100%)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.28)',
              boxShadow: '0 0 36px rgba(99,102,241,0.6), 0 16px 40px rgba(0,0,0,0.5), inset 0 1.5px 0 rgba(255,255,255,0.45), inset 1px 0 0 rgba(255,255,255,0.18), inset 0 -1.5px 0 rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'perspective(400px) rotateX(8deg) rotateY(-5deg)',
            }}>
              <div style={{ position: 'absolute', top: 2, left: 4, right: 16, height: '42%', background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)', borderRadius: '12px 12px 50% 50%' }} />
              <PhoneIcon size={26} className="text-white" style={{ position: 'relative', zIndex: 1 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.045em', lineHeight: 1 }}>Ringa</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.03em' }}>Never miss a customer call again</span>
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>

          {mode === 'otp' ? (
            <>
              <button
                onClick={() => { setMode('login'); setOtpCode(''); setDevOtp(''); setError('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
                  color: 'rgba(255,255,255,0.38)', background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, marginBottom: 20,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
                Back
              </button>

              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', marginBottom: 6 }}>
                  Check your email
                </h1>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.36)' }}>
                  We sent a 6-digit code to <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{email}</span>
                </p>
              </div>

              <div style={{ ...glass, padding: '32px 30px 28px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22) 30%, rgba(255,255,255,0.22) 70%, transparent)', borderRadius: 1 }} />
                <form onSubmit={handleVerifyOtp}>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Verification code
                    </label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      autoFocus
                      placeholder="000000"
                      maxLength={6}
                      className="prem-input"
                      style={{ ...inputStyle, fontSize: 24, fontWeight: 700, letterSpacing: '0.35em', textAlign: 'center', padding: '14px 14px' }}
                    />
                    {devOtp && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8, padding: '6px 10px' }}>
                        Dev mode — OTP: <strong>{devOtp}</strong>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div style={{
                      background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)',
                      borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginBottom: 16,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || otpCode.length < 6}
                    className="prem-btn"
                    style={{
                      width: '100%', height: 52, borderRadius: 14, border: 'none',
                      cursor: (loading || otpCode.length < 6) ? 'not-allowed' : 'pointer',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #a855f7 100%)',
                      boxShadow: '0 6px 28px rgba(99,102,241,0.55), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.22)',
                      color: '#fff', fontSize: 15, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: (loading || otpCode.length < 6) ? 0.6 : 1,
                    }}
                  >
                    {loading ? <><SpinnerIcon size={16} /> Verifying...</> : 'Verify & Sign In'}
                  </button>
                </form>

                <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.32)', marginTop: 20, marginBottom: 0 }}>
                  Didn't receive it?{' '}
                  <button
                    onClick={() => { setMode('login'); setOtpCode(''); setDevOtp(''); setError('') }}
                    style={{ color: '#a78bfa', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13 }}
                  >
                    Try again
                  </button>
                </p>
              </div>
            </>

          ) : mode === 'login' ? (
            <>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.045em', marginBottom: 7, lineHeight: 1.15,
                  background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.75) 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  Welcome back
                </h1>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.01em' }}>
                  Sign in to your Ringa dashboard
                </p>
              </div>

              <div style={{ ...glass, padding: '32px 30px 28px', position: 'relative' }}>
                {/* Top glass edge shimmer line */}
                <div style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22) 30%, rgba(255,255,255,0.22) 70%, transparent)', borderRadius: 1 }} />

                <form onSubmit={handleLogin}>
                  {/* Email */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Email address
                    </label>
                    <div className="icon-input-wrap">
                      <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                      </svg>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoFocus
                        placeholder="you@restaurant.com"
                        className="prem-input"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setError(''); setForgotSent(false) }}
                        style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '-0.01em' }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="icon-input-wrap">
                      <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="prem-input"
                        style={{ ...inputStyle, paddingRight: 44 }}
                      />
                      <button type="button" className="show-pw-btn" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                        {showPassword ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div style={{
                      background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)',
                      borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginBottom: 18,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {error}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="prem-btn"
                    style={{
                      width: '100%', height: 52, borderRadius: 14, border: 'none',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #a855f7 100%)',
                      boxShadow: '0 6px 28px rgba(99,102,241,0.55), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.22)',
                      color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: '0.005em',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? <><SpinnerIcon size={16} /> Signing in...</> : 'Sign In'}
                  </button>
                </form>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 18px' }}>
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10))' }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: '0.08em' }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.10), transparent)' }} />
                </div>

                <p style={{ textAlign: 'center', fontSize: 13.5, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                  Don't have an account?{' '}
                  <Link to="/signup" style={{ color: '#a78bfa', fontWeight: 700, textDecoration: 'none', letterSpacing: '-0.01em' }}>
                    Start free trial →
                  </Link>
                </p>
              </div>
            </>

          ) : (
            <>
              <button
                onClick={() => { setMode('login'); setForgotSent(false); setError('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
                  color: 'rgba(255,255,255,0.38)', background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, marginBottom: 20,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
                Back to sign in
              </button>

              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', marginBottom: 6 }}>
                  Reset password
                </h1>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.36)' }}>
                  Enter your email and we'll send a reset link
                </p>
              </div>

              <div style={{ ...glass, padding: '32px 30px 28px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22) 30%, rgba(255,255,255,0.22) 70%, transparent)', borderRadius: 1 }} />
                {forgotSent ? (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%', margin: '0 auto 16px',
                      background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CheckIcon size={22} style={{ color: '#818cf8' }} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Check your inbox</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.65 }}>
                      If an account exists for{' '}
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{email}</span>
                      , you'll receive a reset link shortly.
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleForgot}>
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Email address
                      </label>
                      <div className="icon-input-wrap">
                        <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          autoFocus
                          placeholder="you@restaurant.com"
                          className="prem-input"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="prem-btn"
                      style={{
                        width: '100%', height: 52, borderRadius: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #a855f7 100%)',
                        boxShadow: '0 6px 28px rgba(99,102,241,0.55), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.22)',
                        color: '#fff', fontSize: 15, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        opacity: loading ? 0.7 : 1,
                      }}
                    >
                      {loading ? <><SpinnerIcon size={16} /> Sending...</> : 'Send Reset Link'}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}

          <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.16)', marginTop: 28, lineHeight: 1.7 }}>
            By continuing you agree to Ringa's{' '}
            <span style={{ color: 'rgba(255,255,255,0.32)', cursor: 'pointer' }}>Terms of Service</span>
            {' '}and{' '}
            <span style={{ color: 'rgba(255,255,255,0.32)', cursor: 'pointer' }}>Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  )
}
