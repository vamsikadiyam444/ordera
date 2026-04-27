import { useRef, useState } from 'react'
import { inventoryApi } from '../../services/inventoryApi'

const VALID_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv', 'text/plain',
]
const VALID_EXT = /\.(pdf|jpg|jpeg|png|webp|gif|docx|csv|txt)$/i

function formatCurrency(n) {
  return n == null ? '—' : `$${Number(n).toFixed(2)}`
}

export default function InvoiceUpload({ inventoryItems = [], onSuccess }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)       // extracted invoice
  const [editedItems, setEditedItems] = useState([]) // editable line items
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function reset() {
    setResult(null)
    setEditedItems([])
    setError('')
    setSaved(false)
  }

  function validateFile(file) {
    if (!file) return 'No file selected.'
    if (!VALID_TYPES.includes(file.type) && !VALID_EXT.test(file.name)) {
      return 'Unsupported file type. Please upload a PDF, image, DOCX, CSV, or TXT.'
    }
    if (file.size > 10 * 1024 * 1024) return 'File too large (max 10 MB).'
    return null
  }

  async function processFile(file) {
    const err = validateFile(file)
    if (err) { setError(err); return }
    setError('')
    setScanning(true)
    reset()
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await inventoryApi.extractInvoice(fd)
      const data = res.data
      setResult(data)
      setEditedItems((data.items || []).map((item, i) => ({ ...item, _key: i })))
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to scan invoice. Please try again.')
    } finally {
      setScanning(false)
    }
  }

  function onFileChange(e) {
    if (e.target.files?.[0]) processFile(e.target.files[0])
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0])
  }

  function updateItem(key, field, value) {
    setEditedItems((prev) =>
      prev.map((it) => it._key === key ? { ...it, [field]: value } : it)
    )
  }

  function removeItem(key) {
    setEditedItems((prev) => prev.filter((it) => it._key !== key))
  }

  async function saveToInventory() {
    const items = editedItems.map(({ name, quantity, unit, cost_per_unit }) => ({
      name: String(name || '').trim(),
      quantity: parseFloat(quantity) || 0,
      unit: String(unit || 'unit').trim(),
      cost_per_unit: parseFloat(cost_per_unit) || 0,
    })).filter((it) => it.name)

    if (!items.length) { setError('No items to save.'); return }

    setSaving(true)
    setError('')
    try {
      await inventoryApi.upload(items)
      setSaved(true)
      if (onSuccess) onSuccess()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save items.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Drop zone */}
      {!result && !scanning && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 14,
            background: dragging ? 'var(--primary-light)' : 'var(--surface-2)',
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>
            Drop your supplier invoice here
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            PDF, image (JPG/PNG/WEBP), DOCX, CSV, TXT · max 10 MB
          </div>
          <div style={{
            marginTop: 16,
            display: 'inline-block',
            padding: '8px 20px',
            borderRadius: 8,
            background: 'var(--primary)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
          }}>
            Choose File
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.docx,.csv,.txt"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
        </div>
      )}

      {/* Scanning state */}
      {scanning && (
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 14,
          background: 'var(--surface-2)',
          padding: '48px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 14 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>
            Scanning invoice...
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            AI is reading your invoice and extracting line items
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 12,
          padding: '10px 16px',
          borderRadius: 8,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && !scanning && (
        <div>
          {/* Invoice metadata */}
          <div style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 20,
            padding: '14px 18px',
            background: 'var(--primary-light)',
            border: '1px solid var(--border)',
            borderRadius: 12,
          }}>
            {[
              { label: 'Supplier', value: result.supplier_name || '—' },
              { label: 'Invoice Date', value: result.invoice_date || '—' },
              { label: 'Invoice #', value: result.invoice_number || '—' },
              { label: 'Total', value: formatCurrency(result.total_amount) },
            ].map(({ label, value }) => (
              <div key={label} style={{ minWidth: 120 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Editable items table */}
          {saved ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 12,
              color: '#15803d',
              fontSize: 14,
              fontWeight: 600,
            }}>
              ✓ {editedItems.length} item{editedItems.length !== 1 ? 's' : ''} saved to inventory
              <button
                onClick={reset}
                style={{ display: 'block', margin: '12px auto 0', padding: '6px 18px', borderRadius: 8, fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-2)', fontWeight: 600 }}
              >
                Scan Another Invoice
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 10 }}>
                Extracted Items
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', marginLeft: 8 }}>
                  Edit before saving · {editedItems.length} item{editedItems.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {['Item Name', 'Qty', 'Unit', 'Cost/Unit', ''].map((h) => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {editedItems.map((item) => (
                      <tr key={item._key} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 10px' }}>
                          <input
                            value={item.name || ''}
                            onChange={(e) => updateItem(item._key, 'name', e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                        <td style={{ padding: '7px 10px', width: 90 }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity ?? ''}
                            onChange={(e) => updateItem(item._key, 'quantity', e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                        <td style={{ padding: '7px 10px', width: 90 }}>
                          <input
                            value={item.unit || ''}
                            onChange={(e) => updateItem(item._key, 'unit', e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                        <td style={{ padding: '7px 10px', width: 110 }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.cost_per_unit ?? ''}
                            onChange={(e) => updateItem(item._key, 'cost_per_unit', e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                        <td style={{ padding: '7px 10px', width: 36, textAlign: 'center' }}>
                          <button
                            onClick={() => removeItem(item._key)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}
                            title="Remove"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={saveToInventory}
                  disabled={saving || editedItems.length === 0}
                  style={{
                    padding: '9px 22px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving...' : `Save ${editedItems.length} Item${editedItems.length !== 1 ? 's' : ''} to Inventory`}
                </button>
                <button
                  onClick={reset}
                  style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '5px 8px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  fontSize: 13,
  color: 'var(--text-1)',
  background: 'var(--surface-1)',
  outline: 'none',
}
