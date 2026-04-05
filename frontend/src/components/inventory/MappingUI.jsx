import { useState, useEffect } from 'react'
import { inventoryApi } from '../../services/inventoryApi'
import axios from 'axios'

function menuApi() {
  const token = localStorage.getItem('token')
  return axios.create({ baseURL: '/api', headers: { Authorization: `Bearer ${token}` } })
}

export default function MappingUI({ inventoryItems }) {
  const [menuItems, setMenuItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [mappings, setMappings] = useState([])
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

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
    setSaving(true); setSuccess('')
    try {
      await inventoryApi.saveMappings({
        menu_item_id: selected.id,
        ingredients: valid.map((m) => ({
          inventory_item_id: m.inventory_item_id,
          quantity_used_per_order: parseFloat(m.quantity_used_per_order),
        })),
      })
      setSuccess('Mappings saved')
      // Refresh
      const r = await inventoryApi.getMappings(selected.id)
      setMappings(r.data || [])
    } catch (err) {
      setSuccess('Error: ' + (err.response?.data?.detail || 'save failed'))
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 13,
    padding: '6px 10px',
    outline: 'none',
  }

  return (
    <div className="flex gap-6" style={{ minHeight: 320 }}>
      {/* Left: Menu items list */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <div className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Menu Items</div>
        <div className="space-y-1">
          {menuItems.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No menu items found</div>
          )}
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setSelected(item); setSuccess('') }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                background: selected?.id === item.id ? 'rgba(9,76,178,0.30)' : 'rgba(255,255,255,0.04)',
                color: selected?.id === item.id ? '#7eb0f0' : 'rgba(255,255,255,0.75)',
              }}
            >
              {item.name}
              <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                ${item.price}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Mapping panel */}
      <div className="flex-1">
        {!selected ? (
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, paddingTop: 40 }}>
            Select a menu item to manage its ingredients
          </div>
        ) : (
          <div>
            <div className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.88)' }}>
              {selected.name} — Ingredients
            </div>
            <div className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Set how much of each inventory item is used per 1 ordered unit
            </div>

            {success && (
              <div className="mb-3 text-xs" style={{ color: success.startsWith('Error') ? '#f87171' : '#4ade80' }}>
                {success}
              </div>
            )}

            <div className="space-y-2 mb-3">
              {mappings.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={row.inventory_item_id}
                    onChange={(e) => updateRow(i, 'inventory_item_id', e.target.value)}
                    style={{ ...inputStyle, flex: 2 }}
                  >
                    <option value="">Select ingredient…</option>
                    {inventoryItems.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} ({inv.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`Qty per order (${inventoryItems.find((i) => i.id === row.inventory_item_id)?.unit || 'unit'})`}
                    value={row.quantity_used_per_order}
                    onChange={(e) => updateRow(i, 'quantity_used_per_order', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => removeRow(i)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
              ))}
            </div>

            {inventoryItems.length > 0 && (
              <div className="flex gap-3">
                <button
                  onClick={addRow}
                  style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', cursor: 'pointer', fontSize: 13 }}
                >
                  + Add Ingredient
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  style={{ padding: '7px 20px', borderRadius: 8, background: '#094cb2', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                >
                  {saving ? 'Saving...' : 'Save Mappings'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
