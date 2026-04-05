import { useState } from 'react'
import { inventoryApi } from '../../services/inventoryApi'

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

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 13,
    padding: '9px 12px',
    outline: 'none',
    width: '100%',
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 400 }}>
      <div className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Record spoilage or disposal — deducted from stock immediately.
      </div>

      {message.text && (
        <div className="mb-4 text-sm" style={{ color: message.ok ? '#4ade80' : '#f87171' }}>
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Item</label>
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
          <label className="block text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
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
          <label className="block text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Note (optional)</label>
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
          style={{ padding: '9px 24px', borderRadius: 8, background: 'rgba(239,68,68,0.20)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.30)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {loading ? 'Logging...' : 'Log Waste'}
        </button>
      </div>
    </form>
  )
}
