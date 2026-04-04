import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { restaurantApi, authApi, subscriptionApi, gmailApi } from '../services/api'

/* ── Constants ── */
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const SHORT = { Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu', Friday:'Fri', Saturday:'Sat', Sunday:'Sun' }
const DEFAULT_HOURS = {
  Monday:    { open: '11:00', close: '22:00', closed: false },
  Tuesday:   { open: '11:00', close: '22:00', closed: false },
  Wednesday: { open: '11:00', close: '22:00', closed: false },
  Thursday:  { open: '11:00', close: '22:00', closed: false },
  Friday:    { open: '11:00', close: '23:00', closed: false },
  Saturday:  { open: '11:00', close: '23:00', closed: false },
  Sunday:    { open: '12:00', close: '21:00', closed: false },
}
const TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern Time',  short: 'ET' },
  { value: 'America/Chicago',     label: 'Central Time',  short: 'CT' },
  { value: 'America/Denver',      label: 'Mountain Time', short: 'MT' },
  { value: 'America/Los_Angeles', label: 'Pacific Time',  short: 'PT' },
]
const ROLES = ['Manager','Chef','Server','Host','Bartender','Delivery','Cashier','Busser']
const ROLE_COLORS = {
  Manager:  { bg: '#EEF2FF', text: '#4338CA', dot: '#6366F1' },
  Chef:     { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
  Server:   { bg: '#F0FDF4', text: '#166534', dot: '#22C55E' },
  Host:     { bg: '#FDF4FF', text: '#86198F', dot: '#D946EF' },
  Bartender:{ bg: '#FEF9C3', text: '#854D0E', dot: '#EAB308' },
  Delivery: { bg: '#ECFEFF', text: '#155E75', dot: '#06B6D4' },
  Cashier:  { bg: '#FFF1F2', text: '#9F1239', dot: '#FB7185' },
  Busser:   { bg: '#F1F5F9', text: '#475569', dot: '#64748B' },
}

/* ── Helpers ── */
function parseOldHours(str) {
  try {
    const parsed = JSON.parse(str)
    if (parsed.Monday?.open) return parsed
    const result = {}
    for (const [day, val] of Object.entries(parsed)) {
      if (val === 'Closed' || val === 'closed') {
        result[day] = { open: '11:00', close: '22:00', closed: true }
      } else {
        result[day] = { open: '11:00', close: '22:00', closed: false }
      }
    }
    return result
  } catch { return DEFAULT_HOURS }
}

/* ── Small Components ── */

function ToggleSwitch({ checked, onChange, size = 'md' }) {
  const w = size === 'sm' ? 36 : 44
  const h = size === 'sm' ? 20 : 24
  const dot = size === 'sm' ? 14 : 18
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: w, height: h, borderRadius: h,
        background: checked ? '#4F46E5' : '#CBD5E1',
        padding: 3,
        display: 'flex', alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: 'background 0.2s ease',
        cursor: 'pointer', border: 'none',
      }}
    >
      <div style={{
        width: dot, height: dot, borderRadius: '50%',
        background: '#FFF',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        transition: 'all 0.2s ease',
      }} />
    </button>
  )
}

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 18px',
      background: type === 'success' ? '#F0FDF4' : '#FEF2F2',
      border: `1px solid ${type === 'success' ? '#BBF7D0' : '#FECACA'}`,
      borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: type === 'success' ? '#22C55E' : '#EF4444',
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 13, fontWeight: 500, color: type === 'success' ? '#166534' : '#991B1B' }}>
        {message}
      </span>
    </div>
  )
}

function Card({ title, description, children, style: extraStyle }) {
  return (
    <div style={{
      background: '#FFF',
      border: '1px solid #E5E7EB',
      borderRadius: 12,
      padding: '24px',
      ...extraStyle,
    }}>
      {title && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h3>
          {description && <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4, margin: 0 }}>{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

function Label({ children }) {
  return <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>{children}</label>
}

function Hint({ children }) {
  return <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4, margin: 0 }}>{children}</p>
}

function Input({ value, onChange, placeholder, type = 'text', disabled, style: extraStyle, ...rest }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '9px 12px',
        fontSize: 14, fontFamily: 'inherit',
        color: disabled ? '#9CA3AF' : '#111827',
        background: disabled ? '#F9FAFB' : '#FFF',
        border: `1px solid ${focused ? '#4F46E5' : '#D1D5DB'}`,
        borderRadius: 8,
        outline: 'none',
        transition: 'border-color 0.15s ease',
        ...extraStyle,
      }}
      {...rest}
    />
  )
}

function Btn({ children, onClick, disabled, variant = 'primary', size = 'md', style: extraStyle, ...rest }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontFamily: 'inherit', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none', borderRadius: 8, transition: 'all 0.15s ease',
    opacity: disabled ? 0.6 : 1,
  }
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 13 },
    md: { padding: '9px 16px', fontSize: 14 },
    lg: { padding: '11px 20px', fontSize: 14 },
  }
  const variants = {
    primary: { background: '#4F46E5', color: '#FFF' },
    secondary: { background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB' },
    danger: { background: '#FFF', color: '#DC2626', border: '1px solid #FECACA' },
    'danger-solid': { background: '#DC2626', color: '#FFF' },
    ghost: { background: 'transparent', color: '#6B7280' },
  }
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant], ...extraStyle }}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ── OTP Input ── */
function OtpInput({ value, onChange }) {
  const inputsRef = useRef([])

  const handleChange = (i, val) => {
    if (!/^\d*$/.test(val)) return
    const digits = value.split('')
    while (digits.length < 6) digits.push('')
    digits[i] = val.slice(-1)
    const newVal = digits.join('')
    onChange(newVal)
    if (val && i < 5) inputsRef.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      inputsRef.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    const focusIdx = Math.min(pasted.length, 5)
    inputsRef.current[focusIdx]?.focus()
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[0,1,2,3,4,5].map(i => (
        <input
          key={i}
          ref={el => inputsRef.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          style={{
            width: 42, height: 46,
            textAlign: 'center',
            fontSize: 20, fontWeight: 600, fontFamily: 'inherit',
            border: `1px solid ${value[i] ? '#4F46E5' : '#D1D5DB'}`,
            borderRadius: 8,
            outline: 'none',
            color: '#111827',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={e => { e.target.style.borderColor = '#4F46E5' }}
          onBlur={e => { if (!value[i]) e.target.style.borderColor = '#D1D5DB' }}
        />
      ))}
    </div>
  )
}

/* ── Employee Modal ── */
function EmployeeModal({ employee, onSave, onClose }) {
  const [form, setForm] = useState(employee || {
    name: '', role: 'Server', phone: '', email: '',
    schedule: DAYS.reduce((acc, d) => ({ ...acc, [d]: { start: '09:00', end: '17:00', off: false } }), {}),
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#FFF', border: '1px solid #E5E7EB',
        borderRadius: 14, width: '100%', maxWidth: 520,
        maxHeight: '85vh', overflow: 'auto',
        padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>
            {employee ? 'Edit Employee' : 'Add Employee'}
          </h3>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: '1px solid #E5E7EB',
            background: '#FFF', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <Label>Full Name</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
          </div>
          <div>
            <Label>Role</Label>
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 12px', fontSize: 14, fontFamily: 'inherit',
                color: '#111827', background: '#FFF',
                border: '1px solid #D1D5DB', borderRadius: 8,
                outline: 'none', cursor: 'pointer',
              }}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@email.com" type="email" />
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 10 }}>Weekly Schedule</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {DAYS.map(day => {
            const s = form.schedule[day]
            return (
              <div key={day} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                background: s.off ? '#F9FAFB' : '#FFF',
                border: '1px solid #F3F4F6',
              }}>
                <span style={{ width: 36, fontSize: 13, fontWeight: 500, color: s.off ? '#9CA3AF' : '#374151' }}>
                  {SHORT[day]}
                </span>
                <ToggleSwitch size="sm" checked={!s.off} onChange={v =>
                  setForm({ ...form, schedule: { ...form.schedule, [day]: { ...s, off: !v } } })
                } />
                {!s.off ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <input type="time" value={s.start} onChange={e =>
                      setForm({ ...form, schedule: { ...form.schedule, [day]: { ...s, start: e.target.value } } })
                    } style={{ padding: '5px 8px', fontSize: 13, border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none', flex: 1, fontFamily: 'inherit' }} />
                    <span style={{ color: '#9CA3AF', fontSize: 12 }}>to</span>
                    <input type="time" value={s.end} onChange={e =>
                      setForm({ ...form, schedule: { ...form.schedule, [day]: { ...s, end: e.target.value } } })
                    } style={{ padding: '5px 8px', fontSize: 13, border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none', flex: 1, fontFamily: 'inherit' }} />
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: '#9CA3AF' }}>Day off</span>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => { if (form.name.trim()) onSave({ ...form, id: form.id || crypto.randomUUID() }) }}>
            {employee ? 'Save Changes' : 'Add Employee'}
          </Btn>
        </div>
      </div>
    </div>
  )
}


/* ════════════════════════════════════════════════════════════════════════════
   Main Settings Component
   ════════════════════════════════════════════════════════════════════════════ */
export default function Settings() {
  const [form, setForm] = useState({
    name: '', address: '', phone: '', estimated_wait_minutes: '20', timezone: 'America/New_York',
  })
  const [hours, setHours] = useState(DEFAULT_HOURS)
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null)
  const [activeTab, setActiveTab] = useState('info')
  const navigate = useNavigate()

  // Account tab
  const [account, setAccount] = useState({ email: '', phone: '' })
  const [emailForm, setEmailForm] = useState({ new_email: '', password: '', code: '' })
  const [phoneForm, setPhoneForm] = useState({ phone: '', code: '' })
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [currentPlan, setCurrentPlan] = useState('basic')
  const [savingAccount, setSavingAccount] = useState(null)
  const [cancelStep, setCancelStep] = useState(0)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelReasonOther, setCancelReasonOther] = useState('')

  // OTP state
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [emailOtpCountdown, setEmailOtpCountdown] = useState(0)
  const [phoneOtpCountdown, setPhoneOtpCountdown] = useState(0)
  const [devOtp, setDevOtp] = useState(null) // shows OTP in dev mode

  // Gmail OAuth2 state
  const [gmailStatus, setGmailStatus]         = useState(null) // null | { connected, email }
  const [gmailLoading, setGmailLoading]       = useState(false)
  const [testEmailSending, setTestEmailSending] = useState(false)

  // OTP countdown timers
  useEffect(() => {
    if (emailOtpCountdown <= 0) return
    const t = setTimeout(() => setEmailOtpCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [emailOtpCountdown])

  useEffect(() => {
    if (phoneOtpCountdown <= 0) return
    const t = setTimeout(() => setPhoneOtpCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phoneOtpCountdown])

  useEffect(() => {
    Promise.all([
      restaurantApi.get(),
      authApi.me(),
      subscriptionApi.getCurrent().catch(() => null),
    ]).then(([restRes, meRes, subRes]) => {
      const r = restRes.data
      setForm({
        name: r.name || '', address: r.address || '', phone: r.phone || '',
        estimated_wait_minutes: r.estimated_wait_minutes || '20',
        timezone: r.timezone || 'America/New_York',
      })
      if (r.hours) setHours(parseOldHours(r.hours))
      if (r.employees) {
        try { setEmployees(JSON.parse(r.employees)) } catch {}
      }
      const me = meRes.data
      setAccount({ email: me.email || '', phone: r.phone || '' })
      setEmailForm(prev => ({ ...prev, new_email: me.email || '' }))
      setPhoneForm(prev => ({ ...prev, phone: r.phone || '' }))
      if (subRes?.data?.current_plan) setCurrentPlan(subRes.data.current_plan)
      else if (me.plan) setCurrentPlan(me.plan)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Gmail status + OAuth2 callback URL param handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gmailParam = params.get('gmail')
    if (gmailParam === 'connected') {
      const email = params.get('email') || 'your Gmail account'
      setToast({ message: `Gmail connected! Sending as ${email}`, type: 'success' })
      window.history.replaceState({}, '', '/settings')
      setActiveTab('email')
    } else if (gmailParam === 'denied') {
      setToast({ message: 'Gmail authorization was denied', type: 'error' })
      window.history.replaceState({}, '', '/settings')
      setActiveTab('email')
    } else if (gmailParam === 'error') {
      setToast({ message: 'Gmail connection failed. Try again.', type: 'error' })
      window.history.replaceState({}, '', '/settings')
      setActiveTab('email')
    }
    gmailApi.status()
      .then(res => setGmailStatus(res.data))
      .catch(() => setGmailStatus({ connected: false }))
  }, [])

  /* ── Handlers ── */
  const handleSave = async () => {
    setSaving(true)
    try {
      await restaurantApi.update({
        ...form,
        hours: JSON.stringify(hours),
        employees: JSON.stringify(employees),
      })
      setToast({ message: 'Settings saved', type: 'success' })
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to save', type: 'error' })
    } finally { setSaving(false) }
  }

  const saveEmployee = (emp) => {
    if (typeof modal === 'object' && modal?.id) {
      setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e))
    } else {
      setEmployees(prev => [...prev, emp])
    }
    setModal(null)
  }
  const deleteEmployee = (id) => setEmployees(prev => prev.filter(e => e.id !== id))

  // ── Send OTP ──
  const handleSendEmailOtp = async () => {
    if (!emailForm.new_email) {
      setToast({ message: 'Enter the new email first', type: 'error' }); return
    }
    if (emailForm.new_email === account.email) {
      setToast({ message: 'New email is the same as current', type: 'error' }); return
    }
    setSavingAccount('email-otp')
    try {
      const res = await authApi.sendOtp({ type: 'email', value: emailForm.new_email })
      setEmailOtpSent(true)
      setEmailOtpCountdown(60)
      setEmailForm(prev => ({ ...prev, code: '' }))
      // Dev mode: show the OTP code
      if (res.data?.otp) setDevOtp({ type: 'email', code: res.data.otp })
      setToast({ message: `Verification code sent to ${emailForm.new_email}`, type: 'success' })
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to send code', type: 'error' })
    } finally { setSavingAccount(null) }
  }

  const handleSendPhoneOtp = async () => {
    if (!phoneForm.phone) {
      setToast({ message: 'Enter the phone number first', type: 'error' }); return
    }
    if (phoneForm.phone === account.phone) {
      setToast({ message: 'Phone number is the same as current', type: 'error' }); return
    }
    setSavingAccount('phone-otp')
    try {
      const res = await authApi.sendOtp({ type: 'phone', value: phoneForm.phone })
      setPhoneOtpSent(true)
      setPhoneOtpCountdown(60)
      setPhoneForm(prev => ({ ...prev, code: '' }))
      if (res.data?.otp) setDevOtp({ type: 'phone', code: res.data.otp })
      setToast({ message: `Verification code sent to ${phoneForm.phone}`, type: 'success' })
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to send code', type: 'error' })
    } finally { setSavingAccount(null) }
  }

  // ── Verify & Update ──
  const handleUpdateEmail = async () => {
    if (!emailForm.code || emailForm.code.length < 6) {
      setToast({ message: 'Enter the 6-digit code', type: 'error' }); return
    }
    if (!emailForm.password) {
      setToast({ message: 'Enter your current password', type: 'error' }); return
    }
    setSavingAccount('email')
    try {
      const res = await authApi.updateEmail({
        new_email: emailForm.new_email,
        code: emailForm.code,
        password: emailForm.password,
      })
      setAccount(prev => ({ ...prev, email: res.data.email }))
      setEmailForm({ new_email: res.data.email, password: '', code: '' })
      setEmailOtpSent(false)
      setDevOtp(null)
      const owner = JSON.parse(localStorage.getItem('owner') || '{}')
      owner.email = res.data.email
      localStorage.setItem('owner', JSON.stringify(owner))
      setToast({ message: 'Email updated', type: 'success' })
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to update email', type: 'error' })
    } finally { setSavingAccount(null) }
  }

  const handleUpdatePhone = async () => {
    if (!phoneForm.code || phoneForm.code.length < 6) {
      setToast({ message: 'Enter the 6-digit code', type: 'error' }); return
    }
    setSavingAccount('phone')
    try {
      await authApi.updatePhone({ phone: phoneForm.phone, code: phoneForm.code })
      setAccount(prev => ({ ...prev, phone: phoneForm.phone }))
      setForm(prev => ({ ...prev, phone: phoneForm.phone }))
      setPhoneOtpSent(false)
      setPhoneForm(prev => ({ ...prev, code: '' }))
      setDevOtp(null)
      setToast({ message: 'Phone number updated', type: 'success' })
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to update phone', type: 'error' })
    } finally { setSavingAccount(null) }
  }

  const handleUpdatePassword = async () => {
    if (!passwordForm.current_password || !passwordForm.new_password) {
      setToast({ message: 'All password fields are required', type: 'error' }); return
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setToast({ message: 'Passwords do not match', type: 'error' }); return
    }
    if (passwordForm.new_password.length < 6) {
      setToast({ message: 'Password must be at least 6 characters', type: 'error' }); return
    }
    setSavingAccount('password')
    try {
      await authApi.updatePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
      setToast({ message: 'Password updated', type: 'success' })
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to update password', type: 'error' })
    } finally { setSavingAccount(null) }
  }

  const handleManageBilling = () => {
    navigate('/subscription')
  }

  const PLAN_HIERARCHY = { enterprise: 'pro', pro: 'basic' }
  const PLAN_PRICES = { enterprise: '$399/mo', pro: '$149/mo', basic: 'Free' }
  const PLAN_LABELS = { enterprise: 'Enterprise', pro: 'Pro', basic: 'Basic' }
  const CANCEL_REASONS = [
    'Too expensive',
    'Not using it enough',
    'Missing features I need',
    'Switching to another service',
    'Business is closing',
    'Just testing / evaluating',
    'Other',
  ]
  const lowerPlan = PLAN_HIERARCHY[currentPlan] || null

  const handleDowngrade = async () => {
    if (!lowerPlan) return
    setSavingAccount('downgrade')
    try {
      const res = await subscriptionApi.changePlan(lowerPlan)
      const newPlan = res.data?.new_plan || lowerPlan
      setCurrentPlan(newPlan)
      setCancelStep(0); setCancelReason(''); setCancelReasonOther('')
      const owner = JSON.parse(localStorage.getItem('owner') || '{}')
      owner.plan = newPlan
      localStorage.setItem('owner', JSON.stringify(owner))
      setToast({ message: `Downgraded to ${PLAN_LABELS[newPlan]}`, type: 'success' })
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to downgrade', type: 'error' })
    } finally { setSavingAccount(null) }
  }

  const handleCancelSubscription = async () => {
    setSavingAccount('cancel')
    try {
      const res = await subscriptionApi.cancel()
      setCurrentPlan(res.data?.new_plan || 'basic')
      setCancelStep(0); setCancelReason(''); setCancelReasonOther('')
      const owner = JSON.parse(localStorage.getItem('owner') || '{}')
      owner.plan = res.data?.new_plan || 'basic'
      localStorage.setItem('owner', JSON.stringify(owner))
      setToast({ message: res.data?.message || 'Subscription cancelled', type: 'success' })
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to cancel subscription', type: 'error' })
    } finally { setSavingAccount(null) }
  }

  /* ── Gmail OAuth2 handlers ── */
  const handleGmailConnect = async () => {
    setGmailLoading(true)
    try {
      const res = await gmailApi.authorize()
      // Navigate the full browser window to Google's consent screen.
      // Google will redirect back to /settings?gmail=connected after authorization.
      window.location.href = res.data.url
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to start Gmail connection', type: 'error' })
      setGmailLoading(false)
    }
  }

  const handleGmailTest = async () => {
    setTestEmailSending(true)
    try {
      const res = await gmailApi.test()
      setToast({ message: `Test email sent to ${res.data.to}!`, type: 'success' })
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to send test email', type: 'error' })
    } finally { setTestEmailSending(false) }
  }

  const handleGmailDisconnect = async () => {
    setGmailLoading(true)
    try {
      await gmailApi.disconnect()
      setGmailStatus({ connected: false })
      setToast({ message: 'Gmail disconnected', type: 'success' })
    } catch (err) {
      setToast({ message: 'Failed to disconnect Gmail', type: 'error' })
    } finally { setGmailLoading(false) }
  }

  const tabs = [
    { id: 'info', label: 'General' },
    { id: 'hours', label: 'Hours' },
    { id: 'team', label: 'Team' },
    { id: 'account', label: 'Account' },
    { id: 'email', label: 'Email' },
  ]

  if (loading) return (
    <Layout>
      <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{
            height: 160, borderRadius: 12, marginBottom: 16,
            background: '#F3F4F6', animation: 'pulse 1.5s infinite',
          }} />
        ))}
        <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }`}</style>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div style={{ padding: '24px 28px', maxWidth: 740, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Settings</h1>
          <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
            Manage your restaurant, team, and account
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid #E5E7EB',
          marginBottom: 24,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
                color: activeTab === tab.id ? '#4F46E5' : '#6B7280',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid #4F46E5' : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════ TAB: General ════ */}
        {activeTab === 'info' && (
          <Card title="Restaurant Profile" description="Basic information shown to customers">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <Label>Restaurant Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Mario's Pizza" />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 (215) 555-0100" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, Philadelphia, PA 19103" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <Label>Avg. Wait Time</Label>
                <div style={{ position: 'relative' }}>
                  <Input
                    type="number" min="5" max="120"
                    value={form.estimated_wait_minutes}
                    onChange={e => setForm({ ...form, estimated_wait_minutes: e.target.value })}
                  />
                  <span style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 13, color: '#9CA3AF', pointerEvents: 'none',
                  }}>min</span>
                </div>
              </div>
              <div>
                <Label>Timezone</Label>
                <select
                  value={form.timezone}
                  onChange={e => setForm({ ...form, timezone: e.target.value })}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '9px 12px', fontSize: 14, fontFamily: 'inherit',
                    color: '#111827', background: '#FFF',
                    border: '1px solid #D1D5DB', borderRadius: 8,
                    outline: 'none', cursor: 'pointer',
                  }}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label} ({tz.short})</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* ════ TAB: Hours ════ */}
        {activeTab === 'hours' && (
          <Card title="Operating Hours" description="Set when your restaurant is open">
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '90px 44px 1fr 24px 1fr',
              alignItems: 'center', gap: 10,
              padding: '0 10px 10px',
              borderBottom: '1px solid #F3F4F6',
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' }}>Day</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', textAlign: 'center' }}>Open</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' }}>From</span>
              <span />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' }}>To</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {DAYS.map(day => {
                const h = hours[day] || DEFAULT_HOURS[day]
                return (
                  <div key={day} style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 44px 1fr 24px 1fr',
                    alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: h.closed ? '#F9FAFB' : '#FFF',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: h.closed ? '#9CA3AF' : '#374151' }}>
                      {day}
                    </span>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <ToggleSwitch size="sm" checked={!h.closed} onChange={v =>
                        setHours({ ...hours, [day]: { ...h, closed: !v } })
                      } />
                    </div>

                    {!h.closed ? (
                      <>
                        <input type="time" value={h.open}
                          onChange={e => setHours({ ...hours, [day]: { ...h, open: e.target.value } })}
                          style={{
                            padding: '7px 10px', fontSize: 13, fontFamily: 'inherit',
                            border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none',
                          }}
                        />
                        <div style={{ textAlign: 'center', color: '#D1D5DB' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </div>
                        <input type="time" value={h.close}
                          onChange={e => setHours({ ...hours, [day]: { ...h, close: e.target.value } })}
                          style={{
                            padding: '7px 10px', fontSize: 13, fontFamily: 'inherit',
                            border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none',
                          }}
                        />
                      </>
                    ) : (
                      <div style={{ gridColumn: 'span 3', textAlign: 'center' }}>
                        <span style={{ fontSize: 13, color: '#9CA3AF' }}>Closed</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{
              marginTop: 16, padding: '10px 14px', borderRadius: 8,
              background: '#F9FAFB', border: '1px solid #F3F4F6',
              fontSize: 13, color: '#6B7280',
            }}>
              Open {DAYS.filter(d => !hours[d]?.closed).length} days a week
              {hours.Sunday?.closed ? ' (closed Sundays)' : ''}
            </div>
          </Card>
        )}

        {/* ════ TAB: Team ════ */}
        {activeTab === 'team' && (
          <Card title="Team Members" description="Manage employees and schedules">
            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total', value: employees.length },
                { label: 'Scheduled', value: employees.filter(e => Object.values(e.schedule || {}).some(s => !s.off)).length },
                { label: 'Roles', value: [...new Set(employees.map(e => e.role))].length },
              ].map((s, i) => (
                <div key={i} style={{
                  flex: 1, padding: '14px 16px', borderRadius: 8,
                  background: '#F9FAFB', border: '1px solid #F3F4F6',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Add button */}
            <button
              onClick={() => setModal('add')}
              style={{
                width: '100%', padding: 12, borderRadius: 8,
                border: '1px dashed #D1D5DB', background: '#FFF',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6,
                fontSize: 14, fontWeight: 500, color: '#4F46E5',
                marginBottom: employees.length > 0 ? 16 : 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Team Member
            </button>

            {/* Employee list */}
            {employees.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {employees.map(emp => {
                  const rc = ROLE_COLORS[emp.role] || ROLE_COLORS.Busser
                  const workDays = Object.entries(emp.schedule || {}).filter(([, s]) => !s.off)
                  return (
                    <div key={emp.id} style={{
                      padding: '14px 16px', borderRadius: 10,
                      background: '#FFF', border: '1px solid #F3F4F6',
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: rc.bg, border: `1px solid ${rc.dot}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 600, color: rc.text, flexShrink: 0,
                      }}>
                        {emp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{emp.name}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                            background: rc.bg, color: rc.text,
                          }}>{emp.role}</span>
                        </div>
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                          {workDays.length} days &middot; {workDays.map(([d]) => SHORT[d]).join(', ')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setModal(emp)} title="Edit" style={{
                          width: 32, height: 32, borderRadius: 6, border: '1px solid #E5E7EB',
                          background: '#FFF', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => deleteEmployee(emp.id)} title="Remove" style={{
                          width: 32, height: 32, borderRadius: 6, border: '1px solid #FEE2E2',
                          background: '#FFF', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {employees.length === 0 && (
              <div style={{ textAlign: 'center', padding: '28px 0', color: '#9CA3AF', fontSize: 14 }}>
                No team members yet
              </div>
            )}
          </Card>
        )}

        {/* ════ TAB: Account ════ */}
        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Update Email ── */}
            <Card title="Email Address" description="Change the email you use to sign in">
              <div style={{ marginBottom: 12 }}>
                <Label>Current Email</Label>
                <div style={{
                  padding: '9px 12px', fontSize: 14, color: '#6B7280',
                  background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
                }}>
                  {account.email}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end', marginBottom: 12 }}>
                <div>
                  <Label>New Email</Label>
                  <Input
                    type="email"
                    value={emailForm.new_email}
                    onChange={e => { setEmailForm({ ...emailForm, new_email: e.target.value }); setEmailOtpSent(false) }}
                    placeholder="newemail@example.com"
                  />
                </div>
                <Btn
                  onClick={handleSendEmailOtp}
                  disabled={savingAccount === 'email-otp' || emailOtpCountdown > 0}
                  variant="secondary"
                  size="md"
                  style={{ whiteSpace: 'nowrap', height: 38 }}
                >
                  {savingAccount === 'email-otp' ? 'Sending...' : emailOtpCountdown > 0 ? `Resend (${emailOtpCountdown}s)` : 'Send Code'}
                </Btn>
              </div>

              {emailOtpSent && (
                <div style={{
                  padding: 16, borderRadius: 8,
                  background: '#F9FAFB', border: '1px solid #E5E7EB',
                  marginBottom: 12,
                }}>
                  {/* Dev mode OTP display */}
                  {devOtp?.type === 'email' && (
                    <div style={{
                      marginBottom: 12, padding: '8px 12px', borderRadius: 6,
                      background: '#FFFBEB', border: '1px solid #FDE68A',
                      fontSize: 13, color: '#92400E',
                    }}>
                      Dev mode — your code is: <strong>{devOtp.code}</strong>
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <Label>Enter 6-digit code</Label>
                    <OtpInput value={emailForm.code || ''} onChange={code => setEmailForm({ ...emailForm, code })} />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <Label>Current Password</Label>
                    <Input
                      type="password"
                      value={emailForm.password}
                      onChange={e => setEmailForm({ ...emailForm, password: e.target.value })}
                      placeholder="Enter your password to confirm"
                      style={{ maxWidth: 320 }}
                    />
                  </div>

                  <Btn onClick={handleUpdateEmail} disabled={savingAccount === 'email'}>
                    {savingAccount === 'email' ? 'Verifying...' : 'Verify & Update Email'}
                  </Btn>
                </div>
              )}
            </Card>

            {/* ── Update Phone ── */}
            <Card title="Phone Number" description="Update the phone number shown to customers">
              <div style={{ marginBottom: 12 }}>
                <Label>Current Phone</Label>
                <div style={{
                  padding: '9px 12px', fontSize: 14, color: '#6B7280',
                  background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
                  maxWidth: 320,
                }}>
                  {account.phone || 'Not set'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end', marginBottom: 12, maxWidth: 420 }}>
                <div>
                  <Label>New Phone Number</Label>
                  <Input
                    value={phoneForm.phone}
                    onChange={e => { setPhoneForm({ ...phoneForm, phone: e.target.value }); setPhoneOtpSent(false) }}
                    placeholder="+1 (215) 555-0100"
                  />
                </div>
                <Btn
                  onClick={handleSendPhoneOtp}
                  disabled={savingAccount === 'phone-otp' || phoneOtpCountdown > 0}
                  variant="secondary"
                  size="md"
                  style={{ whiteSpace: 'nowrap', height: 38 }}
                >
                  {savingAccount === 'phone-otp' ? 'Sending...' : phoneOtpCountdown > 0 ? `Resend (${phoneOtpCountdown}s)` : 'Send Code'}
                </Btn>
              </div>

              {phoneOtpSent && (
                <div style={{
                  padding: 16, borderRadius: 8,
                  background: '#F9FAFB', border: '1px solid #E5E7EB',
                  marginBottom: 12,
                }}>
                  {devOtp?.type === 'phone' && (
                    <div style={{
                      marginBottom: 12, padding: '8px 12px', borderRadius: 6,
                      background: '#FFFBEB', border: '1px solid #FDE68A',
                      fontSize: 13, color: '#92400E',
                    }}>
                      Dev mode — your code is: <strong>{devOtp.code}</strong>
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <Label>Enter 6-digit code</Label>
                    <OtpInput value={phoneForm.code || ''} onChange={code => setPhoneForm({ ...phoneForm, code })} />
                  </div>

                  <Btn onClick={handleUpdatePhone} disabled={savingAccount === 'phone'}>
                    {savingAccount === 'phone' ? 'Verifying...' : 'Verify & Update Phone'}
                  </Btn>
                </div>
              )}
            </Card>

            {/* ── Change Password ── */}
            <Card title="Password" description="Change your sign-in password">
              <div style={{ maxWidth: 360 }}>
                <div style={{ marginBottom: 12 }}>
                  <Label>Current Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    placeholder="Enter current password"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    placeholder="At least 6 characters"
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    placeholder="Re-enter new password"
                  />
                </div>
                <Btn onClick={handleUpdatePassword} disabled={savingAccount === 'password'}>
                  {savingAccount === 'password' ? 'Updating...' : 'Update Password'}
                </Btn>
              </div>
            </Card>

            {/* ── Billing & Subscription ── */}
            <Card title="Subscription" description="Manage your plan and billing">
              {/* Plan badge */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 8,
                background: '#F9FAFB', border: '1px solid #E5E7EB',
                marginBottom: 16,
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current Plan</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginTop: 2, textTransform: 'capitalize' }}>{currentPlan}</div>
                </div>
                <span style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: currentPlan === 'basic' ? '#F0FDF4' : '#EEF2FF',
                  color: currentPlan === 'basic' ? '#166534' : '#4338CA',
                }}>
                  {currentPlan === 'basic' ? 'Free' : 'Active'}
                </span>
              </div>

              <Btn variant="secondary" onClick={handleManageBilling} style={{ width: '100%', marginBottom: 6 }}>
                Manage Billing & Payment Methods
              </Btn>
              <Hint>View plans, upgrade, or manage your subscription</Hint>

              {/* Cancel / Downgrade */}
              {currentPlan !== 'basic' && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #F3F4F6' }}>

                  {cancelStep === 0 && (
                    <Btn variant="danger" onClick={() => setCancelStep(1)} style={{ width: '100%' }}>
                      Cancel Subscription
                    </Btn>
                  )}

                  {/* Step 1: Downgrade offer */}
                  {cancelStep === 1 && lowerPlan && (
                    <div style={{
                      padding: 20, borderRadius: 10,
                      background: '#F9FAFB', border: '1px solid #E5E7EB',
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                        Before you cancel...
                      </div>
                      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, margin: 0, marginBottom: 16 }}>
                        Would you like to downgrade to {PLAN_LABELS[lowerPlan]} ({PLAN_PRICES[lowerPlan]}) instead?
                        You'll keep core features at a lower price.
                      </p>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn variant="secondary" onClick={() => setCancelStep(0)}>
                          Never mind
                        </Btn>
                        <Btn onClick={handleDowngrade} disabled={savingAccount === 'downgrade'}>
                          {savingAccount === 'downgrade' ? 'Switching...' : `Downgrade to ${PLAN_LABELS[lowerPlan]}`}
                        </Btn>
                        <Btn variant="danger" onClick={() => setCancelStep(2)}>
                          Cancel anyway
                        </Btn>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Reason */}
                  {cancelStep === 2 && (
                    <div style={{
                      padding: 20, borderRadius: 10,
                      background: '#FFFBEB', border: '1px solid #FDE68A',
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#92400E', marginBottom: 4 }}>
                        Help us improve
                      </div>
                      <p style={{ fontSize: 13, color: '#B45309', marginBottom: 14, margin: 0, marginBottom: 14 }}>
                        Why are you cancelling? Your feedback helps us get better.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                        {CANCEL_REASONS.map(reason => (
                          <label
                            key={reason}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '8px 12px', borderRadius: 8,
                              background: cancelReason === reason ? '#FEF3C7' : '#FFF',
                              border: `1px solid ${cancelReason === reason ? '#F59E0B' : '#F3F4F6'}`,
                              cursor: 'pointer', fontSize: 13, color: '#374151',
                            }}
                          >
                            <input
                              type="radio" name="cancelReason" value={reason}
                              checked={cancelReason === reason}
                              onChange={e => setCancelReason(e.target.value)}
                              style={{ accentColor: '#F59E0B' }}
                            />
                            {reason}
                          </label>
                        ))}
                      </div>

                      {cancelReason === 'Other' && (
                        <div style={{ marginBottom: 14 }}>
                          <Input
                            value={cancelReasonOther}
                            onChange={e => setCancelReasonOther(e.target.value)}
                            placeholder="Tell us more..."
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn variant="secondary" onClick={() => { setCancelStep(1); setCancelReason(''); setCancelReasonOther('') }}>
                          Go back
                        </Btn>
                        <Btn
                          variant="danger-solid"
                          onClick={() => { if (cancelReason) setCancelStep(3) }}
                          disabled={!cancelReason}
                        >
                          Continue
                        </Btn>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Final confirmation */}
                  {cancelStep === 3 && (
                    <div style={{
                      padding: 20, borderRadius: 10,
                      background: '#FEF2F2', border: '1px solid #FECACA',
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>
                        Are you sure?
                      </div>
                      <p style={{ fontSize: 13, color: '#B91C1C', margin: 0, marginBottom: 14 }}>
                        Your {PLAN_LABELS[currentPlan]} plan will be cancelled and you'll lose these features:
                      </p>

                      <div style={{
                        padding: '12px 14px', borderRadius: 8,
                        background: '#FFF', border: '1px solid #FECACA', marginBottom: 14,
                      }}>
                        {(currentPlan === 'enterprise'
                          ? ['Unlimited AI calls', 'Advanced analytics', 'Dedicated account manager', 'Custom AI training']
                          : ['Up to 500 AI calls/month', 'Allergy detection', 'Analytics dashboard', 'Priority support']
                        ).map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', padding: '3px 0' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            {f}
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn variant="secondary" onClick={() => setCancelStep(2)}>
                          Go back
                        </Btn>
                        <Btn
                          variant="danger-solid"
                          onClick={handleCancelSubscription}
                          disabled={savingAccount === 'cancel'}
                        >
                          {savingAccount === 'cancel' ? 'Cancelling...' : 'Cancel Subscription'}
                        </Btn>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ════ TAB: Email ════ */}
        {activeTab === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Status Card ── */}
            <Card title="Gmail OAuth2" description="Send OTP codes, usage alerts, and plan notifications via your Gmail account">

              {/* Connection status row */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 8, marginBottom: 18,
                background: gmailStatus?.connected ? '#F0FDF4' : '#F9FAFB',
                border: `1px solid ${gmailStatus?.connected ? '#BBF7D0' : '#E5E7EB'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: gmailStatus?.connected ? '#22C55E' : '#9CA3AF',
                  }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      {gmailStatus === null ? 'Checking…' : gmailStatus.connected ? 'Connected' : 'Not Connected'}
                    </div>
                    {gmailStatus?.email && (
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        Sending as: <strong>{gmailStatus.email}</strong>
                      </div>
                    )}
                  </div>
                </div>
                {gmailStatus?.connected && (
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0',
                  }}>Active</span>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!gmailStatus?.connected ? (
                  <Btn onClick={handleGmailConnect} disabled={gmailLoading}>
                    {gmailLoading ? 'Redirecting to Google…' : 'Connect Gmail'}
                  </Btn>
                ) : (
                  <>
                    <Btn onClick={handleGmailTest} disabled={testEmailSending} variant="secondary">
                      {testEmailSending ? 'Sending…' : 'Send Test Email'}
                    </Btn>
                    <Btn onClick={handleGmailConnect} disabled={gmailLoading} variant="secondary">
                      {gmailLoading ? 'Redirecting…' : 'Reconnect'}
                    </Btn>
                    <Btn onClick={handleGmailDisconnect} disabled={gmailLoading} variant="danger">
                      Disconnect
                    </Btn>
                  </>
                )}
              </div>
            </Card>

            {/* ── How It Works ── */}
            <Card title="How to Connect" description="One-time setup — takes about 30 seconds">
              {[
                { n: 1, text: 'Click "Connect Gmail" above' },
                { n: 2, text: 'Sign in with the Gmail address you want to send FROM (e.g. your restaurant email)' },
                { n: 3, text: 'Click "Allow" to grant Ringa permission to send emails on your behalf' },
                { n: 4, text: "You'll be redirected back here. All platform emails now go through Gmail." },
              ].map(({ n, text }) => (
                <div key={n} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '10px 0',
                  borderBottom: n < 4 ? '1px solid #F3F4F6' : 'none',
                }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: '#EEF2FF', color: '#4F46E5',
                    fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{n}</span>
                  <span style={{ fontSize: 14, color: '#374151', paddingTop: 4 }}>{text}</span>
                </div>
              ))}

              {/* Google Cloud redirect URI notice */}
              <div style={{
                marginTop: 16, padding: '12px 14px',
                borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A',
                fontSize: 12, color: '#92400E', lineHeight: 1.6,
              }}>
                <strong>One-time Google Cloud setup required:</strong> In your{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank" rel="noreferrer"
                  style={{ color: '#92400E', fontWeight: 600 }}
                >Google Cloud Console</a>,
                add the following to <em>Authorized redirect URIs</em> for your OAuth2 client:
                <div style={{
                  marginTop: 8, padding: '6px 10px', borderRadius: 6,
                  background: '#FEF3C7', fontFamily: 'monospace', fontSize: 11,
                  wordBreak: 'break-all',
                }}>
                  http://localhost:8002/api/gmail/callback
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: '#B45309' }}>
                  In production, replace with: <code>https://yourdomain.com/api/gmail/callback</code>
                </div>
              </div>
            </Card>

            {/* ── Email priority ── */}
            <Card
              title="Email Provider Priority"
              description="How Ringa chooses which provider to use"
              style={{ background: '#F9FAFB' }}
            >
              {[
                { label: '1st — Gmail OAuth2', active: gmailStatus?.connected, desc: 'Sends via Gmail API using your connected account' },
                { label: '2nd — SMTP',         active: false,                   desc: 'Username + password SMTP configured in .env' },
                { label: '3rd — Console Log',  active: true,                    desc: 'Dev fallback — prints email to server terminal' },
              ].map(({ label, active, desc }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 0', borderBottom: '1px solid #F3F4F6',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: active ? '#22C55E' : '#D1D5DB',
                  }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{label}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </Card>

          </div>
        )}

        {/* Save button (not on Account or Email tab) */}
        {activeTab !== 'account' && activeTab !== 'email' && (
          <div style={{ marginTop: 20 }}>
            <Btn
              onClick={handleSave}
              disabled={saving}
              size="lg"
              style={{ width: '100%' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Btn>
          </div>
        )}
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {modal && (
        <EmployeeModal
          employee={modal === 'add' ? null : modal}
          onSave={saveEmployee}
          onClose={() => setModal(null)}
        />
      )}
    </Layout>
  )
}
