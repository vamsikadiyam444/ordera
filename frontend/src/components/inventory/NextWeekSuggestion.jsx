import { useEffect, useState } from 'react'
import { inventoryApi } from '../../services/inventoryApi'

/* ── priority config ── */
const PRIORITY = {
  out_of_stock: { label: 'Out of Stock', dot: '#dc2626', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  critical:     { label: 'Critical',     dot: '#dc2626', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  urgent:       { label: 'Urgent',       dot: '#f97316', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  order_soon:   { label: 'Order Soon',   dot: '#eab308', color: '#92400e', bg: '#fefce8', border: '#fde68a' },
  adequate:     { label: 'Adequate',     dot: '#22c55e', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
}

/* ── export to CSV ── */
function exportCSV(rows, meta) {
  const header = [
    `Next Week Grocery Order — ${meta.next_week}`,
    `Generated: ${meta.generated_at}  |  Based on: ${meta.week_analyzed}`,
    `Total Orders Last Week: ${meta.total_orders}  |  Revenue: $${meta.total_revenue}`,
    '',
    '#,Ingredient,Unit,In Stock,Used Last 7d,Proj. Need,Order Qty,Cost/Unit,Est. Cost,Priority,Driven By (Top Sellers)',
  ]
  const body = rows.map((r, i) =>
    `${i+1},"${r.item_name}",${r.unit},${r.current_stock},${r.used_last_7_days},${r.projected_need},${r.order_qty},$${r.cost_per_unit},$${r.estimated_cost},${PRIORITY[r.priority]?.label},"${(r.driven_by||[]).join(', ')}"`
  )
  const blob = new Blob([[...header, ...body].join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `grocery-order-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── print / vendor order ── */
function printOrder(rows, meta, totals) {
  const html = `
    <html><head><title>Grocery Order — ${meta.next_week}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20px; }
      h1   { font-size: 18px; margin: 0 0 4px; }
      .sub { color: #555; font-size: 11px; margin-bottom: 16px; }
      table{ width: 100%; border-collapse: collapse; margin-top: 12px; }
      th   { background: #1e293b; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
      td   { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
      tr:nth-child(even) td { background: #f8fafc; }
      .badge { display:inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
      .total-row { background: #1e293b !important; color: #fff; font-weight: 700; }
      .total-row td { color: #fff; border: none; }
      .meta { display: flex; gap: 24px; background: #f1f5f9; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; }
      .meta-item { }
      .meta-item strong { display: block; font-size: 14px; }
      .meta-item span { font-size: 10px; color: #555; }
      @media print { button { display: none; } }
    </style></head>
    <body>
      <h1>🛒 Weekly Grocery Order — ${meta.next_week}</h1>
      <p class="sub">Generated: ${meta.generated_at} &nbsp;|&nbsp; Based on sales: ${meta.week_analyzed}</p>
      <div class="meta">
        <div class="meta-item"><strong>${meta.total_orders}</strong><span>Orders Last Week</span></div>
        <div class="meta-item"><strong>$${meta.total_revenue.toLocaleString('en-US',{minimumFractionDigits:2})}</strong><span>Revenue Last Week</span></div>
        <div class="meta-item"><strong>${rows.length}</strong><span>Items to Order</span></div>
        <div class="meta-item"><strong>$${totals.toLocaleString('en-US',{minimumFractionDigits:2})}</strong><span>Est. Total Cost</span></div>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>Ingredient</th><th>Unit</th>
          <th>In Stock</th><th>Used Last 7d</th><th>Order Qty</th>
          <th>Cost/Unit</th><th>Est. Cost</th><th>Priority</th><th>Top Selling Dishes</th>
        </tr></thead>
        <tbody>
          ${rows.map((r, i) => {
            const p = PRIORITY[r.priority]
            return `<tr>
              <td>${i+1}</td>
              <td><strong>${r.item_name}</strong></td>
              <td>${r.unit}</td>
              <td>${r.current_stock}</td>
              <td>${r.used_last_7_days}</td>
              <td><strong>${r.order_qty}</strong></td>
              <td>$${r.cost_per_unit}</td>
              <td><strong>$${r.estimated_cost}</strong></td>
              <td><span class="badge" style="background:${p.bg};color:${p.color}">${p.label}</span></td>
              <td style="color:#555">${(r.driven_by||[]).join(', ')}</td>
            </tr>`
          }).join('')}
          <tr class="total-row"><td colspan="7">TOTAL ESTIMATED ORDER COST</td><td colspan="3">$${totals.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <p style="margin-top:20px;font-size:11px;color:#888">Please verify quantities with kitchen staff before sending to vendor.</p>
    </body></html>
  `
  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

/* ── small stat pill ── */
function StatPill({ icon, value, label, color, bg }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, background:bg, borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:600, color }}>
      <span>{icon}</span>
      <span>{value}</span>
      <span style={{ fontWeight:400, opacity:0.85 }}>{label}</span>
    </div>
  )
}

export default function NextWeekSuggestion({ onClose }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [tab, setTab]         = useState('order')   // 'order' | 'sellers' | 'adequate'
  const [qtys, setQtys]       = useState({})        // editable quantities

  useEffect(() => {
    inventoryApi.getWeeklyOrder()
      .then(r => {
        setData(r.data)
        // init editable qtys
        const init = {}
        ;(r.data.needs_order || []).forEach(item => {
          init[item.item_name] = item.order_qty
        })
        setQtys(init)
      })
      .catch(() => setError('Could not load grocery order. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  const rows         = data?.needs_order       || []
  const adequate     = data?.adequate_stock    || []
  const topSellers   = data?.sales_summary?.top_sellers || []
  const totalCost    = rows.reduce((s, r) => s + (qtys[r.item_name] || 0) * r.cost_per_unit, 0)
  const criticalCnt  = rows.filter(r => ['out_of_stock','critical'].includes(r.priority)).length
  const urgentCnt    = rows.filter(r => r.priority === 'urgent').length

  const metaForPrint = {
    next_week:     data?.next_week     || '',
    week_analyzed: data?.week_analyzed || '',
    generated_at:  data?.generated_at  || '',
    total_orders:  data?.sales_summary?.total_orders  || 0,
    total_revenue: data?.sales_summary?.total_revenue || 0,
  }
  const rowsForExport = rows.map(r => ({ ...r, order_qty: qtys[r.item_name] ?? r.order_qty }))

  /* ── tab button ── */
  const TabBtn = ({ id, label, count }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
        border: `1.5px solid ${tab === id ? '#4f46e5' : '#e5e7eb'}`,
        background: tab === id ? '#4f46e5' : '#fff',
        color: tab === id ? '#fff' : '#374151',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      {label}
      {count !== undefined && (
        <span style={{
          background: tab === id ? 'rgba(255,255,255,0.25)' : '#f3f4f6',
          color: tab === id ? '#fff' : '#6b7280',
          borderRadius: 10, padding: '1px 7px', fontSize: 11,
        }}>{count}</span>
      )}
    </button>
  )

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 18,
          width: '100%', maxWidth: 900, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,0.22)',
          overflow: 'hidden',
        }}
      >
        {/* ════ HEADER ════ */}
        <div style={{
          padding: '22px 26px 0',
          background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 100%)',
          flexShrink: 0,
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:3 }}>
                <span style={{ fontSize:24 }}>🛒</span>
                <h2 style={{ margin:0, fontSize:19, fontWeight:700, color:'#fff' }}>
                  Next Week Grocery Order
                </h2>
              </div>
              {data && (
                <div style={{ fontSize:12, color:'#a5b4fc', marginLeft:34 }}>
                  Covers <strong style={{color:'#c7d2fe'}}>{data.next_week}</strong>
                  &nbsp;·&nbsp;Based on sales from <strong style={{color:'#c7d2fe'}}>{data.week_analyzed}</strong>
                  &nbsp;·&nbsp;Generated {data.generated_at}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background:'rgba(255,255,255,0.12)', border:'none', borderRadius:8,
                width:32, height:32, fontSize:18, cursor:'pointer', color:'#c7d2fe',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              }}
            >×</button>
          </div>

          {/* Stat pills */}
          {!loading && data && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
              <StatPill icon="📦" value={rows.length}          label="items to order"     color="#3730a3" bg="#e0e7ff" />
              <StatPill icon="🚨" value={criticalCnt+urgentCnt} label="critical / urgent"  color="#991b1b" bg="#fef2f2" />
              <StatPill icon="🍽️"  value={data.sales_summary?.total_orders}  label="orders last week" color="#065f46" bg="#d1fae5" />
              <StatPill icon="💰" value={`$${(data.sales_summary?.total_revenue||0).toLocaleString('en-US',{minimumFractionDigits:2})}`} label="revenue last week" color="#065f46" bg="#d1fae5" />
              <StatPill icon="🧾" value={`$${totalCost.toFixed(2)}`} label="est. order cost" color="#92400e" bg="#fef3c7" />
            </div>
          )}

          {/* Tabs */}
          {!loading && !error && (
            <div style={{ display:'flex', gap:6, paddingBottom:1 }}>
              <TabBtn id="order"    label="Grocery Order"    count={rows.length} />
              <TabBtn id="sellers"  label="Top Selling Dishes" count={topSellers.length} />
              <TabBtn id="adequate" label="Adequate Stock"   count={adequate.length} />
            </div>
          )}
        </div>

        {/* ════ BODY ════ */}
        <div style={{ overflowY:'auto', flex:1 }}>

          {loading && (
            <div style={{ textAlign:'center', padding:'70px 24px', color:'#6b7280', fontSize:14 }}>
              <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
              Analysing last 7 days of kitchen orders and stock levels...
            </div>
          )}

          {error && (
            <div style={{ textAlign:'center', padding:'70px 24px', color:'#dc2626', fontSize:14 }}>
              <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
              {error}
            </div>
          )}

          {/* ── GROCERY ORDER TAB ── */}
          {!loading && !error && tab === 'order' && (
            rows.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 24px', color:'#6b7280', fontSize:14 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
                All ingredients are well stocked for next week!
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f8fafc', position:'sticky', top:0, zIndex:2 }}>
                    {['#','Ingredient','In Stock','Used Last 7d','Order Qty','Est. Cost','Top Selling Dishes Using This','Priority'].map((h, i) => (
                      <th key={h} style={{
                        padding: i === 0 ? '11px 8px 11px 20px' : '11px 12px',
                        textAlign: i === 0 ? 'center' : 'left',
                        fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const p   = PRIORITY[row.priority] || PRIORITY.order_soon
                    const qty = qtys[row.item_name] ?? row.order_qty
                    return (
                      <tr key={i} style={{ borderBottom:'1px solid #f1f5f9', background: i%2===0?'#fff':'#fafafa' }}>
                        {/* # */}
                        <td style={{ padding:'13px 8px 13px 20px', textAlign:'center', color:'#9ca3af', fontSize:12, fontWeight:600 }}>{i+1}</td>

                        {/* Name */}
                        <td style={{ padding:'13px 12px' }}>
                          <div style={{ fontWeight:700, color:'#111827', fontSize:13 }}>{row.item_name}</div>
                          <div style={{ fontSize:11, color:'#9ca3af' }}>{row.unit}</div>
                        </td>

                        {/* In stock */}
                        <td style={{ padding:'13px 12px' }}>
                          <div style={{ fontWeight:600, color: row.current_stock===0 ? '#dc2626' : '#374151' }}>
                            {row.current_stock}
                          </div>
                          <div style={{ fontSize:11, color:'#9ca3af' }}>
                            {row.days_remaining >= 99 ? '—' : `${row.days_remaining}d left`}
                          </div>
                        </td>

                        {/* Used last 7d */}
                        <td style={{ padding:'13px 12px', color:'#6b7280' }}>
                          <div>{row.used_last_7_days} {row.unit}</div>
                          <div style={{ fontSize:11, color:'#9ca3af' }}>{row.avg_daily_usage}/day avg</div>
                        </td>

                        {/* Editable order qty */}
                        <td style={{ padding:'13px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={qty}
                              onChange={e => setQtys(prev => ({ ...prev, [row.item_name]: parseFloat(e.target.value) || 0 }))}
                              style={{
                                width:70, padding:'5px 8px', borderRadius:7,
                                border:'1.5px solid #6366f1', fontSize:13, fontWeight:700,
                                color:'#3730a3', background:'#eef2ff', outline:'none',
                                textAlign:'right',
                              }}
                            />
                            <span style={{ fontSize:11, color:'#6b7280' }}>{row.unit}</span>
                          </div>
                          <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>
                            Proj. need: {row.projected_need}
                          </div>
                        </td>

                        {/* Est. cost */}
                        <td style={{ padding:'13px 12px' }}>
                          <div style={{ fontWeight:700, color:'#059669', fontSize:14 }}>
                            ${((qtys[row.item_name] ?? row.order_qty) * row.cost_per_unit).toFixed(2)}
                          </div>
                          <div style={{ fontSize:11, color:'#9ca3af' }}>${row.cost_per_unit}/{row.unit}</div>
                        </td>

                        {/* Driven by */}
                        <td style={{ padding:'13px 12px', maxWidth:200 }}>
                          {(row.driven_by||[]).length > 0 ? (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                              {row.driven_by.map(name => (
                                <span key={name} style={{
                                  background:'#f0f9ff', color:'#0369a1',
                                  border:'1px solid #bae6fd', borderRadius:10,
                                  padding:'2px 8px', fontSize:10, fontWeight:500,
                                  whiteSpace:'nowrap',
                                }}>{name}</span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>
                          )}
                        </td>

                        {/* Priority */}
                        <td style={{ padding:'13px 16px 13px 12px' }}>
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:5,
                            background:p.bg, border:`1px solid ${p.border}`,
                            borderRadius:20, padding:'4px 10px',
                            fontSize:11, fontWeight:600, color:p.color, whiteSpace:'nowrap',
                          }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background:p.dot, flexShrink:0 }} />
                            {p.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          )}

          {/* ── TOP SELLERS TAB ── */}
          {!loading && !error && tab === 'sellers' && (
            <div style={{ padding:'24px 26px' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:4 }}>
                Top Selling Dishes — Last 7 Days
              </div>
              <div style={{ fontSize:12, color:'#9ca3af', marginBottom:20 }}>
                These dishes are driving your ingredient demand for next week.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {topSellers.map((item, i) => {
                  const maxQty = topSellers[0]?.qty_sold || 1
                  const pct    = Math.round((item.qty_sold / maxQty) * 100)
                  const colors = ['#4f46e5','#7c3aed','#0ea5e9','#059669','#d97706','#dc2626','#64748b','#0891b2','#16a34a','#9333ea']
                  return (
                    <div key={i} style={{
                      background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10,
                      padding:'14px 16px', display:'flex', alignItems:'center', gap:14,
                    }}>
                      <div style={{
                        width:32, height:32, borderRadius:8, flexShrink:0,
                        background:colors[i]||'#64748b',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:13, fontWeight:700, color:'#fff',
                      }}>{i+1}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, color:'#111827', fontSize:14 }}>{item.name}</div>
                        <div style={{ marginTop:6, background:'#e5e7eb', borderRadius:4, height:6, overflow:'hidden' }}>
                          <div style={{ width:`${pct}%`, height:'100%', background:colors[i]||'#64748b', borderRadius:4, transition:'width 0.5s' }} />
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:18, fontWeight:700, color:colors[i]||'#374151' }}>{item.qty_sold}</div>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>portions sold</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── ADEQUATE STOCK TAB ── */}
          {!loading && !error && tab === 'adequate' && (
            <div style={{ padding:'24px 26px' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:4 }}>
                Well Stocked — No Order Needed
              </div>
              <div style={{ fontSize:12, color:'#9ca3af', marginBottom:20 }}>
                These ingredients have enough stock to cover next week's projected usage.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:10 }}>
                {adequate.map((item, i) => (
                  <div key={i} style={{
                    background:'#f0fdf4', border:'1px solid #bbf7d0',
                    borderRadius:10, padding:'12px 14px',
                    display:'flex', alignItems:'center', gap:10,
                  }}>
                    <span style={{ fontSize:16 }}>✅</span>
                    <div>
                      <div style={{ fontWeight:600, color:'#14532d', fontSize:13 }}>{item.item_name}</div>
                      <div style={{ fontSize:11, color:'#16a34a' }}>
                        {item.current_stock} {item.unit} in stock
                        {item.avg_daily_usage > 0 && ` · ${item.days_remaining}d left`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ════ FOOTER ════ */}
        {!loading && !error && rows.length > 0 && tab === 'order' && (
          <div style={{
            padding:'14px 24px',
            borderTop:'1px solid #e5e7eb',
            background:'#f8fafc',
            display:'flex', alignItems:'center', justifyContent:'space-between',
            flexShrink:0, flexWrap:'wrap', gap:12,
          }}>
            <div style={{ fontSize:13, color:'#374151' }}>
              <strong style={{ color:'#111827' }}>{rows.length} ingredients</strong> to order
              &nbsp;·&nbsp; Estimated total:&nbsp;
              <strong style={{ color:'#059669', fontSize:16 }}>${totalCost.toFixed(2)}</strong>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                You can edit quantities above before exporting
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => exportCSV(rowsForExport, metaForPrint)}
                style={{
                  padding:'9px 16px', borderRadius:8, fontSize:12, fontWeight:600,
                  background:'#fff', color:'#374151',
                  border:'1px solid #d1d5db', cursor:'pointer',
                }}
              >📥 Export CSV</button>
              <button
                onClick={() => printOrder(rowsForExport, metaForPrint, totalCost)}
                style={{
                  padding:'9px 16px', borderRadius:8, fontSize:12, fontWeight:600,
                  background:'#0f172a', color:'#fff',
                  border:'none', cursor:'pointer',
                }}
              >🖨️ Print / Send to Vendor</button>
              <button
                onClick={onClose}
                style={{
                  padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:600,
                  background:'#4f46e5', color:'#fff',
                  border:'none', cursor:'pointer',
                }}
              >Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
