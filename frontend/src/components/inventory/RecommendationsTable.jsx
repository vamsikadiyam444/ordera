import { useEffect, useState } from 'react'
import { inventoryApi } from '../../services/inventoryApi'

function urgency(item) {
  if (item.current_quantity === 0)
    return { label: 'Critical', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
  if (item.avg_daily_usage > 0) {
    const daysLeft = item.current_quantity / item.avg_daily_usage
    if (daysLeft <= 1) return { label: 'Critical', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
    if (daysLeft <= 3) return { label: 'Soon', color: '#b45309', bg: '#fffbeb', border: '#fde68a' }
    return { label: 'Plan Ahead', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' }
  }
  return { label: 'Reorder', color: '#b45309', bg: '#fffbeb', border: '#fde68a' }
}

function exportCSV(rows) {
  const header = 'Item,Unit,Current Stock,Avg Daily Use,Recommended Order,Urgency'
  const body = rows.map((r) =>
    `${r.item_name},${r.unit},${r.current_quantity},${r.avg_daily_usage},${r.recommended_order_qty},${urgency(r).label}`
  ).join('\n')
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'reorder-recommendations.csv'; a.click()
  URL.revokeObjectURL(url)
}

const th = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  background: 'var(--surface-2)',
}

export default function RecommendationsTable() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    inventoryApi.getRecommendations()
      .then((r) => setRows(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading...</div>

  if (rows.length === 0) {
    return (
      <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
        No reorder recommendations. Either stock is sufficient or no usage data is available yet.
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
          Based on last 7 days · <strong style={{ color: 'var(--text-2)' }}>{rows.length} item{rows.length !== 1 ? 's' : ''}</strong> need restocking
        </div>
        <button
          onClick={() => exportCSV(rows)}
          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer' }}
        >
          Export CSV
        </button>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Item', 'Unit', 'Current Stock', 'Avg Daily Use', 'Recommended Order', 'Urgency'].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const u = urgency(row)
              return (
                <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : 'var(--surface-2)' }}>
                  <td style={{ padding: '11px 14px', color: 'var(--text-1)', fontWeight: 600 }}>{row.item_name}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)' }}>{row.unit}</td>
                  <td style={{ padding: '11px 14px', color: row.current_quantity === 0 ? '#dc2626' : 'var(--text-2)', fontWeight: row.current_quantity === 0 ? 700 : 400 }}>
                    {row.current_quantity}
                  </td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-2)' }}>{row.avg_daily_usage}/day</td>
                  <td style={{ padding: '11px 14px', color: 'var(--primary)', fontWeight: 700, fontSize: 14 }}>{row.recommended_order_qty}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: u.color, background: u.bg, border: `1px solid ${u.border}` }}>
                      {u.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
