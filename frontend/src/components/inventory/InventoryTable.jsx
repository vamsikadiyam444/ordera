import { useState } from 'react'
import { inventoryApi } from '../../services/inventoryApi'

function statusBadge(item) {
  if (item.quantity === 0)
    return { label: 'Out of Stock', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
  if (item.low_stock)
    return { label: 'Low Stock', color: '#b45309', bg: '#fffbeb', border: '#fde68a' }
  return { label: 'In Stock', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' }
}

const th = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  background: 'var(--surface-2)',
}

const td = {
  padding: '11px 14px',
  fontSize: 13,
  color: 'var(--text-1)',
  borderTop: '1px solid var(--border)',
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
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase() }
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
    <span style={{ opacity: sortKey === k ? 0.7 : 0.25, marginLeft: 4, fontSize: 10 }}>
      {sortKey === k && sortDir === 'desc' ? '▼' : '▲'}
    </span>
  )

  const inlineInput = {
    width: 90,
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid var(--primary)',
    background: '#fff',
    color: 'var(--text-1)',
    fontSize: 13,
    outline: 'none',
  }

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          style={{
            width: '100%',
            maxWidth: 320,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text-1)',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text-3)', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>
          {(items || []).length === 0
            ? 'No inventory items yet. Use the Upload / Add Items button above.'
            : 'No items match your search.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { key: 'name', label: 'Item Name' },
                  { key: 'unit', label: 'Unit' },
                  { key: 'quantity', label: 'Quantity' },
                  { key: 'cost_per_unit', label: 'Cost / Unit' },
                  { key: null, label: 'Total Value' },
                  { key: null, label: 'Status' },
                  { key: null, label: 'Actions' },
                ].map(({ key, label }) => (
                  <th
                    key={label}
                    onClick={() => key && toggleSort(key)}
                    style={{ ...th, cursor: key ? 'pointer' : 'default' }}
                  >
                    {label}{key && <SortIcon k={key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const badge = statusBadge(item)
                const isEditing = editId === item.id
                return (
                  <tr key={item.id} style={{ background: isEditing ? '#f0f6ff' : '#fff' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{item.name}</td>
                    <td style={{ ...td, color: 'var(--text-2)' }}>{item.unit}</td>
                    <td style={td}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editVal.quantity}
                          onChange={(e) => setEditVal({ ...editVal, quantity: parseFloat(e.target.value) || 0 })}
                          style={inlineInput}
                        />
                      ) : item.quantity}
                    </td>
                    <td style={td}>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editVal.cost_per_unit}
                          onChange={(e) => setEditVal({ ...editVal, cost_per_unit: parseFloat(e.target.value) || 0 })}
                          style={inlineInput}
                        />
                      ) : (
                        <span style={{ color: 'var(--text-2)' }}>${item.cost_per_unit.toFixed(2)}</span>
                      )}
                    </td>
                    <td style={{ ...td, color: 'var(--text-2)' }}>
                      ${(item.quantity * item.cost_per_unit).toFixed(2)}
                    </td>
                    <td style={td}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        color: badge.color,
                        background: badge.bg,
                        border: `1px solid ${badge.border}`,
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={td}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => saveEdit(item)}
                            disabled={saving}
                            style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                          >
                            {saving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--surface-3)', color: 'var(--text-2)', border: 'none', cursor: 'pointer', fontSize: 12 }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => startEdit(item)}
                            style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            disabled={deleting === item.id}
                            style={{ padding: '4px 10px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', cursor: 'pointer', fontSize: 12 }}
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
