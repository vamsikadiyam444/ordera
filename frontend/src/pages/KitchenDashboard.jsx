import { useState, useEffect, useCallback, useRef } from 'react'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import OrderCard from '../components/OrderCard'
import { dashboardApi, menuApi, ordersApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { printKitchenTicket } from '../utils/printTicket'
import {
  DashboardIcon, RefreshIcon,
  OrdersIcon, CheckIcon, AnalyticsIcon, PhoneIcon,
  PlusIcon, XIcon, SearchIcon, TrashIcon, SpinnerIcon,
} from '../components/Icons'

const REFRESH_INTERVAL = 5000
const TABS = ['Active', 'Ready', 'Completed', 'All']

/* Skeleton loaders */
function StatSkeleton() {
  return (
    <div className="card flex items-center gap-4">
      <div className="skeleton rounded-2xl flex-shrink-0" style={{ width: 48, height: 48 }} />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-7 w-16 rounded-md" />
        <div className="skeleton h-3.5 w-24 rounded" />
      </div>
    </div>
  )
}
function OrderSkeleton() {
  return (
    <div className="card space-y-3">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="skeleton h-4 w-28 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
        </div>
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="divider" />
      <div className="space-y-2">
        <div className="skeleton h-3.5 w-36 rounded" />
        <div className="skeleton h-3.5 w-28 rounded" />
      </div>
      <div className="skeleton h-9 rounded-xl" />
    </div>
  )
}

/* Toast notification for new orders */
function NewOrderToast({ order, onClose }) {
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const t = setTimeout(onClose, 30000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className="animate-slide-in"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'linear-gradient(135deg, #0f0c29, #1a1040)',
        border: '1px solid rgba(9,76,178,0.35)',
        borderLeft: '4px solid #094cb2',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: hovered
          ? '0 20px 48px rgba(9,76,178,0.20), 0 4px 16px rgba(0,0,0,0.4)'
          : '0 8px 32px rgba(0,0,0,0.35)',
        minWidth: 290,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        cursor: 'default',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0px)',
        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0, marginTop: 3 }}>
        <span className="live-dot" style={{ background: '#3366cc' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>
          New Order — {order.customer_name}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3 }}>
          {order.items?.length} item{order.items?.length !== 1 ? 's' : ''} · ${order.total?.toFixed(2)}
        </div>
        <div style={{ color: '#a5b4fc', fontSize: 11, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
          Kitchen ticket printed
        </div>
      </div>
      <button
        onClick={onClose}
        style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 2px', marginTop: 0 }}
      >
        ×
      </button>
    </div>
  )
}

/* ── Walk-in Order Modal ──────────────────────────────────────────────────── */
function WalkInModal({ onClose, onSuccess }) {
  // Step 1 = customer details, Step 2 = menu picker
  const [step,         setStep]         = useState(1)
  const [menuItems,    setMenuItems]    = useState([])
  const [loadingMenu,  setLoadingMenu]  = useState(false)
  const [search,       setSearch]       = useState('')
  const [cart,         setCart]         = useState([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone,setCustomerPhone]= useState('')
  const [payMethod,    setPayMethod]    = useState('cash')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState('')

  // Load menu only when moving to step 2
  const goToStep2 = () => {
    setStep(2)
    if (menuItems.length === 0) {
      setLoadingMenu(true)
      menuApi.list()
        .then(res => setMenuItems(res.data || []))
        .catch(() => {})
        .finally(() => setLoadingMenu(false))
    }
  }

  const filtered = menuItems.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(search.toLowerCase())
  )

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.name === item.name)
      if (existing) return prev.map(c => c.name === item.name ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { name: item.name, price: item.price || 0, quantity: 1 }]
    })
  }

  const updateQty = (name, delta) => {
    setCart(prev =>
      prev.map(c => c.name === name ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)
          .filter(c => c.quantity > 0)
    )
  }

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0)

  const handleSubmit = async () => {
    if (cart.length === 0) { setError('Add at least one item to the order'); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await ordersApi.create({
        customer_name: customerName.trim() || 'Walk-in',
        customer_phone: customerPhone.trim() || null,
        items: cart.map(c => ({ name: c.name, price: c.price, quantity: c.quantity })),
        total,
        pay_method: payMethod,
        special_instructions: specialInstructions.trim() || null,
      })
      onSuccess(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 12, fontSize: 14, color: 'var(--text-1)',
    outline: 'none', boxSizing: 'border-box',
  }

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: 'rgba(15,20,40,0.35)', backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px',
  }
  const modal = {
    background: 'var(--surface-1)',
    border: step === 1 ? 'none' : '1px solid var(--border)',
    borderRadius: 20, width: '100%',
    maxWidth: step === 1 ? 440 : 860,
    ...(step === 2 ? { maxHeight: '90vh' } : {}),
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    transition: 'max-width 0.25s ease',
    boxShadow: step === 1
      ? '0 32px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(9,76,178,0.10)'
      : '0 24px 60px rgba(0,0,0,0.15)',
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlusIcon size={16} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-1)' }}>Add New Order</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Step {step} of 2 — {step === 1 ? 'Customer Details' : 'Select Items'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Step indicators */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2].map(s => (
                <div key={s} style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: s === step ? '#094cb2' : s < step ? '#22c55e' : 'var(--surface-2)', color: s <= step ? 'white' : 'var(--text-3)', border: `1px solid ${s === step ? '#094cb2' : s < step ? '#22c55e' : 'var(--border)'}` }}>
                  {s < step ? '✓' : s}
                </div>
              ))}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
              <XIcon size={18} />
            </button>
          </div>
        </div>

        {/* ── Step 1: Customer Details ── */}
        {step === 1 && (
          <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Customer Name</label>
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. John Smith (optional)"
                autoFocus
                style={{ ...inputStyle, background: 'var(--surface-1)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Phone Number</label>
              <input
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="e.g. +1 555 000 0000 (optional)"
                style={{ ...inputStyle, background: 'var(--surface-1)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Payment Method</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', background: 'var(--surface-1)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <option value="cash">Cash</option>
                <option value="card_on_pickup">Card on Pickup</option>
                <option value="stripe_link">Stripe Payment Link</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Special Instructions</label>
              <textarea
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="Allergies, preferences, notes... (optional)"
                rows={3}
                style={{ ...inputStyle, resize: 'none', background: 'var(--surface-1)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              />
            </div>
            <button
              onClick={goToStep2}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', marginTop: 4, fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', boxShadow: '0 4px 14px rgba(9,76,178,0.30)' }}
            >
              Next — Select Items
              <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
            </button>
          </div>
        )}

        {/* ── Step 2: Menu Picker + Cart ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

            {/* Left: Menu list */}
            <div style={{ flex: 1, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ position: 'relative' }}>
                  <SearchIcon size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search menu items..."
                    autoFocus
                    style={{ ...inputStyle, paddingLeft: 32, fontSize: 13 }}
                  />
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
                {loadingMenu ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Loading menu...</div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No items found</div>
                ) : (
                  /* Group by category, sorted A–Z */
                  (() => {
                    const groups = {}
                    filtered.forEach(item => {
                      const cat = item.category || 'Other'
                      if (!groups[cat]) groups[cat] = []
                      groups[cat].push(item)
                    })
                    return Object.entries(groups)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([cat, items]) => (
                        <div key={cat} style={{ marginBottom: 14 }}>
                          {/* Category header */}
                          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#094cb2', padding: '2px 0 6px', marginBottom: 4, borderBottom: '1.5px solid rgba(9,76,178,0.15)' }}>
                            {cat}
                          </div>
                          {/* Item rows */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {items.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => addToCart(item)}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center',
                                  justifyContent: 'space-between', padding: '10px 12px',
                                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                                  borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                                }}
                              >
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.name}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>${(item.price || 0).toFixed(2)}</span>
                                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <PlusIcon size={11} style={{ color: 'var(--primary)' }} />
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                  })()
                )}
              </div>
            </div>

            {/* Right: Cart + summary */}
            <div style={{ width: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Customer summary pill */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 4 }}>Customer</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{customerName.trim() || 'Walk-in'}</div>
                {customerPhone && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{customerPhone}</div>}
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {payMethod === 'cash' ? 'Cash' : payMethod === 'card_on_pickup' ? 'Card on Pickup' : 'Stripe Link'}
                </div>
              </div>

              {/* Cart items */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 8 }}>Order Items</div>
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 12 }}>Tap items from the menu to add</div>
                ) : (
                  cart.map(c => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '7px 10px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>${(c.price * c.quantity).toFixed(2)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        <button onClick={() => updateQty(c.name, -1)} style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--surface-1)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: 13 }}>−</button>
                        <span style={{ minWidth: 16, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{c.quantity}</span>
                        <button onClick={() => updateQty(c.name, 1)} style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--surface-1)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: 13 }}>+</button>
                        <button onClick={() => updateQty(c.name, -c.quantity)} style={{ width: 20, height: 20, marginLeft: 2, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TrashIcon size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {error && <div style={{ fontSize: 12, color: '#ef4444', padding: '6px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{error}</div>}
                {/* Total centered */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>${total.toFixed(2)}</div>
                </div>
                {/* Place Order centered, compact */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || cart.length === 0}
                  className="btn-primary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', fontSize: 13, opacity: submitting || cart.length === 0 ? 0.6 : 1 }}
                >
                  {submitting ? <SpinnerIcon size={13} /> : <CheckIcon size={13} />}
                  {submitting ? 'Placing...' : 'Place Order'}
                </button>
                <button onClick={() => setStep(1)} className="btn-secondary" style={{ fontSize: 12, padding: '6px', width: '100%' }}>
                  ← Back
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const ORDER_PERIODS = [
  { value: 7,  label: '7 Days'  },
  { value: 15, label: '15 Days' },
  { value: 30, label: '30 Days' },
]
const ORDER_STATUS_TABS = [
  { key: '',          label: 'All'       },
  { key: 'new',       label: 'New'       },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready',     label: 'Ready'     },
  { key: 'picked_up', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function KitchenDashboard() {
  const { owner }                       = useAuth()
  const [data,        setData]          = useState(null)
  const [activeTab,   setActiveTab]     = useState('Active')
  const [loading,     setLoading]       = useState(true)
  const [lastRefresh, setLastRefresh]   = useState(null)
  const [spinning,    setSpinning]      = useState(false)
  const [toasts,      setToasts]        = useState([])
  const [showModal,   setShowModal]     = useState(false)
  const [mainView,    setMainView]      = useState('kitchen') // 'kitchen' | 'orders'

  // Orders history state
  const [allOrders,       setAllOrders]       = useState([])
  const [ordersLoading,   setOrdersLoading]   = useState(false)
  const [ordersPeriod,    setOrdersPeriod]    = useState(7)
  const [ordersStatus,    setOrdersStatus]    = useState('')
  const [ordersSearch,    setOrdersSearch]    = useState('')
  const [ordersRefreshing, setOrdersRefreshing] = useState(false)

  // Track order IDs we've already seen so we only auto-print new arrivals
  const seenOrderIds = useRef(new Set())
  const isFirstLoad  = useRef(true)

  const restaurantName = owner?.restaurant_name || "Mario's Pizza"

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  const fetchStats = useCallback(async (manual = false) => {
    if (manual) setSpinning(true)
    try {
      const res = await dashboardApi.stats()
      const orders = res.data?.orders || []

      // Detect brand-new orders (status='new') not seen before
      if (!isFirstLoad.current) {
        const freshOrders = orders.filter(
          o => o.status === 'new' && !seenOrderIds.current.has(o.id)
        )
        freshOrders.forEach(order => {
          // Auto-print ticket for phone orders only (walk-ins have no call_sid)
          if (order.call_sid) printKitchenTicket(order, restaurantName)
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`New Order — ${order.customer_name || 'Walk-in'}`, {
              body: `${order.items?.length} item${order.items?.length !== 1 ? 's' : ''} · $${order.total?.toFixed(2)}`,
              icon: '/favicon.ico',
            })
          }
          // Show toast
          setToasts(prev => [...prev, { id: order.id, order }])
        })
      }

      // Update seen IDs
      orders.forEach(o => seenOrderIds.current.add(o.id))
      isFirstLoad.current = false

      setData(res.data)
      setLastRefresh(new Date())
    } catch (e) {
      console.error('Dashboard fetch error', e)
    } finally {
      setLoading(false)
      if (manual) setTimeout(() => setSpinning(false), 600)
    }
  }, [restaurantName])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    fetchStats()
    const interval = setInterval(() => fetchStats(), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchStats])

  const fetchOrders = useCallback(async (bg = false) => {
    if (bg) setOrdersRefreshing(true)
    else setOrdersLoading(true)
    try {
      const params = { days: ordersPeriod }
      if (ordersStatus) params.status = ordersStatus
      const res = await ordersApi.list(params)
      setAllOrders(res.data)
    } catch (e) { console.error(e) }
    finally { setOrdersLoading(false); setOrdersRefreshing(false) }
  }, [ordersPeriod, ordersStatus])

  useEffect(() => {
    if (mainView === 'orders') fetchOrders()
  }, [mainView, fetchOrders])

  useEffect(() => {
    if (mainView !== 'orders') return
    const interval = setInterval(() => fetchOrders(true), 15000)
    return () => clearInterval(interval)
  }, [mainView, fetchOrders])

  const filteredAllOrders = allOrders.filter(o => {
    if (!ordersSearch) return true
    const q = ordersSearch.toLowerCase()
    return (
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.customer_phone || '').includes(q) ||
      (o.id || '').toLowerCase().includes(q)
    )
  })

  const orderStats = {
    total:     allOrders.length,
    active:    allOrders.filter(o => ['new','confirmed','preparing'].includes(o.status)).length,
    ready:     allOrders.filter(o => o.status === 'ready').length,
    completed: allOrders.filter(o => o.status === 'picked_up').length,
    revenue:   allOrders.filter(o => o.status !== 'cancelled' && (o.payment_status === 'paid' || ['cash','card_on_pickup'].includes(o.pay_method)))
                        .reduce((a, o) => a + (o.total || 0), 0),
  }

  const filterOrders = (orders) => {
    if (!orders) return []
    switch (activeTab) {
      case 'Active':    return orders.filter(o => ['new', 'confirmed', 'preparing'].includes(o.status))
      case 'Ready':     return orders.filter(o => o.status === 'ready')
      case 'Completed': return orders.filter(o => ['picked_up', 'cancelled'].includes(o.status))
      default:          return orders
    }
  }

  const filtered = filterOrders(data?.orders)
  const newCount = data?.orders?.filter(o => o.status === 'new').length || 0

  return (
    <Layout>
      {/* ── Walk-in order modal ── */}
      {showModal && (
        <WalkInModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            fetchStats(true)
          }}
        />
      )}

      {/* ── Auto-print toast stack ── */}
      <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, padding: 20 }}>
        {toasts.map(t => (
          <NewOrderToast key={t.id} order={t.order} onClose={() => dismissToast(t.id)} />
        ))}
      </div>

      <div className="p-6 max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 40, height: 40, background: 'var(--primary-light)' }}
            >
              <DashboardIcon size={18} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
                {mainView === 'kitchen' ? 'Kitchen Dashboard' : 'Orders'}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="live-dot" />
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {mainView === 'kitchen'
                    ? (lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Loading...')
                    : `Last ${ordersPeriod} days · ${orderStats.total} orders`}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* View switcher */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: 10, padding: 3, gap: 2 }}>
              {[{ v: 'kitchen', label: 'Kitchen' }, { v: 'orders', label: 'Orders' }].map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setMainView(v)}
                  style={{
                    padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, transition: 'all 0.15s ease',
                    background: mainView === v ? '#fff' : 'transparent',
                    color: mainView === v ? '#094cb2' : '#86868b',
                    boxShadow: mainView === v ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                  }}
                >{label}</button>
              ))}
            </div>

            {mainView === 'kitchen' && (
              <>
                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 12, border: '1px solid rgba(9,76,178,0.30)',
                    background: 'rgba(255,255,255,0.80)',
                    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                    color: '#094cb2', fontSize: 13, fontWeight: 700,
                    boxShadow: '0 2px 12px rgba(9,76,178,0.12), inset 0 1px 0 rgba(255,255,255,0.9)',
                    cursor: 'pointer', transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.80)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <PlusIcon size={14} />
                  Add New Order
                </button>
                <button onClick={() => fetchStats(true)} className="btn-secondary" style={{ padding: '8px 14px' }}>
                  <RefreshIcon size={14} className={spinning ? 'animate-spin-slow' : ''} />
                  Refresh
                </button>
              </>
            )}

            {mainView === 'orders' && (
              <button onClick={() => fetchOrders(true)} className="btn-secondary" style={{ padding: '8px 14px' }}>
                <RefreshIcon size={14} className={ordersRefreshing ? 'animate-spin-slow' : ''} />
                {ordersRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
          </div>
        </div>

        {/* ════════════ KITCHEN VIEW ════════════ */}
        {mainView === 'kitchen' && (<>

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {loading ? (
              <><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
            ) : data ? (
              <>
                <StatCard label="Active Orders"    value={data.active_orders}   icon={OrdersIcon}   color="yellow" />
                <StatCard label="Ready for Pickup" value={data.ready_orders}    icon={CheckIcon}    color="green"  />
                <StatCard label="Completed Today"  value={data.completed_orders} icon={AnalyticsIcon} color="blue" />
                <StatCard
                  label="Revenue Today"
                  value={`$${(data.revenue_today || 0).toFixed(2)}`}
                  icon={PhoneIcon}
                  color="purple"
                  sub={`${data.total_orders_today} total orders`}
                />
              </>
            ) : null}
          </div>

          {/* ── Tabs ── */}
          <div className="flex items-center gap-2 mb-5">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-btn ${activeTab === tab ? 'active' : ''}`}>
                {tab}
                {tab === 'Active' && newCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center text-xs font-bold rounded-full"
                    style={{ width: 18, height: 18, background: activeTab === tab ? 'rgba(255,255,255,0.25)' : '#fef9c3', color: activeTab === tab ? 'white' : '#92400e', fontSize: 10 }}>
                    {newCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Orders grid ── */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <OrderSkeleton /><OrderSkeleton /><OrderSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
              <div className="flex items-center justify-center rounded-2xl mb-4" style={{ width: 64, height: 64, background: 'var(--primary-light)' }}>
                <OrdersIcon size={28} style={{ color: '#3366cc' }} />
              </div>
              <div className="font-semibold text-base" style={{ color: 'var(--text-2)' }}>No {activeTab.toLowerCase()} orders</div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                {activeTab === 'Active' ? 'New orders will appear here automatically' : 'Nothing to show for this filter'}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((order, i) => (
                <div key={order.id} style={{ animationDelay: `${i * 50}ms` }}>
                  <OrderCard order={order} onStatusChange={fetchStats} restaurantName={restaurantName} />
                </div>
              ))}
            </div>
          )}
        </>)}

        {/* ════════════ ORDERS HISTORY VIEW ════════════ */}
        {mainView === 'orders' && (<>

          {/* Period + Status filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {/* Period */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: 10, padding: 3, gap: 2 }}>
              {ORDER_PERIODS.map(p => (
                <button key={p.value} onClick={() => setOrdersPeriod(p.value)}
                  style={{
                    padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                    background: ordersPeriod === p.value ? '#fff' : 'transparent',
                    color: ordersPeriod === p.value ? '#094cb2' : '#86868b',
                    boxShadow: ordersPeriod === p.value ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                  }}>{p.label}</button>
              ))}
            </div>

            {/* Status tabs */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ORDER_STATUS_TABS.map(t => (
                <button key={t.key} onClick={() => setOrdersStatus(t.key)}
                  style={{
                    padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: ordersStatus === t.key ? 600 : 500,
                    background: ordersStatus === t.key ? 'rgba(9,76,178,0.10)' : 'transparent',
                    color: ordersStatus === t.key ? '#094cb2' : '#86868b',
                    transition: 'all 0.15s',
                  }}>{t.label}</button>
              ))}
            </div>

            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)', marginLeft: 'auto' }}>
              <SearchIcon size={14} style={{ color: '#aeaeb2' }} />
              <input
                type="text"
                placeholder="Search name, phone, ID..."
                value={ordersSearch}
                onChange={e => setOrdersSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: '#1d1d1f', width: 180 }}
              />
              {ordersSearch && (
                <button onClick={() => setOrdersSearch('')} style={{ border: 'none', background: 'rgba(0,0,0,0.08)', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: 10, color: '#86868b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total',   value: orderStats.total,     color: '#1d1d1f' },
              { label: 'Active',  value: orderStats.active,    color: '#FF9F0A' },
              { label: 'Ready',   value: orderStats.ready,     color: '#30D158' },
              { label: 'Done',    value: orderStats.completed, color: '#86868b' },
              { label: 'Revenue', value: `$${orderStats.revenue.toFixed(0)}`, color: '#094cb2' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.55)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#86868b', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Orders 2-col grid */}
          {ordersLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <OrderSkeleton /><OrderSkeleton /><OrderSkeleton /><OrderSkeleton />
            </div>
          ) : filteredAllOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#86868b' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>No orders found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Try adjusting the period or filters</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {filteredAllOrders.map((order, i) => (
                <div key={order.id} style={{ animationDelay: `${i * 40}ms` }}>
                  <OrderCard order={order} onStatusChange={() => fetchOrders(true)} restaurantName={restaurantName} />
                </div>
              ))}
            </div>
          )}

          {filteredAllOrders.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#aeaeb2' }}>
              Showing {filteredAllOrders.length} of {allOrders.length} orders
            </div>
          )}
        </>)}

      </div>
    </Layout>
  )
}
