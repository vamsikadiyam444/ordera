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

/* ── shared glass card style ── */
const glass = {
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(255,255,255,0.11)',
  borderRadius: 20,
  backdropFilter: 'blur(32px)',
  WebkitBackdropFilter: 'blur(32px)',
  boxShadow: '0 8px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.2)',
}

const inputStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 12,
  color: 'rgba(255,255,255,0.90)',
  fontSize: 14,
  padding: '11px 14px',
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
}

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password.')
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

          {mode === 'login' ? (
            <>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', marginBottom: 6 }}>
                  Welcome back
                </h1>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.36)' }}>
                  Sign in to your Ringa dashboard
                </p>
              </div>

              <div style={{ ...glass, padding: 28 }}>
                <form onSubmit={handleLogin}>
                  {/* Email */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.48)', marginBottom: 7, letterSpacing: '0.01em' }}>
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                      placeholder="you@restaurant.com"
                      style={inputStyle}
                    />
                  </div>

                  {/* Password */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.48)', letterSpacing: '0.01em' }}>
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setError(''); setForgotSent(false) }}
                        style={{ fontSize: 12, fontWeight: 500, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      style={inputStyle}
                    />
                  </div>

                  {error && (
                    <div style={{
                      background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)',
                      borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginBottom: 16,
                    }}>
                      {error}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%', height: 48, borderRadius: 13, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      boxShadow: '0 4px 20px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
                      color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'opacity 0.2s', opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? <><SpinnerIcon size={16} /> Signing in...</> : 'Sign In'}
                  </button>
                </form>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', fontWeight: 500 }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
                </div>

                <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.32)', margin: 0 }}>
                  Don't have an account?{' '}
                  <Link to="/signup" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
                    Start free trial
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

              <div style={{ ...glass, padding: 28 }}>
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
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.48)', marginBottom: 7 }}>
                        Email address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoFocus
                        placeholder="you@restaurant.com"
                        style={inputStyle}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        width: '100%', height: 48, borderRadius: 13, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        boxShadow: '0 4px 20px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
                        color: '#fff', fontSize: 15, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
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
