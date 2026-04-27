import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { inventoryApi } from '../../services/inventoryApi'

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 700, color: 'var(--text-1)' }}>{payload[0].name}</div>
      <div style={{ color: '#dc2626', marginTop: 2 }}>Value: <strong>${payload[0].value.toFixed(2)}</strong></div>
    </div>
  )
}

export default function WasteCard() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    inventoryApi.getAnalytics(30)
      .then((r) => setSummary(r.data.waste_summary))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading...</div>
  if (!summary || summary.waste_by_item.length === 0) {
    return (
      <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
        No waste recorded yet. Use the Log Waste form to track spoilage.
      </div>
    )
  }

  const pieData = summary.waste_by_item.map((item) => ({ name: item.name, value: item.waste_value }))

  return (
    <div>
      {/* Total waste value */}
      <div style={{
        display: 'inline-block',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 10,
        padding: '12px 20px',
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Total Waste Value (30d)
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>
          ${summary.total_waste_value.toFixed(2)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Pie chart */}
        <div style={{ flex: '0 0 220px' }}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown table */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Item', 'Wasted', 'Value', 'Waste %'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.waste_by_item.map((item, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 12px', color: 'var(--text-1)', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--text-2)' }}>{item.wasted_qty} {item.unit}</td>
                  <td style={{ padding: '9px 12px', color: '#dc2626', fontWeight: 600 }}>${item.waste_value.toFixed(2)}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--text-3)' }}>{item.waste_pct_of_total_inventory.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
