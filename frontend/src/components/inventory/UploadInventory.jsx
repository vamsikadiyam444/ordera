import { useState, useRef } from 'react'
import { inventoryApi } from '../../services/inventoryApi'

const UNITS = ['lbs', 'grams', 'oz', 'gallons', 'pieces', 'liters']

const emptyRow = () => ({ name: '', quantity: '', unit: 'pieces', cost_per_unit: '', low_stock_threshold: '' })

function parseCSV(text) {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].toLowerCase().split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    const row = {}
    headers.forEach((h, i) => { row[h] = cols[i] || '' })
    return {
      name: row.name || '',
      quantity: parseFloat(row.quantity) || 0,
      unit: UNITS.includes(row.unit) ? row.unit : 'pieces',
      cost_per_unit: parseFloat(row.cost_per_unit) || 0,
      low_stock_threshold: parseFloat(row.low_stock_threshold) || 0,
    }
  }).filter((r) => r.name)
}

export default function UploadInventory({ onSuccess }) {
  const [tab, setTab] = useState('csv')
  const [csvRows, setCsvRows] = useState([])
  const [manualRows, setManualRows] = useState([emptyRow()])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const rows = parseCSV(e.target.result)
      if (rows.length === 0) setError('No valid rows found. Expected columns: name, quantity, unit, cost_per_unit')
      else { setCsvRows(rows); setError('') }
    }
    reader.readAsText(file)
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const addManualRow = () => setManualRows([...manualRows, emptyRow()])
  const updateManualRow = (i, field, val) => {
    const rows = [...manualRows]
    rows[i] = { ...rows[i], [field]: val }
    setManualRows(rows)
  }
  const removeManualRow = (i) => setManualRows(manualRows.filter((_, idx) => idx !== i))

  const submitRows = async (rows) => {
    const valid = rows.filter((r) => r.name && r.quantity >= 0 && r.cost_per_unit >= 0)
    if (valid.length === 0) { setError('No valid items to upload'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const items = valid.map((r) => ({
        name: r.name,
        quantity: parseFloat(r.quantity) || 0,
        unit: r.unit,
        cost_per_unit: parseFloat(r.cost_per_unit) || 0,
        low_stock_threshold: parseFloat(r.low_stock_threshold) || 0,
      }))
      const res = await inventoryApi.upload(items)
      setSuccess(`Saved ${res.data.saved_count} item${res.data.saved_count !== 1 ? 's' : ''}`)
      setCsvRows([]); setManualRows([emptyRow()])
      onSuccess?.()
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 12,
    padding: '4px 8px',
    outline: 'none',
    width: '100%',
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['csv', 'manual'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              background: tab === t ? 'rgba(9,76,178,0.35)' : 'rgba(255,255,255,0.06)',
              color: tab === t ? '#7eb0f0' : 'rgba(255,255,255,0.5)',
            }}
          >
            {t === 'csv' ? 'CSV Upload' : 'Manual Entry'}
          </button>
        ))}
      </div>

      {error && <div className="mb-3 text-xs" style={{ color: '#f87171' }}>{error}</div>}
      {success && <div className="mb-3 text-xs" style={{ color: '#4ade80' }}>{success}</div>}

      {tab === 'csv' ? (
        <div>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#3b82f6' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 12,
              padding: '32px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'rgba(59,130,246,0.05)' : 'transparent',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              Drop a CSV file here or <span style={{ color: '#7eb0f0', textDecoration: 'underline' }}>browse</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 6 }}>
              Expected columns: name, quantity, unit, cost_per_unit, low_stock_threshold
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          {/* Preview */}
          {csvRows.length > 0 && (
            <div>
              <div className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Preview — {csvRows.length} row{csvRows.length !== 1 ? 's' : ''}
              </div>
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.08)', maxHeight: 220 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                      {['Name', 'Qty', 'Unit', 'Cost/Unit', 'Low Stock Threshold'].map((h) => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '5px 10px', color: 'rgba(255,255,255,0.85)' }}>{r.name}</td>
                        <td style={{ padding: '5px 10px', color: 'rgba(255,255,255,0.6)' }}>{r.quantity}</td>
                        <td style={{ padding: '5px 10px', color: 'rgba(255,255,255,0.6)' }}>{r.unit}</td>
                        <td style={{ padding: '5px 10px', color: 'rgba(255,255,255,0.6)' }}>${r.cost_per_unit}</td>
                        <td style={{ padding: '5px 10px', color: 'rgba(255,255,255,0.6)' }}>{r.low_stock_threshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => submitRows(csvRows)}
                disabled={loading}
                className="mt-3"
                style={{ padding: '8px 20px', borderRadius: 8, background: '#094cb2', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                {loading ? 'Uploading...' : `Upload ${csvRows.length} Items`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Manual rows */}
          <div className="space-y-2 mb-3">
            {manualRows.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input placeholder="Item name" value={row.name} onChange={(e) => updateManualRow(i, 'name', e.target.value)} style={{ ...inputStyle, flex: 2 }} />
                <input type="number" placeholder="Qty" value={row.quantity} onChange={(e) => updateManualRow(i, 'quantity', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <select value={row.unit} onChange={(e) => updateManualRow(i, 'unit', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <input type="number" step="0.01" placeholder="Cost/unit" value={row.cost_per_unit} onChange={(e) => updateManualRow(i, 'cost_per_unit', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <input type="number" placeholder="Low stock" value={row.low_stock_threshold} onChange={(e) => updateManualRow(i, 'low_stock_threshold', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                {manualRows.length > 1 && (
                  <button onClick={() => removeManualRow(i)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={addManualRow}
              style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', cursor: 'pointer', fontSize: 13 }}
            >
              + Add Row
            </button>
            <button
              onClick={() => submitRows(manualRows)}
              disabled={loading}
              style={{ padding: '7px 20px', borderRadius: 8, background: '#094cb2', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
            >
              {loading ? 'Saving...' : 'Save Items'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
