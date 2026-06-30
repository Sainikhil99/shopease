import { useApp } from '../context/AppContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, IndianRupee, ShoppingCart, Package, RotateCcw } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const PAYMENT_LABELS = { cash: 'Cash', upi: 'UPI', phonepe: 'PhonePe', googlepay: 'Google Pay', card: 'Card' };

export default function Reports() {
  const { bills, returns } = useApp();

  // ── Returns impact ────────────────────────────────────────────────────────
  const totalRefunded    = returns.reduce((s, r) => s + r.refundAmount, 0);
  const totalCOGSReturned = returns.reduce((s, r) =>
    s + r.items.reduce((is, item) => is + (item.costPrice || 0) * (item.returnQty || item.qty || 0), 0), 0);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalBilled       = bills.reduce((s, b) => s + b.total, 0);
  const totalGSTCollected = bills.reduce((s, b) => s + (b.taxAmount || 0), 0);
  const grossRevenue      = totalBilled - totalGSTCollected;          // before returns
  const netRevenue        = grossRevenue - totalRefunded;             // after returns
  const grossCOGS         = bills.reduce((s, b) =>
    s + b.items.reduce((is, item) => is + (item.costPrice || 0) * item.qty, 0), 0);
  const netCOGS           = grossCOGS - totalCOGSReturned;           // returned stock back in shop
  const netProfit         = netRevenue - netCOGS;
  const totalBills        = bills.length;
  const avgBillValue      = totalBills > 0 ? totalBilled / totalBills : 0;

  // ── 7-day chart — net of returns on each day ──────────────────────────────
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label      = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
    const dayStr     = d.toDateString();
    const dayBills   = bills.filter(b => new Date(b.createdAt).toDateString() === dayStr);
    const dayReturns = returns.filter(r => new Date(r.returnedAt).toDateString() === dayStr);

    const revenue    = dayBills.reduce((s, b) => s + (b.total - (b.taxAmount || 0)), 0);
    const refunded   = dayReturns.reduce((s, r) => s + r.refundAmount, 0);
    const cogsDay    = dayBills.reduce((s, b) =>
      s + b.items.reduce((is, item) => is + (item.costPrice || 0) * item.qty, 0), 0);
    const cogsBack   = dayReturns.reduce((s, r) =>
      s + r.items.reduce((is, item) => is + (item.costPrice || 0) * (item.returnQty || item.qty || 0), 0), 0);

    return {
      day:     label,
      revenue: Math.round(revenue - refunded),
      profit:  Math.round((revenue - refunded) - (cogsDay - cogsBack)),
      returns: Math.round(refunded),
      bills:   dayBills.length,
    };
  });

  // ── Payment mode breakdown ─────────────────────────────────────────────────
  const paymentData = bills.reduce((acc, b) => {
    const key = b.paymentMode;
    const existing = acc.find(a => a.name === key);
    if (existing) existing.value += b.total;
    else acc.push({ name: PAYMENT_LABELS[key] || key, value: b.total });
    return acc;
  }, []);

  // ── Top products (net of returned qty) ────────────────────────────────────
  const productSales = {};
  bills.forEach(b => b.items.forEach(item => {
    if (!productSales[item.productName]) productSales[item.productName] = { qty: 0, revenue: 0 };
    productSales[item.productName].qty += item.qty;
    productSales[item.productName].revenue += item.itemTotal;
  }));
  returns.forEach(r => r.items.forEach(item => {
    if (productSales[item.productName]) {
      productSales[item.productName].qty -= (item.returnQty || item.qty || 0);
    }
  }));
  const topProducts = Object.entries(productSales)
    .filter(([, d]) => d.qty > 0)
    .map(([name, data]) => ({ name: name.length > 18 ? name.slice(0, 18) + '...' : name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const formatINR = (v) => `₹${Math.round(v).toLocaleString('en-IN')}`;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
        <p className="text-gray-500 text-sm mt-0.5">All figures are net — returns & refunds already deducted</p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
        {[
          { icon: IndianRupee, label: 'Total Billed',   value: formatINR(totalBilled),     color: 'bg-gray-600',   sub: 'Collected from customers' },
          { icon: Package,     label: 'GST (to Govt)',  value: formatINR(totalGSTCollected),color: 'bg-orange-500', sub: 'Not your income' },
          { icon: RotateCcw,   label: 'Returns',        value: formatINR(totalRefunded),    color: 'bg-red-500',    sub: `${returns.length} return${returns.length !== 1 ? 's' : ''}` },
          { icon: ShoppingCart,label: 'Net Cost',       value: formatINR(netCOGS),          color: 'bg-red-400',    sub: 'After returned stock' },
          { icon: TrendingUp,  label: 'Net Profit',     value: formatINR(netProfit),        color: 'bg-green-500',  sub: 'After returns & cost' },
        ].map(({ icon: Icon, label, value, color, sub }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">{label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={15} className="text-white" />
              </div>
            </div>
            <div className="text-xl font-bold text-gray-900 mt-2">{value}</div>
            {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Full money chain ── */}
      <div className="mb-5 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-gray-800">{formatINR(totalBilled)}</span>
        <span className="text-gray-400 text-xs">Billed</span>
        <span className="text-gray-400">−</span>
        <span className="font-semibold text-orange-600">{formatINR(totalGSTCollected)}</span>
        <span className="text-gray-400 text-xs">GST</span>
        <span className="text-gray-400">−</span>
        <span className="font-semibold text-red-500">{formatINR(totalRefunded)}</span>
        <span className="text-gray-400 text-xs">Returns</span>
        <span className="text-gray-400">=</span>
        <span className="font-semibold text-blue-700">{formatINR(netRevenue)}</span>
        <span className="text-gray-400 text-xs">Net Revenue</span>
        <span className="text-gray-400">−</span>
        <span className="font-semibold text-red-400">{formatINR(netCOGS)}</span>
        <span className="text-gray-400 text-xs">Net Cost</span>
        <span className="text-gray-400">=</span>
        <span className="font-bold text-green-700 text-base">{formatINR(netProfit)}</span>
        <span className="text-gray-400 text-xs">Profit</span>
        <span className="ml-auto text-xs text-gray-400">
          {totalBills} bill{totalBills !== 1 ? 's' : ''} · {returns.length} return{returns.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Revenue & Profit - 7 day bar chart */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Revenue & Profit (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last7Days} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
              <Tooltip formatter={(v, n) => [formatINR(v), n === 'Revenue' ? 'Net Revenue' : 'Net Profit']} />
              <Legend />
              <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[4,4,0,0]} />
              <Bar dataKey="profit" fill="#10b981" name="Profit" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bills per day - line chart */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Bills Generated (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={last7Days} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={v => [v, 'Bills']} />
              <Line type="monotone" dataKey="bills" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4, fill: '#8b5cf6' }} name="Bills" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Top 5 Products (by Quantity)</h3>
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={v => [`${v} units`, 'Units Sold']} />
                <Bar dataKey="qty" fill="#3b82f6" radius={[0,4,4,0]} name="Units Sold" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No sales data yet</div>
          )}
        </div>

        {/* Payment Mode Pie */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Payment Mode Breakdown</h3>
          {paymentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={paymentData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`₹${v.toLocaleString('en-IN')}`, `${n} — Amount Collected`]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No payment data yet</div>
          )}
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {paymentData.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-1 text-xs text-gray-600">
                <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {entry.name}: ₹{entry.value.toLocaleString('en-IN')}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Returns history ── */}
      {returns.length > 0 && (
        <div className="card mt-4 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <RotateCcw size={16} className="text-red-500" />
            <h3 className="font-semibold text-gray-800">Returns & Refunds</h3>
            <span className="ml-auto text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
              Total refunded: {formatINR(totalRefunded)}
            </span>
          </div>
          <div className="space-y-2">
            {returns.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <div className="text-sm font-semibold text-gray-800">{r.returnNumber}</div>
                  <div className="text-xs text-gray-500">
                    {r.customerName} · {r.originalBillNumber} · {new Date(r.returnedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                  {r.reason && <div className="text-xs text-gray-400 mt-0.5">Reason: {r.reason}</div>}
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-red-600">−₹{r.refundAmount.toLocaleString('en-IN')}</div>
                  <div className="text-xs text-gray-400">{r.items.length} item{r.items.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GST Summary */}
      <div className="card mt-4">
        <h3 className="font-semibold text-gray-800 mb-1">GST Summary (for GST Filing)</h3>
        <p className="text-xs text-gray-400 mb-4">Based on GST rate selected per bill</p>
        {(() => {
          // For bills missing gstRate (created before the fix), infer from taxAmount/subtotal ratio
          const inferRate = (b) => {
            if (b.gstRate !== undefined) return b.gstRate;
            if (!b.taxAmount || !b.subtotal) return 0;
            const pct = (b.taxAmount / b.subtotal) * 100;
            return [0, 5, 12, 18, 28].reduce((best, r) => Math.abs(r - pct) < Math.abs(best - pct) ? r : best, 0);
          };
          const rateRows = [0, 5, 12, 18, 28].map(rate => {
            const matchingBills = bills.filter(b => inferRate(b) === rate);
            const collected     = matchingBills.reduce((s, b) => s + (b.taxAmount || 0), 0);
            const billCount     = matchingBills.length;
            return { rate, collected, billCount };
          });
          const hasAnyData = rateRows.some(r => r.rate > 0 && r.collected > 0);
          if (!hasAnyData) {
            return (
              <p className="text-sm text-gray-400 py-4 text-center">
                No bills with GST recorded yet. Select a GST rate when creating a bill.
              </p>
            );
          }
          return (
            <div className="space-y-3">
              {rateRows.map(({ rate, collected, billCount }) => {
                if (billCount === 0 || (rate === 0 && collected === 0)) return null;
                return (
                  <div key={rate} className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 ${
                    rate === 0 ? 'bg-gray-50 border-gray-100' : 'bg-blue-50 border-blue-100'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                        rate === 0 ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 text-white'
                      }`}>
                        {rate}%
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">
                          {rate === 0 ? 'No GST (0%)' : `GST @ ${rate}%`}
                        </p>
                        <p className="text-xs text-gray-400">{billCount} bill{billCount > 1 ? 's' : ''} · taxable sales</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black ${rate === 0 ? 'text-gray-500' : 'text-blue-700'}`}>
                        ₹{Math.round(collected).toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-gray-400">collected</p>
                    </div>
                  </div>
                );
              }).filter(Boolean)}

              {/* Total GST row */}
              {rateRows.some(r => r.rate > 0 && r.billCount > 0) && (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-orange-50 border-2 border-orange-200 mt-1">
                  <p className="font-bold text-orange-800">Total GST to Pay Govt.</p>
                  <p className="text-xl font-black text-orange-700">
                    ₹{Math.round(rateRows.reduce((s, r) => s + r.collected, 0)).toLocaleString('en-IN')}
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
