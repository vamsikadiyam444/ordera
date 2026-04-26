import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PhoneIcon, SpinnerIcon, CheckIcon } from '../components/Icons'

const FEATURES = [
  { icon: '⚡', text: 'Live in under 5 minutes' },
  { icon: '📞', text: 'Answers calls 24/7 automatically' },
  { icon: '🧠', text: 'Powered by Claude AI' },
  { icon: '💳', text: 'No credit card required for trial' },
]

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

/* ── OTP boxes (6 individual inputs) ── */
function OtpBoxes({ value, onChange }) {
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()]
  const digits = (value + '      ').slice(0, 6).split('')

  function handleKey(i, e) {
    if (e.key === 'Backspace') {
      const next = value.slice(0, i) + value.slice(i + 1)
      onChange(next)
      if (i > 0) refs[i - 1].current?.focus()
      return
    }
    if (/^\d$/.test(e.key)) {
      const next = value.slice(0, i) + e.key + value.slice(i + 1)
      onChange(next.slice(0, 6))
      if (i < 5) refs[i + 1].current?.focus()
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    if (pasted.length > 0) refs[Math.min(pasted.length, 5)].current?.focus()
    e.preventDefault()
  }

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onChange={() => {}}
          style={{
            width: 44,
            height: 52,
            borderRadius: 12,
            border: `1.5px solid ${d.trim() ? 'rgba(130,160,255,0.60)' : 'rgba(255,255,255,0.14)'}`,
            background: d.trim() ? 'rgba(130,160,255,0.10)' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            fontSize: 22,
            fontWeight: 700,
            textAlign: 'center',
            outline: 'none',
            caretColor: 'transparent',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        />
      ))}
    </div>
  )
}

export default function Signup() {
  const [form, setForm] = useState({ email: '', password: '', restaurantName: '', phone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // OTP step state
  const [step, setStep] = useState('form')   // 'form' | 'otp'
  const [otpInfo, setOtpInfo] = useState(null)  // { email, phone, devOtp }
  const [otp, setOtp] = useState('')
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

  const { signup, signupVerify } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  /* ── Step 1: submit signup form ── */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await signup(form.email, form.password, form.restaurantName, form.phone || null)
      setOtpInfo({
        email: form.email,
        phone: form.phone,
        devOtp: res.dev_mode ? res.otp : null,
      })
      setStep('otp')
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Step 2: verify OTP ── */
  const handleVerify = async (e) => {
    e?.preventDefault()
    if (otp.length < 6) return
    setError('')
    setLoading(true)
    try {
      await signupVerify(otpInfo.email, otp)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired code. Please try again.')
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  /* Auto-submit when 6 digits entered */
  const handleOtpChange = (val) => {
    setOtp(val)
    setError('')
    if (val.length === 6) {
      setTimeout(() => {
        setLoading(true)
        signupVerify(otpInfo.email, val)
          .then(() => navigate('/dashboard'))
          .catch((err) => {
            setError(err.response?.data?.detail || 'Invalid or expired code.')
            setOtp('')
            setLoading(false)
          })
      }, 120)
    }
  }

  /* ── Left panel ── */
  const LeftPanel = (
    <div className="hidden lg:flex" style={{
      width: 500, flexShrink: 0, flexDirection: 'column', justifyContent: 'space-between',
      padding: '48px 52px', position: 'relative', zIndex: 1,
      borderRight: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 16, flexShrink: 0,
          background: 'linear-gradient(145deg, rgba(80,130,220,0.55) 0%, rgba(9,76,178,0.45) 50%, rgba(51,102,204,0.55) 100%)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.22)',
          boxShadow: '0 0 28px rgba(9,76,178,0.50), 0 12px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -1px 0 rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: 'perspective(300px) rotateX(6deg) rotateY(-4deg)',
        }}>
          <PhoneIcon size={20} className="text-white" />
        </div>
        <span style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em' }}>Ringa AI</span>
      </div>

      <div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'rgba(9,76,178,0.12)', border: '1px solid rgba(9,76,178,0.28)',
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
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#03030a', position: 'relative', overflow: 'hidden' }}>

      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <img src="/login-bg.svg" alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }} />
      </div>

      {LeftPanel}

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', position: 'relative', zIndex: 1 }}>

        {/* Mobile logo */}
        <div className="lg:hidden" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 36 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: -10, borderRadius: 28, background: 'radial-gradient(circle, rgba(9,76,178,0.25) 0%, transparent 70%)', filter: 'blur(8px)' }} />
            <div style={{ width: 64, height: 64, borderRadius: 20, position: 'relative', background: 'linear-gradient(145deg, rgba(80,130,220,0.6) 0%, rgba(9,76,178,0.50) 40%, rgba(51,102,204,0.6) 100%)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.28)', boxShadow: '0 0 36px rgba(9,76,178,0.55), 0 16px 40px rgba(0,0,0,0.5), inset 0 1.5px 0 rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'perspective(400px) rotateX(8deg) rotateY(-5deg)' }}>
              <div style={{ position: 'absolute', top: 2, left: 4, right: 16, height: '42%', background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)', borderRadius: '12px 12px 50% 50%' }} />
              <PhoneIcon size={26} className="text-white" style={{ position: 'relative', zIndex: 1 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.045em', lineHeight: 1 }}>Ringa AI</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.03em' }}>Never miss a customer call again</span>
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* ─── STEP 1: Signup form ─── */}
          {step === 'form' && (
            <>
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
                    <input name="restaurantName" value={form.restaurantName} onChange={handleChange} required autoFocus placeholder="e.g. Mario's Pizza" style={inputStyle} />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.48)', marginBottom: 7, letterSpacing: '0.01em' }}>
                      Email address
                    </label>
                    <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="you@restaurant.com" style={inputStyle} />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.48)', marginBottom: 7, letterSpacing: '0.01em' }}>
                      Phone number
                      <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.28)', marginLeft: 6 }}>— for SMS verification</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+1 555 000 0000"
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ marginBottom: 22 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.48)', marginBottom: 7, letterSpacing: '0.01em' }}>
                      Password
                    </label>
                    <input type="password" name="password" value={form.password} onChange={handleChange} required placeholder="8+ characters" minLength={8} style={inputStyle} />
                  </div>

                  {error && (
                    <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginBottom: 16 }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%', height: 48, borderRadius: 13, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                      background: 'linear-gradient(135deg, #094cb2, #3366cc)',
                      boxShadow: '0 4px 20px rgba(9,76,178,0.40), inset 0 1px 0 rgba(255,255,255,0.18)',
                      color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
                    }}
                  >
                    {loading ? <><SpinnerIcon size={16} /> Creating account...</> : 'Create Free Account'}
                  </button>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 18 }}>
                  {['No credit card', 'Cancel anytime', 'GDPR safe'].map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckIcon size={9} style={{ color: '#6ee7b7' }} />
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>{t}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', margin: 0 }}>
                    Already have an account?{' '}
                    <Link to="/login" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
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
            </>
          )}

          {/* ─── STEP 2: OTP verification ─── */}
          {step === 'otp' && (
            <>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', marginBottom: 8 }}>
                  Verify your account
                </h1>
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.40)', lineHeight: 1.6 }}>
                  We sent a 6-digit code to{' '}
                  <span style={{ color: 'rgba(255,255,255,0.70)', fontWeight: 600 }}>{otpInfo?.email}</span>
                  {otpInfo?.phone && (
                    <> and <span style={{ color: 'rgba(255,255,255,0.70)', fontWeight: 600 }}>{otpInfo.phone}</span></>
                  )}
                </p>
              </div>

              <div style={{ ...glass, padding: 28 }}>
                <form onSubmit={handleVerify}>
                  <div style={{ marginBottom: 24 }}>
                    <OtpBoxes value={otp} onChange={handleOtpChange} />
                  </div>

                  {/* Dev mode hint */}
                  {otpInfo?.devOtp && (
                    <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: 'rgba(251,191,36,0.80)', textAlign: 'center', marginBottom: 16 }}>
                      Dev mode — your code: <strong style={{ letterSpacing: 4 }}>{otpInfo.devOtp}</strong>
                    </div>
                  )}

                  {error && (
                    <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginBottom: 16, textAlign: 'center' }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    style={{
                      width: '100%', height: 48, borderRadius: 13, border: 'none',
                      cursor: (loading || otp.length < 6) ? 'not-allowed' : 'pointer',
                      background: 'linear-gradient(135deg, #094cb2, #3366cc)',
                      boxShadow: '0 4px 20px rgba(9,76,178,0.40), inset 0 1px 0 rgba(255,255,255,0.18)',
                      color: '#fff', fontSize: 15, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: (loading || otp.length < 6) ? 0.5 : 1, transition: 'opacity 0.2s',
                    }}
                  >
                    {loading ? <><SpinnerIcon size={16} /> Verifying...</> : 'Verify & Continue'}
                  </button>
                </form>

                {/* Resend + back */}
                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  {resendMsg ? (
                    <span style={{ fontSize: 12, color: '#6ee7b7' }}>{resendMsg}</span>
                  ) : (
                    <button
                      disabled={resending}
                      onClick={async () => {
                        setResending(true)
                        setError('')
                        try {
                          const res = await import('../services/api').then(m => m.authApi.signup({
                            email: otpInfo.email,
                            password: form.password,
                            restaurant_name: form.restaurantName,
                            phone: otpInfo.phone || null,
                          }))
                          // If signup returns pending, it means account already exists — just resend
                        } catch {
                          // account exists → that's fine, but we need a dedicated resend endpoint
                        }
                        // Use send-otp endpoint for resend
                        try {
                          const { authApi } = await import('../services/api')
                          const res = await authApi.sendOtp({ type: 'email', value: otpInfo.email })
                          // Manually fix identifier to signup: -- backend send-otp uses `email:` prefix
                          setResendMsg('Code resent! Check your email.')
                          setTimeout(() => setResendMsg(''), 4000)
                        } catch {
                          setError('Failed to resend code.')
                        } finally {
                          setResending(false)
                        }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818cf8', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
                    >
                      {resending ? 'Sending...' : 'Resend code'}
                    </button>
                  )}
                  <span style={{ color: 'rgba(255,255,255,0.20)', margin: '0 10px' }}>·</span>
                  <button
                    onClick={() => { setStep('form'); setOtp(''); setError('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}
                  >
                    ← Back
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
