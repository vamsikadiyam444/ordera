import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { inventoryApi } from '../../services/inventoryApi'

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']

export default function WasteCard() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    inventoryApi.getAnalytics(30)
      .then((r) => setSummary(r.data.waste_summary))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading...</div>
  if (!summary || summary.waste_by_item.length === 0) {
    return <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No waste recorded yet.</div>
  }

  const pieData = summary.waste_by_item.map((item) => ({
    name: item.name,
    value: item.waste_value,
  }))

  return (
    <div>
      {/* Total */}
      <div className="flex gap-4 mb-5">
        <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: '12px 20px', border: '1px solid rgba(239,68,68,0.18)' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total Waste Value</div>
          <div style={{ color: '#f87171', fontSize: 24, fontWeight: 700 }}>${summary.total_waste_value.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Pie chart */}
        <div style={{ flex: 1 }}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1e2533', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                formatter={(val) => [`$${val.toFixed(2)}`]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div style={{ flex: 1 }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Item', 'Wasted', 'Value', 'Waste %'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.waste_by_item.map((item, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '5px 8px', color: 'rgba(255,255,255,0.8)' }}>{item.name}</td>
                  <td style={{ padding: '5px 8px', color: 'rgba(255,255,255,0.5)' }}>{item.wasted_qty} {item.unit}</td>
                  <td style={{ padding: '5px 8px', color: '#f87171' }}>${item.waste_value.toFixed(2)}</td>
                  <td style={{ padding: '5px 8px', color: 'rgba(255,255,255,0.4)' }}>{item.waste_pct_of_total_inventory.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
