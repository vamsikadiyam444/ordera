import { useEffect, useState } from 'react'
import { inventoryApi } from '../../services/inventoryApi'

function urgency(item) {
  if (item.current_quantity === 0) return { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' }
  if (item.avg_daily_usage > 0) {
    const daysLeft = item.current_quantity / item.avg_daily_usage
    if (daysLeft <= 1) return { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' }
    if (daysLeft <= 3) return { label: 'Soon', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' }
    return { label: 'OK', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' }
  }
  return { label: 'Order', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' }
}

function exportCSV(rows) {
  const header = 'Item,Unit,Current Stock,Avg Daily Use,Recommended Order,Urgency'
  const body = rows.map((r) =>
    `${r.item_name},${r.unit},${r.current_quantity},${r.avg_daily_usage},${r.recommended_order_qty},${urgency(r).label}`
  ).join('\n')
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'reorder-recommendations.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function RecommendationsTable() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    inventoryApi.getRecommendations()
      .then((r) => setRows(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading...</div>
  if (rows.length === 0) {
    return (
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
        No reorder recommendations. Either stock is sufficient or no usage data available yet.
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Based on last 7 days of usage · {rows.length} item{rows.length !== 1 ? 's' : ''} need restocking
        </div>
        <button
          onClick={() => exportCSV(rows)}
          style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', cursor: 'pointer' }}
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Item', 'Unit', 'Current Stock', 'Avg Daily Use', 'Recommended Order', 'Urgency'].map((h) => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const u = urgency(row)
              return (
                <tr key={i} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{row.item_name}</td>
                  <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.4)' }}>{row.unit}</td>
                  <td style={{ padding: '10px 14px', color: row.current_quantity === 0 ? '#f87171' : 'rgba(255,255,255,0.7)' }}>
                    {row.current_quantity}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.6)' }}>{row.avg_daily_usage}/day</td>
                  <td style={{ padding: '10px 14px', color: '#7eb0f0', fontWeight: 600 }}>{row.recommended_order_qty}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: u.color, background: u.bg }}>
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
