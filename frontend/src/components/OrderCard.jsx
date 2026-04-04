import { useState } from 'react'
import { ordersApi } from '../services/api'
import { ArrowRightIcon, CheckIcon } from './Icons'
import { printKitchenTicket } from '../utils/printTicket'

const STATUS_META = {
  new:       { label: 'New',        cls: 'badge-new',       border: '#fbbf24', pulse: true  },
  confirmed: { label: 'Confirmed',  cls: 'badge-confirmed', border: '#60a5fa', pulse: false },
  preparing: { label: 'Preparing',  cls: 'badge-preparing', border: '#f97316', pulse: false },
  ready:     { label: 'Ready',      cls: 'badge-ready',     border: '#34d399', pulse: false },
  picked_up: { label: 'Picked Up',  cls: 'badge-picked_up', border: '#cbd5e1', pulse: false },
  cancelled: { label: 'Cancelled',  cls: 'badge-cancelled', border: '#fca5a5', pulse: false },
}

const NEXT_STATUS = {
  new:       'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready:     'picked_up',
}

const NEXT_LABEL = {
  new:       'Confirm',
  confirmed: 'Start Preparing',
  preparing: 'Mark Ready',
  ready:     'Picked Up',
}

/* Printer icon — inline so no extra import needed */
function PrinterIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
  )
}

export default function OrderCard({ order, onStatusChange, restaurantName }) {
  const [loading, setLoading] = useState(false)
  const meta       = STATUS_META[order.status] || STATUS_META.new
  const nextStatus = NEXT_STATUS[order.status]

  const time = order.created_at
    ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  const handleAdvance = async () => {
    if (!nextStatus || loading) return
    setLoading(true)
    try {
      await ordersApi.updateStatus(order.id, nextStatus)
      onStatusChange?.()
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this order?')) return
    await ordersApi.cancel(order.id)
    onStatusChange?.()
  }

  const handlePrint = () => printKitchenTicket(order, restaurantName)

  const isDone = order.status === 'picked_up' || order.status === 'cancelled'

  return (
    <div
      className="card animate-scale-in"
      style={{
        borderLeft: `3px solid ${meta.border}`,
        animation: meta.pulse ? 'pulseGlow 2.5s ease-in-out infinite' : undefined,
        opacity: isDone ? 0.72 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-semibold text-base" style={{ color: 'var(--text-1)' }}>
              {order.customer_name || 'Unknown'}
            </div>
            {!order.call_sid && (
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 6,
                background: '#f0fdf4', color: '#16a34a',
                border: '1px solid #bbf7d0',
              }}>
                Walk-in
              </span>
            )}
          </div>
          <div className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
            {order.customer_phone && <span>{order.customer_phone}</span>}
            {order.customer_phone && time && <span>·</span>}
            {time && <span>{time}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {/* Print button */}
            <button
              onClick={handlePrint}
              title="Print kitchen ticket"
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-all duration-150"
              style={{
                background: '#f8fafc',
                color: 'var(--text-3)',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--primary-light)'
                e.currentTarget.style.color = 'var(--primary)'
                e.currentTarget.style.borderColor = 'var(--primary)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#f8fafc'
                e.currentTarget.style.color = 'var(--text-3)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <PrinterIcon size={12} />
              Print
            </button>

            <span className={`badge ${meta.cls}`}>
              {meta.pulse && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 6, height: 6,
                    borderRadius: '50%',
                    background: '#f59e0b',
                    animation: 'pulseDot 1.5s ease-in-out infinite',
                    marginRight: 2,
                  }}
                />
              )}
              {meta.label}
            </span>
          </div>
          <div className="font-bold text-base" style={{ color: 'var(--text-1)' }}>
            ${order.total?.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="divider mb-3" />

      {/* Items */}
      <div className="space-y-1.5 mb-3">
        {order.items?.map((item, i) => (
          <div key={i} className="flex items-start justify-between">
            <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
              <span
                className="inline-flex items-center justify-center text-xs font-bold rounded-md mr-2"
                style={{
                  width: 20, height: 20,
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  flexShrink: 0,
                }}
              >
                {item.quantity}
              </span>
              {item.name}
            </div>
            {item.modification && (
              <span
                className="text-xs ml-2 px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{ background: '#f8fafc', color: 'var(--text-3)' }}
              >
                {item.modification}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Special instructions */}
      {order.special_instructions && (
        <div
          className="text-xs rounded-lg px-3 py-2 mb-3 flex items-start gap-2"
          style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}
        >
          <span className="flex-shrink-0 mt-0.5">📝</span>
          <span>{order.special_instructions}</span>
        </div>
      )}

      {/* Payment */}
      <div
        className="flex items-center justify-between text-xs mb-4"
        style={{ color: 'var(--text-3)' }}
      >
        <span>
          {order.pay_method === 'stripe_link' ? '💳 SMS payment link' : '💵 Cash / card at pickup'}
        </span>
        <span
          className="badge"
          style={
            order.payment_status === 'paid'
              ? { background: '#dcfce7', color: '#166534' }
              : { background: '#f1f5f9', color: '#64748b' }
          }
        >
          {order.payment_status === 'paid' && <CheckIcon size={10} />}
          {order.payment_status}
        </span>
      </div>

      {/* Actions */}
      {!isDone && (
        <div className="flex gap-2">
          {nextStatus && (
            <button
              onClick={handleAdvance}
              disabled={loading}
              className="btn-primary flex-1 text-sm"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                    className="animate-spin">
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  Updating...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <ArrowRightIcon size={13} />
                  {NEXT_LABEL[order.status]}
                </span>
              )}
            </button>
          )}
          <button onClick={handleCancel} className="btn-danger">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
