import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  DashboardIcon, OrdersIcon, MenuIcon, KnowledgeIcon,
  SettingsIcon, AnalyticsIcon, LogoutIcon, PhoneIcon, CreditCardIcon, InventoryIcon,
} from './Icons'

const navItems = [
  { path: '/dashboard',  label: 'Dashboard',     icon: DashboardIcon  },
  { path: '/menu',       label: 'Menu',           icon: MenuIcon       },
  { path: '/inventory',  label: 'Inventory',      icon: InventoryIcon  },
  { path: '/documents',  label: 'Knowledge Base', icon: KnowledgeIcon  },
  { path: '/analytics',  label: 'Analytics',      icon: AnalyticsIcon  },
  { path: '/subscription', label: 'Subscription', icon: CreditCardIcon },
  { path: '/settings',   label: 'Settings',       icon: SettingsIcon   },
]

export default function Layout({ children }) {
  const { owner, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  const initials = owner?.restaurant_name
    ? owner.restaurant_name.slice(0, 2).toUpperCase()
    : 'AI'

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Mobile overlay backdrop ── */}
      {sidebarOpen && (
        <div
          onClick={closeSidebar}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.45)',
            display: 'none',
          }}
          className="mobile-sidebar-backdrop"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`flex flex-col flex-shrink-0 layout-sidebar${sidebarOpen ? ' sidebar-open' : ''}`}
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
              background: 'linear-gradient(135deg, #094cb2, #3366cc)',
              boxShadow: '0 4px 12px rgba(9,76,178,0.40)',
            }}
          >
            <PhoneIcon size={15} className="text-white" />
          </div>
          <div>
            <div
              className="font-bold text-sm leading-tight"
              style={{ color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.03em' }}
            >
              Ringa AI
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
                onClick={closeSidebar}
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
                background: 'linear-gradient(135deg, #094cb2, #3366cc)',
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
                background: 'rgba(9,76,178,0.20)',
                color: '#7eb0f0',
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
        {/* Mobile top bar — hamburger + brand, hidden on desktop */}
        <div className="mobile-topbar">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Open menu"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px', borderRadius: 8, color: 'var(--text-1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 44, minHeight: 44,
            }}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="19" y2="6"/>
              <line x1="3" y1="12" x2="19" y2="12"/>
              <line x1="3" y1="18" x2="19" y2="18"/>
            </svg>
          </button>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Ringa AI
          </span>
        </div>
        <div className="page-enter">
          {children}
        </div>
      </main>
    </div>
  )
}
