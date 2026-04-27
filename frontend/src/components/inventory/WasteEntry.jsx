import { useState } from 'react'
import { inventoryApi } from '../../services/inventoryApi'

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text-1)',
  fontSize: 13,
  padding: '9px 12px',
  outline: 'none',
  width: '100%',
}

export default function WasteEntry({ inventoryItems, onSuccess }) {
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ text: '', ok: true })

  const submit = async (e) => {
    e.preventDefault()
    if (!itemId || !quantity || parseFloat(quantity) <= 0) {
      setMessage({ text: 'Please select an item and enter a valid quantity', ok: false })
      return
    }
    setLoading(true)
    try {
      await inventoryApi.logWaste({ inventory_item_id: itemId, quantity: parseFloat(quantity), note: note || null })
      setMessage({ text: 'Waste logged successfully', ok: true })
      setItemId(''); setQuantity(''); setNote('')
      onSuccess?.()
    } catch (err) {
      setMessage({ text: err.response?.data?.detail || 'Failed to log waste', ok: false })
    } finally {
      setLoading(false)
    }
  }

  const selectedItem = inventoryItems.find((i) => i.id === itemId)

  return (
    <form onSubmit={submit}>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
        Record spoilage or disposal — quantity is deducted from stock immediately.
      </div>

      {message.text && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: message.ok ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${message.ok ? '#bbf7d0' : '#fecaca'}`,
          color: message.ok ? '#15803d' : '#dc2626',
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Item
          </label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} style={inputStyle}>
            <option value="">Select inventory item…</option>
            {inventoryItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} — {i.quantity} {i.unit} in stock
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Quantity wasted {selectedItem ? `(${selectedItem.unit})` : ''}
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 200"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Note (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. expired, dropped, spoiled"
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            background: loading ? '#f87171' : '#dc2626',
            color: '#fff',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            alignSelf: 'flex-start',
            opacity: loading ? 0.75 : 1,
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Logging...' : 'Log Waste'}
        </button>
      </div>
    </form>
  )
}
