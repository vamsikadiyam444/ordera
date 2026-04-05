export default function LowStockAlert({ items, onItemClick }) {
  if (!items || items.length === 0) return null

  const names = items.map((i) => i.name).join(', ')

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4 text-sm font-medium"
      style={{
        background: 'rgba(239,68,68,0.10)',
        border: '1px solid rgba(239,68,68,0.25)',
        color: '#fca5a5',
      }}
    >
      <span style={{ fontSize: 18 }}>⚠</span>
      <span>
        <strong>{items.length} item{items.length > 1 ? 's' : ''} low on stock:</strong>{' '}
        {names}
      </span>
      {onItemClick && (
        <button
          onClick={onItemClick}
          className="ml-auto text-xs underline"
          style={{ color: '#f87171' }}
        >
          View
        </button>
      )}
    </div>
  )
}
