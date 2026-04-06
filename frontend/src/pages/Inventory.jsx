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
import InvoiceUpload from '../components/inventory/InvoiceUpload'

const TABS = [
  { id: 'stock',   label: 'Stock' },
  { id: 'mapping', label: 'Mapping' },
  { id: 'profit',  label: 'Profit' },
  { id: 'waste',   label: 'Waste' },
  { id: 'reorder', label: 'Reorder' },
  { id: 'invoice', label: 'Invoice Scanner' },
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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              Inventory
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
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
                fontWeight: 600,
                background: showUpload ? 'var(--surface-2)' : 'var(--primary)',
                color: showUpload ? 'var(--text-2)' : '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {showUpload ? 'Hide Upload' : '+ Upload / Add Items'}
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-5" style={{ borderBottom: '2px solid var(--border)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 20px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                background: 'transparent',
                color: tab === t.id ? 'var(--primary)' : 'var(--text-3)',
                borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -2,
                transition: 'color 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content card */}
        <div style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 24,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>

          {/* ── Stock ── */}
          {tab === 'stock' && (
            <div>
              <LowStockAlert items={lowStockItems} />

              {showUpload && (
                <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 16 }}>
                    Add / Update Inventory
                  </div>
                  <UploadInventory onSuccess={() => { loadItems(); setShowUpload(false) }} />
                </div>
              )}

              {loading ? (
                <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '20px 0' }}>
                  Loading inventory...
                </div>
              ) : (
                <InventoryTable items={items} onRefresh={loadItems} />
              )}
            </div>
          )}

          {/* ── Mapping ── */}
          {tab === 'mapping' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
                Link menu items to inventory ingredients so orders auto-deduct stock.
              </div>
              <MappingUI inventoryItems={items} />
            </div>
          )}

          {/* ── Profit ── */}
          {tab === 'profit' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
                Revenue, ingredient costs, and profit per day.{' '}
                {items.length === 0 && 'Add inventory items and ingredient mappings to see cost data.'}
              </div>
              <ProfitCard />
            </div>
          )}

          {/* ── Waste ── */}
          {tab === 'waste' && (
            <div className="flex gap-10">
              <div style={{ flex: '0 0 380px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 16 }}>
                  Log Waste
                </div>
                <WasteEntry inventoryItems={items} onSuccess={loadItems} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 16 }}>
                  Waste Analytics (last 30 days)
                </div>
                <WasteCard />
              </div>
            </div>
          )}

          {/* ── Reorder ── */}
          {tab === 'reorder' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
                Weekly reorder suggestions based on the last 7 days of usage.
              </div>
              <RecommendationsTable />
            </div>
          )}

          {/* ── Invoice Scanner ── */}
          {tab === 'invoice' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
                Upload a supplier invoice — AI will extract item names, quantities, and costs and add them to your inventory.
              </div>
              <InvoiceUpload inventoryItems={items} onSuccess={loadItems} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
