import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { inventoryApi } from '../../services/inventoryApi'

const DAYS_OPTIONS = [7, 14, 30]

export default function ProfitCard() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [totals, setTotals] = useState({ revenue: 0, cost: 0, profit: 0 })

  useEffect(() => {
    setLoading(true)
    inventoryApi.getAnalytics(days)
      .then((r) => {
        const daily = r.data.daily_profit || []
        setData(daily.map((d) => ({
          date: d.date.slice(5), // MM-DD
          Revenue: d.revenue,
          Cost: d.cost,
          Profit: d.profit,
        })))
        const rev = daily.reduce((s, d) => s + d.revenue, 0)
        const cost = daily.reduce((s, d) => s + d.cost, 0)
        setTotals({ revenue: rev, cost, profit: rev - cost })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  const Card = ({ label, value, color }) => (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 22, fontWeight: 700 }}>${value.toFixed(2)}</div>
    </div>
  )

  return (
    <div>
      {/* Day selector */}
      <div className="flex gap-2 mb-5">
        {DAYS_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: '5px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              background: days === d ? 'rgba(9,76,178,0.35)' : 'rgba(255,255,255,0.06)',
              color: days === d ? '#7eb0f0' : 'rgba(255,255,255,0.5)',
            }}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="flex gap-3 mb-5">
        <Card label="Revenue" value={totals.revenue} color="#7eb0f0" />
        <Card label="Cost" value={totals.cost} color="#f87171" />
        <Card label="Profit" value={totals.profit} color={totals.profit >= 0 ? '#4ade80' : '#f87171'} />
      </div>

      {/* Bar chart */}
      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading...</div>
      ) : data.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No order data in this period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
            <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#1e2533', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
              formatter={(val) => [`$${val.toFixed(2)}`]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />
            <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="Cost" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
