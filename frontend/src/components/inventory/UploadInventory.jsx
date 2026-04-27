import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { inventoryApi } from '../../services/inventoryApi'

const UNITS = ['lbs', 'grams', 'oz', 'gallons', 'pieces', 'liters']

const emptyRow = () => ({ name: '', quantity: '', unit: 'pieces', cost_per_unit: '', low_stock_threshold: '' })

const ACCEPTED = '.csv,.xlsx,.xls,.txt,.tsv'
const ACCEPTED_LABEL = 'CSV, Excel (.xlsx / .xls), or TXT'

// Map flexible header names to canonical keys
const HEADER_MAP = {
  name: 'name', item: 'name', 'item name': 'name', 'ingredient': 'name', product: 'name',
  quantity: 'quantity', qty: 'quantity', stock: 'quantity', amount: 'quantity',
  unit: 'unit', units: 'unit', uom: 'unit', measure: 'unit',
  cost_per_unit: 'cost_per_unit', cost: 'cost_per_unit', price: 'cost_per_unit',
  'unit cost': 'cost_per_unit', 'cost per unit': 'cost_per_unit',
  low_stock_threshold: 'low_stock_threshold', 'low stock': 'low_stock_threshold',
  threshold: 'low_stock_threshold', 'min stock': 'low_stock_threshold',
  reorder: 'low_stock_threshold', 'reorder point': 'low_stock_threshold',
}

function rowsFromSheet(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (data.length < 2) return []
  const rawHeaders = data[0].map((h) => String(h).toLowerCase().trim())
  const headers = rawHeaders.map((h) => HEADER_MAP[h] || h)

  return data.slice(1).map((cols) => {
    const row = {}
    headers.forEach((h, i) => { row[h] = cols[i] !== undefined ? String(cols[i]).trim() : '' })
    return {
      name: row.name || '',
      quantity: parseFloat(row.quantity) || 0,
      unit: UNITS.includes((row.unit || '').toLowerCase()) ? row.unit.toLowerCase() : 'pieces',
      cost_per_unit: parseFloat(row.cost_per_unit) || 0,
      low_stock_threshold: parseFloat(row.low_stock_threshold) || 0,
    }
  }).filter((r) => r.name)
}

function parseFile(file, onResult, onError) {
  const ext = file.name.split('.').pop().toLowerCase()
  const reader = new FileReader()

  if (ext === 'xlsx' || ext === 'xls') {
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = rowsFromSheet(sheet)
        rows.length ? onResult(rows) : onError('No valid rows found in the Excel file. Check that your columns include: name, quantity, unit, cost_per_unit.')
      } catch {
        onError('Could not read Excel file. Make sure it is a valid .xlsx or .xls file.')
      }
    }
    reader.readAsArrayBuffer(file)
  } else {
    // CSV / TSV / TXT
    reader.onload = (e) => {
      try {
        // Strip BOM
        const text = e.target.result.replace(/^\uFEFF/, '')
        // Auto-detect delimiter: semicolon, tab, or comma
        const firstLine = text.split('\n')[0]
        const delim = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ','
        const wb = XLSX.read(text, { type: 'string', FS: delim })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = rowsFromSheet(sheet)
        rows.length ? onResult(rows) : onError('No valid rows found. Make sure your file has a header row with columns: name, quantity, unit, cost_per_unit.')
      } catch {
        onError('Could not read file. Please check the format.')
      }
    }
    reader.readAsText(file)
  }
}

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  color: 'var(--text-1)',
  fontSize: 13,
  padding: '7px 10px',
  outline: 'none',
  width: '100%',
}

const selectStyle = { ...inputStyle, cursor: 'pointer' }

export default function UploadInventory({ onSuccess }) {
  const [tab, setTab] = useState('file')
  const [previewRows, setPreviewRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [manualRows, setManualRows] = useState([emptyRow()])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    setError(''); setPreviewRows([]); setFileName(file.name)
    parseFile(
      file,
      (rows) => { setPreviewRows(rows); setError('') },
      (msg) => { setError(msg); setPreviewRows([]) }
    )
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
    const valid = rows.filter((r) => r.name && parseFloat(r.quantity) >= 0 && parseFloat(r.cost_per_unit) >= 0)
    if (valid.length === 0) { setError('No valid items to upload'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const items = valid.map((r) => ({
        name: r.name,
        quantity: parseFloat(r.quantity) || 0,
        unit: r.unit || 'pieces',
        cost_per_unit: parseFloat(r.cost_per_unit) || 0,
        low_stock_threshold: parseFloat(r.low_stock_threshold) || 0,
      }))
      const res = await inventoryApi.upload(items)
      setSuccess(`Saved ${res.data.saved_count} item${res.data.saved_count !== 1 ? 's' : ''} successfully`)
      setPreviewRows([]); setFileName(''); setManualRows([emptyRow()])
      onSuccess?.()
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ id: 'file', label: 'File Upload' }, { id: 'manual', label: 'Manual Entry' }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              border: `1px solid ${tab === t.id ? 'var(--primary)' : 'var(--border)'}`,
              cursor: 'pointer',
              background: tab === t.id ? 'var(--primary-light)' : 'var(--surface-2)',
              color: tab === t.id ? 'var(--primary)' : 'var(--text-2)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>
          {success}
        </div>
      )}

      {tab === 'file' ? (
        <div>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 12,
              padding: '32px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'var(--primary-light)' : 'var(--surface-2)',
              marginBottom: 16,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
            <div style={{ color: 'var(--text-1)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              {fileName || 'Drop your file here'}
            </div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 6 }}>
              or{' '}
              <span style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600 }}>browse files</span>
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: 11 }}>
              Supports {ACCEPTED_LABEL}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {/* Column hint */}
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <strong style={{ color: 'var(--text-2)' }}>Required columns:</strong>{' '}
            <code style={{ background: 'var(--surface-3)', padding: '1px 5px', borderRadius: 4 }}>name</code>,{' '}
            <code style={{ background: 'var(--surface-3)', padding: '1px 5px', borderRadius: 4 }}>quantity</code>,{' '}
            <code style={{ background: 'var(--surface-3)', padding: '1px 5px', borderRadius: 4 }}>unit</code>,{' '}
            <code style={{ background: 'var(--surface-3)', padding: '1px 5px', borderRadius: 4 }}>cost_per_unit</code>
            {'  '}
            <span style={{ color: 'var(--text-3)' }}>· Also accepts: qty, item, cost, price, unit cost, reorder point…</span>
          </div>

          {/* Preview table */}
          {previewRows.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#15803d', fontWeight: 600 }}>✓ {previewRows.length} row{previewRows.length !== 1 ? 's' : ''} found</span>
                <span>in <strong style={{ color: 'var(--text-2)' }}>{fileName}</strong></span>
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)', maxHeight: 240, marginBottom: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                      {['#', 'Name', 'Quantity', 'Unit', 'Cost / Unit', 'Low Stock'].map((h) => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : 'var(--surface-2)' }}>
                        <td style={{ padding: '6px 10px', color: 'var(--text-3)' }}>{i + 1}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-1)', fontWeight: 500 }}>{r.name}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-2)' }}>{r.quantity}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-2)' }}>{r.unit}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-2)' }}>${r.cost_per_unit}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-2)' }}>{r.low_stock_threshold || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => submitRows(previewRows)}
                  disabled={loading}
                  style={{ padding: '8px 22px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  {loading ? 'Uploading...' : `Upload ${previewRows.length} Items`}
                </button>
                <button
                  onClick={() => { setPreviewRows([]); setFileName('') }}
                  style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13 }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 24px', gap: 8, marginBottom: 6 }}>
            {['Item Name', 'Quantity', 'Unit', 'Cost / Unit', 'Low Stock Alert', ''].map((h) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {manualRows.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 24px', gap: 8, alignItems: 'center' }}>
                <input placeholder="e.g. Chicken Breast" value={row.name} onChange={(e) => updateManualRow(i, 'name', e.target.value)} style={inputStyle} />
                <input type="number" placeholder="0" value={row.quantity} onChange={(e) => updateManualRow(i, 'quantity', e.target.value)} style={inputStyle} />
                <select value={row.unit} onChange={(e) => updateManualRow(i, 'unit', e.target.value)} style={selectStyle}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <input type="number" step="0.01" placeholder="0.00" value={row.cost_per_unit} onChange={(e) => updateManualRow(i, 'cost_per_unit', e.target.value)} style={inputStyle} />
                <input type="number" placeholder="0" value={row.low_stock_threshold} onChange={(e) => updateManualRow(i, 'low_stock_threshold', e.target.value)} style={inputStyle} />
                {manualRows.length > 1 ? (
                  <button onClick={() => removeManualRow(i)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
                ) : <span />}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={addManualRow}
              style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13 }}
            >
              + Add Row
            </button>
            <button
              onClick={() => submitRows(manualRows)}
              disabled={loading}
              style={{ padding: '7px 20px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              {loading ? 'Saving...' : 'Save Items'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
