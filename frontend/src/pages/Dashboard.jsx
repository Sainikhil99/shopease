import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  TrendingUp, ShoppingCart, IndianRupee, Package,
  AlertTriangle, Plus, History, BarChart2, Tag, ArrowRight,
  RotateCcw, Wallet,
} from 'lucide-react';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, iconBg, iconFg, icon: Icon, onClick }) {
  return (
    <div
      className="stat-card"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t3)', letterSpacing: '0.1px' }}>{label}</span>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={17} style={{ color: iconFg }} />
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.4px', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 5 }}>{sub}</div>
      )}
    </div>
  );
}

// ── Payment mode pill ─────────────────────────────────────────────────────────
const PAY_STYLE = {
  cash:      { bg: '#f0fdf4', color: '#15803d' },
  upi:       { bg: '#eff6ff', color: '#2563eb' },
  phonepe:   { bg: '#f5f3ff', color: '#7c3aed' },
  googlepay: { bg: '#fff7ed', color: '#ea580c' },
  card:      { bg: '#f9fafb', color: '#374151' },
};
const PAY_LABEL = { cash: 'Cash', upi: 'UPI', phonepe: 'PhonePe', googlepay: 'GPay', card: 'Card' };

export default function Dashboard() {
  const {
    shop, todaysSales, todaysProfit, todaysBills, lowStockProducts, products,
    todaysExpenseTotal,
  } = useApp();
  const navigate = useNavigate();

  const netProfit       = todaysProfit - todaysExpenseTotal;
  const hasLowStock     = lowStockProducts.length > 0;
  const activeProducts  = products.filter(p => p.isActive).length;

  const payBreakdown = todaysBills.reduce((acc, b) => {
    acc[b.paymentMode] = (acc[b.paymentMode] || 0) + b.total;
    return acc;
  }, {});

  const QUICK = [
    { icon: Plus,      label: 'New Bill',      sub: 'Start billing',       to: '/new-bill',      iconBg: '#f0fdf4', iconFg: '#16a34a' },
    { icon: Package,   label: 'Products',      sub: 'Manage catalogue',    to: '/products',      iconBg: '#eff6ff', iconFg: '#2563eb' },
    { icon: History,   label: 'Sales History', sub: 'View past bills',     to: '/sales-history', iconBg: '#f5f3ff', iconFg: '#7c3aed' },
    { icon: RotateCcw, label: 'Returns',       sub: 'Process refunds',     to: '/returns',       iconBg: '#fff7ed', iconFg: '#ea580c' },
    { icon: Wallet,    label: 'Expenses',      sub: 'Track daily costs',   to: '/expenses',      iconBg: '#fef2f2', iconFg: '#dc2626' },
    { icon: BarChart2, label: 'Reports',       sub: 'Analytics',           to: '/reports',       iconBg: '#eef2ff', iconFg: '#4f46e5' },
    { icon: Tag,       label: 'Coupons',       sub: 'Manage offers',       to: '/coupons',       iconBg: '#fdf2f8', iconFg: '#db2777' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.4px', marginBottom: 3 }}>
            {shop?.shopName || 'Dashboard'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={() => navigate('/new-bill')} className="btn-primary">
          <Plus size={16} /> New Bill
        </button>
      </div>

      {/* ── Stat grid ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}
           className="lg:grid-cols-4">
        <StatCard
          label="Today's Revenue"
          value={`₹${Math.round(todaysSales).toLocaleString('en-IN')}`}
          sub="Gross sales today"
          icon={IndianRupee}
          iconBg="#f0fdf4" iconFg="#16a34a"
        />
        <StatCard
          label={todaysExpenseTotal > 0 ? 'Net Profit' : "Today's Profit"}
          value={`₹${Math.round(netProfit).toLocaleString('en-IN')}`}
          sub={todaysExpenseTotal > 0 ? `After ₹${Math.round(todaysExpenseTotal).toLocaleString('en-IN')} expenses` : 'Estimated gross'}
          icon={TrendingUp}
          iconBg={netProfit < 0 ? '#fef2f2' : '#f0fdf4'}
          iconFg={netProfit < 0 ? '#dc2626' : '#16a34a'}
        />
        <StatCard
          label="Bills Today"
          value={todaysBills.length}
          sub="Transactions"
          icon={ShoppingCart}
          iconBg="#f5f3ff" iconFg="#7c3aed"
        />
        <StatCard
          label="Active Products"
          value={activeProducts}
          sub={hasLowStock ? `${lowStockProducts.length} need restocking` : 'All stocked'}
          icon={Package}
          iconBg={hasLowStock ? '#fef2f2' : '#fff7ed'}
          iconFg={hasLowStock ? '#dc2626' : '#ea580c'}
          onClick={hasLowStock ? () => document.getElementById('low-stock-section')?.scrollIntoView({ behavior: 'smooth' }) : undefined}
        />
      </div>

      {/* ── Main columns ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }} className="lg:grid-cols-3">

        {/* Quick Actions */}
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.2px', marginBottom: 14 }}>
            Quick Actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {QUICK.map(({ icon: Icon, label, sub, to, iconBg, iconFg }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px',
                  borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                  transition: 'background 0.13s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--border-sub, #f7f8fa)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} style={{ color: iconFg }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
                </div>
                <ArrowRight size={13} style={{ color: 'var(--t4)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Today's Bills */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.2px' }}>Today's Bills</div>
            <button
              onClick={() => navigate('/sales-history')}
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--green-600)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              View all →
            </button>
          </div>

          {todaysBills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t4)' }}>
              <ShoppingCart size={36} style={{ margin: '0 auto 10px', opacity: 0.25, display: 'block' }} />
              <p style={{ fontSize: 13, marginBottom: 14 }}>No bills generated today</p>
              <button onClick={() => navigate('/new-bill')} className="btn-primary" style={{ fontSize: 12, padding: '8px 18px' }}>
                Create First Bill
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {todaysBills.map(bill => {
                const ps = PAY_STYLE[bill.paymentMode] || { bg: '#f9fafb', color: '#374151' };
                return (
                  <div key={bill.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 9, background: '#f9fafb',
                    border: '1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
                        {bill.customerName || 'Walk-in'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                        {bill.billNumber} · {new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                        background: ps.bg, color: ps.color,
                      }}>
                        {PAY_LABEL[bill.paymentMode] || bill.paymentMode}
                      </span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>
                        ₹{bill.total.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Payment breakdown */}
          {Object.keys(payBreakdown).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              {Object.entries(payBreakdown).map(([mode, amt]) => {
                const ps = PAY_STYLE[mode] || { bg: '#f9fafb', color: '#374151' };
                return (
                  <div key={mode} style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7,
                    background: ps.bg, color: ps.color,
                  }}>
                    {PAY_LABEL[mode] || mode}: ₹{Math.round(amt).toLocaleString('en-IN')}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Low Stock Alerts ────────────────────────────────────────────── */}
      {hasLowStock && (
        <div id="low-stock-section" style={{ marginTop: 14 }} className="card">
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 10, padding: '12px 16px', marginBottom: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} style={{ color: '#dc2626' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>
                Low Stock Alerts
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, background: '#dc2626', color: '#fff',
                padding: '1px 7px', borderRadius: 99,
              }}>
                {lowStockProducts.length}
              </span>
            </div>
            <button
              onClick={() => navigate('/inventory')}
              style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Restock →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {lowStockProducts.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 9, background: '#fff',
                border: '1px solid #fee2e2',
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Min. {p.minStockAlert} units</div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, marginLeft: 8, flexShrink: 0,
                  color: p.stockQty === 0 ? '#dc2626' : '#ea580c',
                }}>
                  {p.stockQty === 0 ? 'Out of stock' : `${p.stockQty} left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
