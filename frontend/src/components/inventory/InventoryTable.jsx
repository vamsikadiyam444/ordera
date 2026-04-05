import { useState } from 'react'
import { inventoryApi } from '../../services/inventoryApi'

const STATUS = (item) => {
  if (item.quantity === 0) return { label: 'Out', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' }
  if (item.low_stock) return { label: 'Low', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' }
  return { label: 'OK', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' }
}

export default function InventoryTable({ items, onRefresh }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const filtered = (items || [])
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      if (typeof av === 'string') av = av.toLowerCase(), bv = bv.toLowerCase()
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const startEdit = (item) => {
    setEditId(item.id)
    setEditVal({ quantity: item.quantity, cost_per_unit: item.cost_per_unit, low_stock_threshold: item.low_stock_threshold })
  }

  const saveEdit = async (item) => {
    setSaving(true)
    try {
      await inventoryApi.update(item.id, editVal)
      setEditId(null)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this inventory item?')) return
    setDeleting(id)
    try {
      await inventoryApi.remove(id)
      onRefresh()
    } finally {
      setDeleting(null)
    }
  }

  const SortIcon = ({ k }) => (
    <span style={{ opacity: sortKey === k ? 1 : 0.3, marginLeft: 4, fontSize: 10 }}>
      {sortKey === k && sortDir === 'desc' ? '▼' : '▲'}
    </span>
  )

  return (
    <div>
      <div className="mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{
            background: 'var(--card-bg, rgba(255,255,255,0.06))',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            color: 'var(--text, #e2e8f0)',
            outline: 'none',
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
          No inventory items yet. Upload some above.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border, rgba(255,255,255,0.1))' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                  { key: 'name', label: 'Item Name' },
                  { key: 'unit', label: 'Unit' },
                  { key: 'quantity', label: 'Quantity' },
                  { key: 'cost_per_unit', label: 'Cost/Unit' },
                  { key: null, label: 'Total Value' },
                  { key: null, label: 'Status' },
                  { key: null, label: 'Actions' },
                ].map(({ key, label }) => (
                  <th
                    key={label}
                    onClick={() => key && toggleSort(key)}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      color: 'rgba(255,255,255,0.5)',
                      fontWeight: 500,
                      cursor: key ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}{key && <SortIcon k={key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => {
                const status = STATUS(item)
                const isEditing = editId === item.id
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      background: isEditing ? 'rgba(9,76,178,0.08)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>
                      {item.name}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.5)' }}>{item.unit}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editVal.quantity}
                          onChange={(e) => setEditVal({ ...editVal, quantity: parseFloat(e.target.value) || 0 })}
                          style={{ width: 80, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '2px 6px', color: '#fff', fontSize: 13 }}
                        />
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.88)' }}>{item.quantity}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editVal.cost_per_unit}
                          onChange={(e) => setEditVal({ ...editVal, cost_per_unit: parseFloat(e.target.value) || 0 })}
                          style={{ width: 80, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '2px 6px', color: '#fff', fontSize: 13 }}
                        />
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>${item.cost_per_unit.toFixed(2)}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.7)' }}>
                      ${(item.quantity * item.cost_per_unit).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        color: status.color,
                        background: status.bg,
                      }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(item)}
                            disabled={saving}
                            style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, background: '#094cb2', color: '#fff', border: 'none', cursor: 'pointer' }}
                          >
                            {saving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(item)}
                            style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            disabled={deleting === item.id}
                            style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.10)', color: '#f87171', border: 'none', cursor: 'pointer' }}
                          >
                            {deleting === item.id ? '...' : 'Del'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
