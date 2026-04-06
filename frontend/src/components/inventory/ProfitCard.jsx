import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { inventoryApi } from '../../services/inventoryApi'

const DAYS_OPTIONS = [7, 14, 30]

function MetricCard({ label, value, color, sub }) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 18px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-1)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginTop: 3 }}>
          {p.name}: <strong>${p.value.toFixed(2)}</strong>
        </div>
      ))}
    </div>
  )
}

function PcrGauge({ value }) {
  const pct = Math.min(Math.max(value, 0), 100)
  const color = pct >= 40 ? '#15803d' : pct >= 20 ? '#b45309' : '#dc2626'
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 18px',
      minWidth: 180,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        Profit Conversion Ratio
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, marginBottom: 8 }}>
        {value.toFixed(1)}%
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 5 }}>
        (Revenue − COGS − Wastage) / Revenue × 100
      </div>
    </div>
  )
}

export default function ProfitCard() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ total_revenue: 0, total_cogs: 0, total_wastage_cost: 0, gross_profit: 0, profit_conversion_ratio: 0 })

  useEffect(() => {
    setLoading(true)
    inventoryApi.getAnalytics(days)
      .then((r) => {
        const daily = r.data.daily_profit || []
        const s = r.data.summary || {}
        setData(daily.map((d) => ({
          date: d.date.slice(5),
          Revenue: d.revenue,
          COGS: d.cogs ?? d.cost ?? 0,
          Wastage: d.wastage ?? 0,
          Profit: d.profit,
        })))
        setSummary({
          total_revenue: s.total_revenue ?? daily.reduce((acc, d) => acc + d.revenue, 0),
          total_cogs: s.total_cogs ?? daily.reduce((acc, d) => acc + (d.cogs ?? d.cost ?? 0), 0),
          total_wastage_cost: s.total_wastage_cost ?? 0,
          gross_profit: s.gross_profit ?? daily.reduce((acc, d) => acc + d.profit, 0),
          profit_conversion_ratio: s.profit_conversion_ratio ?? 0,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  return (
    <div>
      {/* Day range selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {DAYS_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: '5px 16px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${days === d ? 'var(--primary)' : 'var(--border)'}`,
              cursor: 'pointer',
              background: days === d ? 'var(--primary-light)' : 'var(--surface-2)',
              color: days === d ? 'var(--primary)' : 'var(--text-2)',
            }}
          >
            {d} days
          </button>
        ))}
      </div>

      {/* Summary cards row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Revenue" value={`$${summary.total_revenue.toFixed(2)}`} color="#094cb2" />
        <MetricCard label="COGS" value={`$${summary.total_cogs.toFixed(2)}`} color="#dc2626" sub="Cost of goods sold" />
        <MetricCard label="Wastage" value={`$${summary.total_wastage_cost.toFixed(2)}`} color="#b45309" sub="Logged waste cost" />
        <MetricCard
          label="Gross Profit"
          value={`$${summary.gross_profit.toFixed(2)}`}
          color={summary.gross_profit >= 0 ? '#15803d' : '#dc2626'}
          sub="Revenue − COGS − Wastage"
        />
        <PcrGauge value={summary.profit_conversion_ratio} />
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading...</div>
      ) : data.length === 0 ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
          No order data in this period. Once orders come in and ingredients are mapped, profit will appear here.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-2)' }} />
            <Bar dataKey="Revenue" fill="#094cb2" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="COGS" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="Wastage" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
