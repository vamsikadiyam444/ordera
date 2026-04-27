import { useState, useEffect } from 'react'
import { inventoryApi } from '../../services/inventoryApi'
import axios from 'axios'

function menuApi() {
  const token = localStorage.getItem('token')
  return axios.create({ baseURL: '/api', headers: { Authorization: `Bearer ${token}` } })
}

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  color: 'var(--text-1)',
  fontSize: 13,
  padding: '7px 10px',
  outline: 'none',
}

export default function MappingUI({ inventoryItems }) {
  const [menuItems, setMenuItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [mappings, setMappings] = useState([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ text: '', ok: true })

  useEffect(() => {
    menuApi().get('/menu/').then((r) => setMenuItems(r.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selected) return
    inventoryApi.getMappings(selected.id)
      .then((r) => setMappings(r.data || []))
      .catch(() => setMappings([]))
  }, [selected])

  const addRow = () => {
    setMappings([...mappings, { inventory_item_id: inventoryItems[0]?.id || '', quantity_used_per_order: '' }])
  }

  const updateRow = (i, field, val) => {
    const rows = [...mappings]
    rows[i] = { ...rows[i], [field]: val }
    setMappings(rows)
  }

  const removeRow = (i) => setMappings(mappings.filter((_, idx) => idx !== i))

  const save = async () => {
    if (!selected) return
    const valid = mappings.filter((m) => m.inventory_item_id && parseFloat(m.quantity_used_per_order) > 0)
    setSaving(true); setMessage({ text: '', ok: true })
    try {
      await inventoryApi.saveMappings({
        menu_item_id: selected.id,
        ingredients: valid.map((m) => ({
          inventory_item_id: m.inventory_item_id,
          quantity_used_per_order: parseFloat(m.quantity_used_per_order),
        })),
      })
      setMessage({ text: 'Mappings saved successfully', ok: true })
      const r = await inventoryApi.getMappings(selected.id)
      setMappings(r.data || [])
    } catch (err) {
      setMessage({ text: err.response?.data?.detail || 'Failed to save', ok: false })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 24, minHeight: 320 }}>
      {/* Left: menu items list */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Menu Items
        </div>
        {menuItems.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No menu items found</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {menuItems.map((item) => {
            const active = selected?.id === item.id
            return (
              <button
                key={item.id}
                onClick={() => { setSelected(item); setMessage({ text: '', ok: true }) }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  background: active ? 'var(--primary-light)' : 'var(--surface-1)',
                  color: active ? 'var(--primary)' : 'var(--text-1)',
                }}
              >
                {item.name}
                <span style={{ display: 'block', fontSize: 11, color: active ? 'var(--primary)' : 'var(--text-3)', marginTop: 2, opacity: 0.8 }}>
                  ${item.price}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />

      {/* Right: mapping panel */}
      <div style={{ flex: 1 }}>
        {!selected ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13, paddingTop: 40, textAlign: 'center' }}>
            ← Select a menu item to manage its ingredient mappings
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
              {selected.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
              Specify how much of each inventory item is consumed per 1 ordered unit
            </div>

            {message.text && (
              <div style={{ marginBottom: 14, fontSize: 13, color: message.ok ? '#15803d' : '#dc2626' }}>
                {message.text}
              </div>
            )}

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 8, marginBottom: 6 }}>
              {['Ingredient', 'Quantity used per order', ''].map((h) => (
                <div key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {mappings.map((row, i) => {
                const selInv = inventoryItems.find((inv) => inv.id === row.inventory_item_id)
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 8, alignItems: 'center' }}>
                    <select
                      value={row.inventory_item_id}
                      onChange={(e) => updateRow(i, 'inventory_item_id', e.target.value)}
                      style={{ ...inputStyle, width: '100%' }}
                    >
                      <option value="">Select ingredient…</option>
                      {inventoryItems.map((inv) => (
                        <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={selInv ? `Amount in ${selInv.unit}` : 'Quantity'}
                      value={row.quantity_used_per_order}
                      onChange={(e) => updateRow(i, 'quantity_used_per_order', e.target.value)}
                      style={{ ...inputStyle, width: '100%' }}
                    />
                    <button onClick={() => removeRow(i)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
                  </div>
                )
              })}
            </div>

            {inventoryItems.length > 0 ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={addRow}
                  style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13 }}
                >
                  + Add Ingredient
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  style={{ padding: '7px 20px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  {saving ? 'Saving...' : 'Save Mappings'}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                Add inventory items first before creating mappings.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
