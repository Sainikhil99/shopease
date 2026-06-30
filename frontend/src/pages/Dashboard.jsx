import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  TrendingUp, ShoppingCart, IndianRupee, Package,
  AlertTriangle, Plus, History, BarChart2, Tag, ArrowRight
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-2">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { shop, todaysSales, todaysProfit, todaysBills, lowStockProducts, products } = useApp();
  const navigate = useNavigate();

  const paymentBreakdown = todaysBills.reduce((acc, b) => {
    acc[b.paymentMode] = (acc[b.paymentMode] || 0) + b.total;
    return acc;
  }, {});

  const paymentLabels = { cash: 'Cash', upi: 'UPI', phonepe: 'PhonePe', googlepay: 'Google Pay', card: 'Card' };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{shop?.shopName || 'Dashboard'}</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/new-bill')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> New Bill
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={IndianRupee} label="Today's Revenue" value={`₹${Math.round(todaysSales).toLocaleString('en-IN')}`} color="bg-blue-500" sub="Excl. GST collected" />
        <StatCard icon={TrendingUp} label="Today's Profit" value={`₹${Math.round(todaysProfit).toLocaleString('en-IN')}`} color="bg-green-500" sub="Estimated" />
        <StatCard icon={ShoppingCart} label="Bills Today" value={todaysBills.length} color="bg-purple-500" sub="Transactions" />
        <StatCard icon={Package} label="Total Products" value={products.filter(p => p.isActive).length} color="bg-orange-500" sub={`${lowStockProducts.length} low stock`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { icon: Plus, label: 'New Bill', sub: 'Start billing a customer', to: '/new-bill', color: 'text-blue-600 bg-blue-50' },
              { icon: Package, label: 'View Products', sub: 'Manage your catalogue', to: '/products', color: 'text-green-600 bg-green-50' },
              { icon: History, label: 'Sales History', sub: 'View past bills', to: '/sales-history', color: 'text-purple-600 bg-purple-50' },
              { icon: BarChart2, label: 'Reports', sub: 'View analytics', to: '/reports', color: 'text-orange-600 bg-orange-50' },
              { icon: Tag, label: 'Coupons', sub: 'Manage offers', to: '/coupons', color: 'text-pink-600 bg-pink-50' },
            ].map(({ icon: Icon, label, sub, to, color }) => (
              <button key={to} onClick={() => navigate(to)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left transition-colors group">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">{label}</div>
                  <div className="text-xs text-gray-400">{sub}</div>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* Today's Bills */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Today's Bills</h3>
            <button onClick={() => navigate('/sales-history')} className="text-blue-600 text-sm hover:underline">View all</button>
          </div>
          {todaysBills.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No bills generated today</p>
              <button onClick={() => navigate('/new-bill')} className="mt-3 btn-primary text-sm py-2">Create First Bill</button>
            </div>
          ) : (
            <div className="space-y-2">
              {todaysBills.map(bill => (
                <div key={bill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{bill.customerName}</div>
                    <div className="text-xs text-gray-400">{bill.billNumber} · {new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">₹{bill.total.toLocaleString('en-IN')}</div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      bill.paymentMode === 'cash' ? 'bg-green-100 text-green-700' :
                      bill.paymentMode === 'upi' ? 'bg-blue-100 text-blue-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {paymentLabels[bill.paymentMode] || bill.paymentMode}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div className="mt-4 card border-red-100 bg-red-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-600" />
            <h3 className="font-semibold text-red-800">Low Stock Alerts</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStockProducts.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-100">
                <div>
                  <div className="text-sm font-medium text-gray-800">{p.name}</div>
                  <div className="text-xs text-gray-500">Min. {p.minStockAlert} units</div>
                </div>
                <span className={`text-sm font-bold ${p.stockQty === 0 ? 'text-red-700' : 'text-orange-600'}`}>
                  {p.stockQty === 0 ? 'Out of stock' : `${p.stockQty} left`}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/products')} className="mt-3 text-sm text-red-700 font-medium hover:underline flex items-center gap-1">
            Manage Products <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Payment Breakdown */}
      {todaysBills.length > 0 && (
        <div className="mt-4 card">
          <h3 className="font-semibold text-gray-800 mb-3">Today's Payment Breakdown</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(paymentBreakdown).map(([mode, amount]) => (
              <div key={mode} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-600 capitalize">{paymentLabels[mode] || mode}:</span>
                <span className="text-sm font-bold text-gray-900">₹{amount.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
