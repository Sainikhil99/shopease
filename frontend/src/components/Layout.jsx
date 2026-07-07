import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard, ShoppingCart, Package, History,
  BarChart2, Tag, Settings, LogOut, AlertTriangle, Menu, X, RotateCcw, Boxes, WifiOff
} from 'lucide-react';
import { useState, useEffect } from 'react';

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOff = () => setOffline(true);
    const goOn  = () => setOffline(false);
    window.addEventListener('offline', goOff);
    window.addEventListener('online',  goOn);
    return () => {
      window.removeEventListener('offline', goOff);
      window.removeEventListener('online',  goOn);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-2 flex items-center gap-2 justify-center">
      <WifiOff size={13} />
      You are offline — billing and inventory still work normally; data is saved on this device.
    </div>
  );
}

const navItems = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/new-bill',      icon: ShoppingCart,    label: 'New Bill' },
  { to: '/products',      icon: Package,         label: 'Products' },
  { to: '/inventory',     icon: Boxes,           label: 'Inventory' },
  { to: '/sales-history', icon: History,         label: 'Sales History' },
  { to: '/returns',       icon: RotateCcw,       label: 'Returns' },
  { to: '/reports',       icon: BarChart2,       label: 'Reports' },
  { to: '/coupons',       icon: Tag,             label: 'Coupons' },
  { to: '/settings',      icon: Settings,        label: 'Settings' },
];

export default function Layout({ children }) {
  const { shop, logout, lowStockProducts } = useApp();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Dark overlay — tap anywhere outside sidebar to close it (mobile only) */}
      {sidebarOpen && (
        <div
          className="lg:hidden"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.50)',
            zIndex: 20,
          }}
        />
      )}

      {/*
        Sidebar — always visible on desktop (lg+).
        On mobile it slides in from the left using the .sidebar-panel CSS class.
        .sidebar-open is added when the hamburger is pressed.
      */}
      <aside
        className={`sidebar-panel fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col bg-white border-r border-gray-200${sidebarOpen ? ' sidebar-open' : ''}`}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-blue-600">ShopEase</h1>
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">{shop?.shopName}</p>
            </div>
            {/* Close button — mobile only */}
            <button
              className="lg:hidden p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              onClick={() => setSidebarOpen(false)}
              style={{ cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
              {label === 'Products' && lowStockProducts.length > 0 && (
                <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {lowStockProducts.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Low stock warning */}
        {lowStockProducts.length > 0 && (
          <div className="mx-4 mb-3 p-3 bg-red-50 rounded-lg border border-red-100">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle size={14} />
              <span className="text-xs font-semibold">
                {lowStockProducts.length} low stock item{lowStockProducts.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* User footer */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
              {shop?.ownerName?.[0] || 'O'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{shop?.ownerName}</p>
              <p className="text-xs text-gray-500 truncate">{shop?.phone}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium"
            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <OfflineBanner />

        {/* Mobile top bar with hamburger */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff', cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Open menu"
          >
            <Menu size={22} color="#374151" />
          </button>
          <span className="font-bold text-blue-600 text-lg">ShopEase</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
