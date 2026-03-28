import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PhoneIcon, SpinnerIcon, CheckIcon } from '../components/Icons'

const FEATURES = [
  { icon: '⚡', text: 'Live in under 5 minutes' },
  { icon: '📞', text: 'Answers calls 24/7 automatically' },
  { icon: '🧠', text: 'Powered by Claude AI' },
  { icon: '💳', text: 'No credit card required for trial' },
]

/* ── shared glass card style ── */
const glass = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 20,
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
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
  boxSizing: 'border-box',
}

export default function Signup() {
  const [form, setForm] = useState({ email: '', password: '', restaurantName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signup(form.email, form.password, form.restaurantName)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#03030a', position: 'relative', overflow: 'hidden' }}>

      {/* ── SVG scene background (shared with login) ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <img src="/login-bg.svg" alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 16, flexShrink: 0,
            background: 'linear-gradient(145deg, rgba(129,140,248,0.55) 0%, rgba(99,102,241,0.4) 50%, rgba(139,92,246,0.55) 100%)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.22)',
            boxShadow: '0 0 28px rgba(99,102,241,0.55), 0 12px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -1px 0 rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: 'perspective(300px) rotateX(6deg) rotateY(-4deg)',
          }}>
            <PhoneIcon size={20} className="text-white" />
          </div>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em' }}>Ringa</span>
        </div>

        {/* Hero */}
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.28)',
            borderRadius: 999, padding: '5px 14px', marginBottom: 22,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6ee7b7', boxShadow: '0 0 8px #6ee7b7', flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Free Trial — No card needed</span>
          </div>

          <h2 style={{ fontSize: 40, fontWeight: 900, color: '#fff', lineHeight: 1.12, letterSpacing: '-0.045em', marginBottom: 18 }}>
            Never miss a<br />
            <span style={{ background: 'linear-gradient(90deg, #818cf8 0%, #c084fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              customer call
            </span><br />again.
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 36 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{f.icon}</span>
                <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.56)' }}>{f.text}</span>
              </div>
            ))}
          </div>

          {/* Testimonial glass card */}
          <div style={{ ...glass, padding: '20px 22px' }}>
            <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
              {[...Array(5)].map((_, i) => (
                <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 1.65, fontStyle: 'italic', marginBottom: 12 }}>
              "Ringa paid for itself in the first week. We stopped missing dinner rush calls entirely."
            </p>
            <div style={{ fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Maria S.</span>
              <span style={{ color: 'rgba(255,255,255,0.28)' }}> — Owner, Bella Cucina</span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>Trusted by 500+ restaurants worldwide</div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', position: 'relative', zIndex: 1 }}>

        {/* Mobile logo — 3D glass, horizontal layout */}
        <div className="lg:hidden" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 36 }}>
          {/* Icon */}
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
          {/* Text stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.045em', lineHeight: 1 }}>Ringa</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.03em' }}>Never miss a customer call again</span>
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', marginBottom: 6 }}>
              Create your account
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.36)' }}>
              Start free — no credit card needed
            </p>
          </div>

          <div style={{ ...glass, padding: 28 }}>
            <form onSubmit={handleSubmit}>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.48)', marginBottom: 7, letterSpacing: '0.01em' }}>
                  Restaurant name
                </label>
                <input
                  name="restaurantName"
                  value={form.restaurantName}
                  onChange={handleChange}
                  required
                  autoFocus
                  placeholder="e.g. Mario's Pizza"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.48)', marginBottom: 7, letterSpacing: '0.01em' }}>
                  Email address
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="you@restaurant.com"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.48)', marginBottom: 7, letterSpacing: '0.01em' }}>
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  placeholder="8+ characters"
                  minLength={8}
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

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', height: 48, borderRadius: 13, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
                  color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
                }}
              >
                {loading ? <><SpinnerIcon size={16} /> Creating account...</> : 'Create Free Account'}
              </button>
            </form>

            {/* Trust badges */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 18 }}>
              {['No credit card', 'Cancel anytime', 'GDPR safe'].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckIcon size={9} style={{ color: '#6ee7b7' }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>{t}</span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', margin: 0 }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
                  Sign in
                </Link>
              </p>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.16)', marginTop: 24, lineHeight: 1.7 }}>
            By creating an account you agree to Ringa's{' '}
            <span style={{ color: 'rgba(255,255,255,0.32)', cursor: 'pointer' }}>Terms</span>
            {' '}and{' '}
            <span style={{ color: 'rgba(255,255,255,0.32)', cursor: 'pointer' }}>Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  )
}
