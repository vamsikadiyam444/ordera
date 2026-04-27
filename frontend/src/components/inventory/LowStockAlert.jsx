export default function LowStockAlert({ items, onItemClick }) {
  if (!items || items.length === 0) return null

  const names = items.map((i) => i.name).join(', ')

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      borderRadius: 10,
      marginBottom: 16,
      background: '#fff5f5',
      border: '1px solid #fecaca',
      color: '#b91c1c',
      fontSize: 13,
      fontWeight: 500,
    }}>
      <span style={{ fontSize: 16 }}>⚠</span>
      <span>
        <strong>{items.length} item{items.length > 1 ? 's' : ''} low on stock:</strong>{' '}
        <span style={{ color: '#dc2626' }}>{names}</span>
      </span>
      {onItemClick && (
        <button
          onClick={onItemClick}
          style={{ marginLeft: 'auto', fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          View
        </button>
      )}
    </div>
  )
}
