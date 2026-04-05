import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { inventoryApi } from '../services/inventoryApi'
import LowStockAlert from '../components/inventory/LowStockAlert'
import InventoryTable from '../components/inventory/InventoryTable'
import UploadInventory from '../components/inventory/UploadInventory'
import MappingUI from '../components/inventory/MappingUI'
import WasteEntry from '../components/inventory/WasteEntry'
import WasteCard from '../components/inventory/WasteCard'
import ProfitCard from '../components/inventory/ProfitCard'
import RecommendationsTable from '../components/inventory/RecommendationsTable'

const TABS = [
  { id: 'stock',    label: 'Stock' },
  { id: 'mapping',  label: 'Mapping' },
  { id: 'profit',   label: 'Profit' },
  { id: 'waste',    label: 'Waste' },
  { id: 'reorder',  label: 'Reorder' },
]

export default function Inventory() {
  const [tab, setTab] = useState('stock')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  const loadItems = useCallback(() => {
    setLoading(true)
    inventoryApi.list()
      .then((r) => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  const lowStockItems = items.filter((i) => i.low_stock)

  return (
    <Layout>
      <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
              Inventory
            </h1>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
              Track stock, map ingredients, and monitor waste and profit
            </div>
          </div>
          {tab === 'stock' && (
            <button
              onClick={() => setShowUpload((v) => !v)}
              style={{
                padding: '8px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 500,
                background: showUpload ? 'rgba(255,255,255,0.08)' : 'rgba(9,76,178,0.35)',
                color: showUpload ? 'rgba(255,255,255,0.5)' : '#7eb0f0',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {showUpload ? 'Hide Upload' : '+ Upload / Add Items'}
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 18px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                background: tab === t.id ? 'rgba(9,76,178,0.25)' : 'transparent',
                color: tab === t.id ? '#7eb0f0' : 'rgba(255,255,255,0.4)',
                borderBottom: tab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
                marginBottom: -1,
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 24,
          }}
        >
          {/* ── Stock tab ── */}
          {tab === 'stock' && (
            <div>
              <LowStockAlert items={lowStockItems} />

              {showUpload && (
                <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Add / Update Inventory
                  </div>
                  <UploadInventory onSuccess={() => { loadItems(); setShowUpload(false) }} />
                </div>
              )}

              {loading ? (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '20px 0' }}>
                  Loading inventory...
                </div>
              ) : (
                <InventoryTable items={items} onRefresh={loadItems} />
              )}
            </div>
          )}

          {/* ── Mapping tab ── */}
          {tab === 'mapping' && (
            <div>
              <div className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Link menu items to inventory ingredients so orders auto-deduct stock.
              </div>
              <MappingUI inventoryItems={items} />
            </div>
          )}

          {/* ── Profit tab ── */}
          {tab === 'profit' && (
            <div>
              <div className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Revenue, ingredient costs, and profit per day.
                {items.length === 0 && ' Add inventory items and ingredient mappings to see cost data.'}
              </div>
              <ProfitCard />
            </div>
          )}

          {/* ── Waste tab ── */}
          {tab === 'waste' && (
            <div className="flex gap-10">
              <div style={{ flex: '0 0 380px' }}>
                <div className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Log Waste
                </div>
                <WasteEntry inventoryItems={items} onSuccess={loadItems} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Waste Analytics (last 30 days)
                </div>
                <WasteCard />
              </div>
            </div>
          )}

          {/* ── Reorder tab ── */}
          {tab === 'reorder' && (
            <div>
              <div className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Weekly reorder suggestions based on the last 7 days of usage.
              </div>
              <RecommendationsTable />
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
