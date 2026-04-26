import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { inventoryApi } from '../../services/inventoryApi'

const DAYS_OPTIONS = [7, 14, 30, 90]

const SLICES = [
  { key: 'COGS',        label: 'Food Cost (COGS)', color: '#ef4444' },
  { key: 'Wastage',     label: 'Wastage',           color: '#f97316' },
  { key: 'Profit',      label: 'Gross Profit',      color: '#22c55e' },
]

/* ── Metric summary card ── */
function MetricCard({ label, value, color, sub }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 130,
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 18px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

/* ── PCR gauge bar ── */
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
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 5 }}>
        (Revenue − COGS − Wastage) / Revenue × 100
      </div>
    </div>
  )
}

/* ── Custom pie tooltip ── */
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value, payload: inner } = payload[0]
  const pct = inner._pct
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      fontSize: 13,
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{name}</div>
      <div style={{ color: 'var(--text-2)' }}>
        <strong>${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>({pct}%)</span>
      </div>
    </div>
  )
}

/* ── Custom legend ── */
function PieLegend({ slices, revenue }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center', minWidth: 200 }}>
      {slices.map(({ label, color, value, pct }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
              ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ marginLeft: 5, fontWeight: 600, color }}>({pct}%)</span>
            </div>
          </div>
        </div>
      ))}
      <div style={{
        borderTop: '1px solid var(--border)',
        paddingTop: 8,
        marginTop: 2,
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--text-1)',
      }}>
        Total Revenue: ${revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  )
}

/* ── Custom label inside pie slice ── */
function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, _pct }) {
  if (_pct < 4) return null   // skip tiny slices
  const RAD = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * RAD)
  const y = cy + r * Math.sin(-midAngle * RAD)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
      {_pct}%
    </text>
  )
}

export default function ProfitCard() {
  const [days, setDays]       = useState(7)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({
    total_revenue: 0, total_cogs: 0,
    total_wastage_cost: 0, gross_profit: 0,
    profit_conversion_ratio: 0,
  })

  useEffect(() => {
    setLoading(true)
    inventoryApi.getAnalytics(days)
      .then((r) => {
        const s = r.data.summary || {}
        const daily = r.data.daily_profit || []
        setSummary({
          total_revenue:          s.total_revenue          ?? daily.reduce((a, d) => a + d.revenue, 0),
          total_cogs:             s.total_cogs             ?? daily.reduce((a, d) => a + (d.cogs ?? 0), 0),
          total_wastage_cost:     s.total_wastage_cost     ?? 0,
          gross_profit:           s.gross_profit           ?? daily.reduce((a, d) => a + d.profit, 0),
          profit_conversion_ratio: s.profit_conversion_ratio ?? 0,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  /* build pie data */
  const rev = summary.total_revenue
  const pieSlices = SLICES.map(({ key, label, color }) => {
    const value = key === 'COGS'    ? summary.total_cogs
                : key === 'Wastage' ? summary.total_wastage_cost
                :                     Math.max(summary.gross_profit, 0)
    const pct = rev > 0 ? parseFloat(((value / rev) * 100).toFixed(1)) : 0
    return { name: label, value: parseFloat(value.toFixed(2)), color, _pct: pct }
  })

  const legendSlices = SLICES.map(({ label, color }, i) => ({
    label,
    color,
    value: pieSlices[i].value,
    pct:   pieSlices[i]._pct,
  }))

  const hasData = rev > 0

  return (
    <div>
      {/* ── Day range selector ── */}
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

      {/* ── Summary cards ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        <MetricCard label="Revenue"      value={`$${summary.total_revenue.toFixed(2)}`}       color="#094cb2" />
        <MetricCard label="COGS"         value={`$${summary.total_cogs.toFixed(2)}`}           color="#dc2626" sub="Cost of goods sold" />
        <MetricCard label="Wastage"      value={`$${summary.total_wastage_cost.toFixed(2)}`}   color="#b45309" sub="Logged waste cost" />
        <MetricCard
          label="Gross Profit"
          value={`$${summary.gross_profit.toFixed(2)}`}
          color={summary.gross_profit >= 0 ? '#15803d' : '#dc2626'}
          sub="Revenue − COGS − Wastage"
        />
        <PcrGauge value={summary.profit_conversion_ratio} />
      </div>

      {/* ── Pie chart ── */}
      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '20px 0' }}>Loading...</div>
      ) : !hasData ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
          No order data in this period. Once orders come in and ingredients are mapped, profit will appear here.
        </div>
      ) : (
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '24px 20px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 16 }}>
            Revenue Breakdown — last {days} days
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            {/* Pie */}
            <div style={{ flex: '0 0 260px', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieSlices}
                    cx="50%"
                    cy="50%"
                    outerRadius={115}
                    innerRadius={52}
                    dataKey="value"
                    labelLine={false}
                    label={renderLabel}
                    strokeWidth={2}
                    stroke="var(--surface-1)"
                  >
                    {pieSlices.map((slice, i) => (
                      <Cell key={i} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <PieLegend slices={legendSlices} revenue={rev} />
          </div>
        </div>
      )}
    </div>
  )
}
