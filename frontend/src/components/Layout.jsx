import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard, ShoppingCart, Package, History,
  BarChart2, Tag, Settings, LogOut, AlertTriangle,
  Menu, X, RotateCcw, Boxes, WifiOff, Wallet,
} from 'lucide-react';
import { useState, useEffect } from 'react';

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div style={{ background: '#92400e', color: '#fef3c7', fontSize: 12, fontWeight: 600 }}
      className="flex items-center gap-2 justify-center px-4 py-2">
      <WifiOff size={13} />
      Offline — billing and inventory still work; data saved on this device.
    </div>
  );
}

const NAV = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/new-bill',      icon: ShoppingCart,    label: 'New Bill' },
  { to: '/products',      icon: Package,         label: 'Products',     badge: true },
  { to: '/inventory',     icon: Boxes,           label: 'Inventory' },
  { to: '/sales-history', icon: History,         label: 'Sales History' },
  { to: '/returns',       icon: RotateCcw,       label: 'Returns' },
  { to: '/expenses',      icon: Wallet,          label: 'Expenses' },
  { to: '/reports',       icon: BarChart2,       label: 'Reports' },
  { to: '/coupons',       icon: Tag,             label: 'Coupons' },
  { to: '/settings',      icon: Settings,        label: 'Settings' },
];

// Sidebar styles as plain CSS-in-JS objects for the navy theme
const S = {
  sidebar: {
    width: 248,
    background: '#0d1524',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  logoArea: {
    padding: '20px 20px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 15,
    color: '#fff',
    letterSpacing: '-0.5px',
    flexShrink: 0,
  },
  shopName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.3px',
    lineHeight: 1.2,
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  shopSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.40)',
    marginTop: 1,
  },
  nav: {
    flex: 1,
    padding: '10px 12px',
    overflowY: 'auto',
  },
  navSection: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.8px',
    color: 'rgba(255,255,255,0.28)',
    textTransform: 'uppercase',
    padding: '10px 8px 4px',
    marginTop: 4,
  },
  navItem: (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 9,
    fontSize: 13,
    fontWeight: isActive ? 600 : 500,
    color: isActive ? '#4ade80' : 'rgba(255,255,255,0.65)',
    background: isActive ? 'rgba(22,163,74,0.15)' : 'transparent',
    border: 'none',
    width: '100%',
    cursor: 'pointer',
    transition: 'background 0.13s ease, color 0.13s ease',
    textDecoration: 'none',
    position: 'relative',
    marginBottom: 1,
  }),
  navItemHover: {
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
  },
  activeBorder: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 3,
    height: 20,
    borderRadius: 99,
    background: '#16a34a',
  },
  lowStockBox: {
    margin: '0 12px 10px',
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(220,38,38,0.12)',
    border: '1px solid rgba(220,38,38,0.22)',
  },
  userArea: {
    padding: '12px 16px 16px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 99,
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
  },
};

function NavItem({ to, icon: Icon, label, badgeCount, onClose }) {
  const [hovered, setHovered] = useState(false);
  return (
    <NavLink
      to={to}
      onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={({ isActive }) => ({
        ...S.navItem(isActive),
        ...(hovered && !isActive ? S.navItemHover : {}),
      })}
    >
      {({ isActive }) => (
        <>
          {isActive && <span style={S.activeBorder} />}
          <Icon size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.8 }} />
          <span style={{ flex: 1 }}>{label}</span>
          {badgeCount > 0 && (
            <span style={{
              background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700,
              padding: '1px 6px', borderRadius: 99, lineHeight: 1.6,
            }}>
              {badgeCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { shop, logout, lowStockProducts } = useApp();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Global card glow tracker — direct DOM mutation, zero re-renders
  useEffect(() => {
    const track = (e) => {
      document.querySelectorAll('.card, .stat-card').forEach(el => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    };
    window.addEventListener('mousemove', track, { passive: true });
    return () => window.removeEventListener('mousemove', track);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };
  const initials = shop?.ownerName?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'S';

  const SidebarContent = () => (
    <div style={{ ...S.sidebar, height: '100%' }}>
      {/* Logo */}
      <div style={S.logoArea}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={S.logo}>
            <div style={S.logoMark}>S</div>
            <div>
              <div style={S.shopName}>{shop?.shopName || 'ShopEase'}</div>
              <div style={S.shopSub}>POS &amp; Billing</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
            style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav style={S.nav}>
        {NAV.map(({ to, icon, label, badge }) => (
          <NavItem
            key={to}
            to={to}
            icon={icon}
            label={label}
            badgeCount={badge ? lowStockProducts.length : 0}
            onClose={() => setSidebarOpen(false)}
          />
        ))}
      </nav>

      {/* Low stock warning */}
      {lowStockProducts.length > 0 && (
        <div style={S.lowStockBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#fca5a5' }}>
              {lowStockProducts.length} low stock item{lowStockProducts.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* User footer */}
      <div style={S.userArea}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={S.avatar}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shop?.ownerName || 'Owner'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shop?.phone || ''}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.40)',
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            transition: 'color 0.13s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.40)'}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--workspace)', overflow: 'hidden' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(8,14,26,0.6)', zIndex: 20, backdropFilter: 'blur(2px)' }}
          className="lg:hidden"
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex" style={{ width: 248, flexShrink: 0, height: '100vh' }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <aside
        className="lg:hidden"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 30,
          width: 248,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <OfflineBanner />

        {/* Mobile top bar */}
        <header
          className="lg:hidden"
          style={{
            background: '#0d1524',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'rgba(255,255,255,0.7)', display: 'flex' }}
          >
            <Menu size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ ...S.logoMark, width: 26, height: 26, fontSize: 12, borderRadius: 7 }}>S</div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.3px' }}>ShopEase</span>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
