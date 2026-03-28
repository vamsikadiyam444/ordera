import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { menuApi, knowledgeApi } from '../services/api'
import { PlusIcon, SearchIcon, SpinnerIcon, TrashIcon, CheckIcon, XIcon } from '../components/Icons'

const EMPTY_FORM = { category: '', name: '', description: '', price: '', available: true }

/* ── Category icon mapping ── */
const CATEGORY_ICONS = {
  Appetizers: '🥗',
  Mains: '🍽',
  Pizzas: '🍕',
  Burgers: '🍔',
  Pasta: '🍝',
  Sides: '🍟',
  Drinks: '🥤',
  Desserts: '🍰',
  Salads: '🥬',
  Specials: '⭐',
}
const getCategoryIcon = (cat) => CATEGORY_ICONS[cat] || '🍴'

/* ── Toggle Switch (Apple style) ── */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className="relative flex-shrink-0 transition-all duration-300 ease-in-out"
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        background: checked ? '#34c759' : '#e5e5ea',
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: 'none',
        outline: 'none',
        padding: 0,
      }}
    >
      <span
        className="block rounded-full bg-white shadow-md transition-all duration-300"
        style={{
          width: 22,
          height: 22,
          transform: `translateX(${checked ? 20 : 2}px) translateY(2px)`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  )
}

/* ── Inline editable price ── */
function EditablePrice({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value.toString())
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const commit = () => {
    const num = parseFloat(draft)
    if (!isNaN(num) && num >= 0) onSave(num)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="text-right font-bold"
        style={{
          width: 72,
          fontSize: 15,
          padding: '4px 8px',
          border: '1.5px solid #0071e3',
          borderRadius: 8,
          outline: 'none',
          background: 'rgba(0,113,227,0.04)',
          color: 'var(--text-1)',
        }}
      />
    )
  }

  return (
    <span
      className="font-bold cursor-pointer px-2 py-1 rounded-lg transition-colors"
      style={{ fontSize: 15, color: 'var(--text-1)' }}
      onClick={() => setEditing(true)}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      title="Click to edit price"
    >
      ${value.toFixed(2)}
    </span>
  )
}

/* ── Menu Item Row ── */
function MenuItemRow({ item, onEdit, onDelete, onToggle, onPriceUpdate }) {
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleToggle = async () => {
    setToggling(true)
    await onToggle(item)
    setToggling(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete(item.id)
    setDeleting(false)
  }

  return (
    <div
      className="group flex items-center gap-4 px-4 py-3.5 transition-all duration-200"
      style={{
        borderBottom: '1px solid var(--border)',
        opacity: item.available ? 1 : 0.5,
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.015)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
            {item.name}
          </span>
          {!item.available && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 10, fontWeight: 600 }}
            >
              UNAVAILABLE
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)', maxWidth: 340 }}>
            {item.description}
          </p>
        )}
      </div>

      {/* Price - click to edit */}
      <EditablePrice
        value={item.price}
        onSave={(newPrice) => onPriceUpdate(item, newPrice)}
      />

      {/* Toggle */}
      <Toggle checked={item.available} onChange={handleToggle} disabled={toggling} />

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={() => onEdit(item)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,113,227,0.08)'; e.currentTarget.style.color = '#0071e3' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}
          title="Edit item"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        {showConfirm ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
              title="Confirm delete"
            >
              {deleting ? <SpinnerIcon size={14} /> : <CheckIcon size={13} />}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-3)' }}
              title="Cancel"
            >
              <XIcon size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}
            title="Delete item"
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Add/Edit Modal (Apple sheet style) ── */
function ItemModal({ open, editId, form, setForm, onSubmit, onClose, saving }) {
  const nameRef = useRef(null)
  useEffect(() => { if (open) setTimeout(() => nameRef.current?.focus(), 100) }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ animation: 'fadeIn 0.15s ease' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card-bg)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
            {editId ? 'Edit Item' : 'New Menu Item'}
          </h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full transition-colors"
            style={{ width: 30, height: 30, background: 'var(--border)', color: 'var(--text-3)' }}
            onMouseEnter={e => e.currentTarget.style.background = '#d2d2d7'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--border)'}
          >
            <XIcon size={14} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="px-6 pb-6">
          <div className="space-y-4">
            {/* Name + Category row */}
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-3">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)', letterSpacing: '0.02em' }}>
                  ITEM NAME
                </label>
                <input
                  ref={nameRef}
                  className="input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Classic Burger"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)', letterSpacing: '0.02em' }}>
                  CATEGORY
                </label>
                <input
                  className="input"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  placeholder="Mains"
                  required
                  list="category-suggestions"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)', letterSpacing: '0.02em' }}>
                DESCRIPTION
              </label>
              <input
                className="input"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Short description for the AI phone agent"
              />
            </div>

            {/* Price + Available row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)', letterSpacing: '0.02em' }}>
                  PRICE
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--text-3)' }}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    style={{ paddingLeft: 24 }}
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="12.99"
                    required
                  />
                </div>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <Toggle
                    checked={form.available}
                    onChange={() => setForm({ ...form, available: !form.available })}
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
                    {form.available ? 'Available' : 'Unavailable'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: 'var(--border)', color: 'var(--text-2)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(145deg, #0077ED, #0071e3)',
                boxShadow: '0 2px 8px rgba(0,113,227,0.3)',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <><SpinnerIcon size={14} /> Saving...</>
              ) : editId ? (
                <><CheckIcon size={14} /> Update Item</>
              ) : (
                <><PlusIcon size={14} /> Add Item</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════ */

export default function MenuManager() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  const load = async () => {
    try {
      const res = await menuApi.list()
      setItems(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Categories
  const categories = ['All', ...new Set(items.map(i => i.category))]

  // Filtered items
  const filtered = items.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // Group by category
  const grouped = filtered.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || []
    acc[item.category].push(item)
    return acc
  }, {})

  // Stats
  const totalItems = items.length
  const availableItems = items.filter(i => i.available).length
  const categoriesCount = new Set(items.map(i => i.category)).size

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = { ...form, price: parseFloat(form.price) }
      if (editId) {
        await menuApi.update(editId, data)
        setMessage({ type: 'success', text: `"${form.name}" updated` })
      } else {
        await menuApi.create(data)
        setMessage({ type: 'success', text: `"${form.name}" added to menu` })
      }
      setForm(EMPTY_FORM)
      setEditId(null)
      setShowModal(false)
      await load()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to save item' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 4000)
    }
  }

  const handleEdit = (item) => {
    setEditId(item.id)
    setForm({ ...item, price: item.price.toString() })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    await menuApi.delete(id)
    setMessage({ type: 'success', text: 'Item removed from menu' })
    await load()
    setTimeout(() => setMessage(null), 3000)
  }

  const handleToggle = async (item) => {
    await menuApi.update(item.id, { available: !item.available })
    await load()
  }

  const handlePriceUpdate = async (item, newPrice) => {
    if (newPrice === item.price) return
    await menuApi.update(item.id, { price: newPrice })
    setMessage({ type: 'success', text: `Price updated to $${newPrice.toFixed(2)}` })
    await load()
    setTimeout(() => setMessage(null), 3000)
  }

  const openAddModal = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  return (
    <Layout>
      <div className="px-8 py-8 max-w-5xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8" style={{ animation: 'fadeInUp 0.4s ease both' }}>
          <div>
            <h1
              className="font-extrabold tracking-tight"
              style={{ fontSize: 32, color: 'var(--text-1)', letterSpacing: '-0.035em' }}
            >
              Menu
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
              {totalItems} items across {categoriesCount} categories
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={async () => {
                setSyncing(true)
                try {
                  const res = await knowledgeApi.syncMenu()
                  const { inserted } = res.data
                  await load()
                  setMessage({ type: 'success', text: inserted > 0 ? `Synced ${inserted} items from Knowledge Base` : 'Menu is up to date' })
                  setTimeout(() => setMessage(null), 4000)
                } catch {
                  await load()
                } finally {
                  setSyncing(false)
                }
              }}
              disabled={syncing || loading}
              className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                background: 'var(--card-bg)',
                border: '1.5px solid var(--border)',
                color: 'var(--text-2)',
                boxShadow: 'var(--shadow-sm)',
                opacity: syncing || loading ? 0.6 : 1,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#0071e3'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              title="Sync menu items from Knowledge Base"
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}
              >
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              Sync from KB
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 py-2.5 px-5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
              style={{
                background: 'linear-gradient(145deg, #0077ED, #0071e3)',
                boxShadow: '0 2px 8px rgba(0,113,227,0.3)',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,113,227,0.4)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,113,227,0.3)'}
            >
              <PlusIcon size={15} /> Add Item
            </button>
          </div>
        </div>

        {/* ── Alert ── */}
        {message && (
          <div
            className="mb-6 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2.5"
            style={{
              animation: 'fadeInUp 0.25s ease both',
              background: message.type === 'success' ? 'rgba(52,199,89,0.08)' : 'rgba(239,68,68,0.08)',
              color: message.type === 'success' ? '#248a3d' : '#d70015',
              border: `1px solid ${message.type === 'success' ? 'rgba(52,199,89,0.15)' : 'rgba(239,68,68,0.15)'}`,
            }}
          >
            {message.type === 'success' ? <CheckIcon size={14} /> : <XIcon size={14} />}
            {message.text}
          </div>
        )}

        {/* ── Stats bar ── */}
        <div
          className="grid grid-cols-3 gap-4 mb-8"
          style={{ animation: 'fadeInUp 0.4s ease 0.05s both' }}
        >
          {[
            { label: 'Total Items', value: totalItems, color: '#0071e3' },
            { label: 'Available', value: availableItems, color: '#34c759' },
            { label: 'Categories', value: categoriesCount, color: '#ff9500' },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 flex items-center gap-4"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                className="flex items-center justify-center rounded-xl"
                style={{ width: 42, height: 42, background: `${stat.color}10`, color: stat.color, fontSize: 18, fontWeight: 700 }}
              >
                {stat.value}
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>{stat.label}</span>
            </div>
          ))}
        </div>

        {/* ── Search + Category tabs ── */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6"
          style={{ animation: 'fadeInUp 0.4s ease 0.1s both' }}
        >
          {/* Search */}
          <div className="relative flex-shrink-0" style={{ width: 240 }}>
            <SearchIcon
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-3)' }}
            />
            <input
              className="input"
              style={{ paddingLeft: 34, fontSize: 13 }}
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Category pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
                style={{
                  background: activeCategory === cat ? '#0071e3' : 'transparent',
                  color: activeCategory === cat ? '#fff' : 'var(--text-3)',
                  border: activeCategory === cat ? '1.5px solid #0071e3' : '1.5px solid var(--border)',
                  boxShadow: activeCategory === cat ? '0 2px 8px rgba(0,113,227,0.25)' : 'none',
                }}
              >
                {cat !== 'All' && <span className="mr-1">{getCategoryIcon(cat)}</span>}
                {cat}
                {cat !== 'All' && (
                  <span className="ml-1 opacity-70">
                    {items.filter(i => i.category === cat).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Menu items ── */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <SpinnerIcon size={24} />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div
            className="rounded-2xl py-16 text-center"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              animation: 'fadeInUp 0.4s ease 0.15s both',
            }}
          >
            <div className="text-4xl mb-3">{search ? '🔍' : '🍽'}</div>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-1)' }}>
              {search ? 'No items found' : 'Your menu is empty'}
            </h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-3)' }}>
              {search ? 'Try a different search term' : 'Upload your menu in the Knowledge Base to auto-import items, or add them manually.'}
            </p>
            {!search && (
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 py-2.5 px-5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(145deg, #0077ED, #0071e3)' }}
              >
                <PlusIcon size={14} /> Add First Item
              </button>
            )}
          </div>
        ) : (
          <div style={{ animation: 'fadeInUp 0.4s ease 0.15s both' }}>
            {Object.entries(grouped).map(([category, catItems]) => (
              <div
                key={category}
                className="rounded-2xl overflow-hidden mb-5"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Category header */}
                <div
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <span style={{ fontSize: 18 }}>{getCategoryIcon(category)}</span>
                    <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
                      {category}
                    </h2>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--border)', color: 'var(--text-3)' }}
                    >
                      {catItems.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
                    <span className="font-medium" style={{ color: '#34c759' }}>
                      {catItems.filter(i => i.available).length}
                    </span>
                    <span>available</span>
                  </div>
                </div>

                {/* Items */}
                {catItems.map(item => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                    onPriceUpdate={handlePriceUpdate}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Category suggestions datalist */}
        <datalist id="category-suggestions">
          {[...new Set(items.map(i => i.category))].map(cat => (
            <option key={cat} value={cat} />
          ))}
        </datalist>
      </div>

      {/* ── Add/Edit Modal ── */}
      <ItemModal
        open={showModal}
        editId={editId}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        onClose={() => { setShowModal(false); setEditId(null); setForm(EMPTY_FORM) }}
        saving={saving}
      />
    </Layout>
  )
}
