import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  DashboardIcon, OrdersIcon, MenuIcon, KnowledgeIcon,
  SettingsIcon, AnalyticsIcon, LogoutIcon, PhoneIcon, CreditCardIcon,
} from './Icons'

const navItems = [
  { path: '/dashboard', label: 'Dashboard',     icon: DashboardIcon },
  { path: '/orders',    label: 'Orders',         icon: OrdersIcon    },
  { path: '/menu',      label: 'Menu',           icon: MenuIcon      },
  { path: '/documents', label: 'Knowledge Base', icon: KnowledgeIcon },
  { path: '/analytics',    label: 'Analytics',      icon: AnalyticsIcon   },
  { path: '/subscription', label: 'Subscription',   icon: CreditCardIcon  },
  { path: '/settings',    label: 'Settings',       icon: SettingsIcon    },
]

export default function Layout({ children }) {
  const { owner, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = owner?.restaurant_name
    ? owner.restaurant_name.slice(0, 2).toUpperCase()
    : 'AI'

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col flex-shrink-0"
        style={{
          width: '232px',
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              width: 34,
              height: 34,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            }}
          >
            <PhoneIcon size={15} className="text-white" />
          </div>
          <div>
            <div
              className="font-bold text-sm leading-tight"
              style={{ color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.03em' }}
            >
              Ringa
            </div>
            <div
              className="text-xs leading-tight mt-0.5"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              Never miss a customer call again
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${active ? 'active' : ''}`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div
          className="px-3 pb-4 pt-3"
          style={{ borderTop: '1px solid var(--sidebar-border)' }}
        >
          {/* User card */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-3"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <div
              className="flex items-center justify-center rounded-lg text-xs font-bold text-white flex-shrink-0"
              style={{
                width: 32,
                height: 32,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                fontSize: 11,
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-xs font-semibold truncate"
                style={{ color: 'rgba(255,255,255,0.88)' }}
              >
                {owner?.restaurant_name}
              </div>
              <div
                className="text-xs truncate mt-0.5"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                {owner?.email}
              </div>
            </div>
          </div>

          {/* Plan badge — links to subscription page */}
          <Link
            to="/subscription"
            className="flex items-center justify-between px-1 mb-3 rounded-lg py-1 transition-colors"
            style={{ textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
              Plan
            </span>
            <span
              className="text-xs font-semibold capitalize px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(99,102,241,0.18)',
                color: '#a5b4fc',
              }}
            >
              {owner?.plan || 'free'}
            </span>
          </Link>

          {/* Sign out */}
          <button
            onClick={handleLogout}
            className="nav-item w-full text-left"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
              e.currentTarget.style.color = '#fca5a5'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'rgba(255,255,255,0.3)'
            }}
          >
            <LogoutIcon size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">
        <div className="page-enter">
          {children}
        </div>
      </main>
    </div>
  )
}
