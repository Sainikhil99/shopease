import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useDebounce } from '../hooks/useDebounce';
import { Search, X, Eye, Printer, Download, Filter } from 'lucide-react';
import { printBill } from '../utils/printBill';

const PAYMENT_LABELS = { cash: 'Cash', upi: 'UPI', phonepe: 'PhonePe', googlepay: 'Google Pay', card: 'Card' };
const PAYMENT_COLORS = {
  cash: 'bg-green-100 text-green-700',
  upi: 'bg-blue-100 text-blue-700',
  phonepe: 'bg-purple-100 text-purple-700',
  googlepay: 'bg-orange-100 text-orange-700',
  card: 'bg-gray-100 text-gray-700',
};

function BillDetailModal({ bill, onClose }) {
  const { shop } = useApp();
  if (!bill) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{bill.billNumber}</h3>
            <p className="text-sm text-gray-500">{new Date(bill.createdAt).toLocaleString('en-IN')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
            <div><span className="text-gray-500">Customer</span><div className="font-medium">{bill.customerName}</div></div>
            {bill.customerPhone && <div><span className="text-gray-500">Phone</span><div className="font-medium">+91 {bill.customerPhone}</div></div>}
            <div><span className="text-gray-500">Payment</span><div className="font-medium capitalize">{PAYMENT_LABELS[bill.paymentMode] || bill.paymentMode}</div></div>
            <div><span className="text-gray-500">Status</span><div className="font-medium text-green-600 capitalize">{bill.status}</div></div>
          </div>

          <table className="w-full text-sm mb-4">
            <thead><tr className="border-b border-gray-100 text-xs text-gray-500">
              <th className="text-left pb-2">Product</th>
              <th className="text-right pb-2">MRP</th>
              <th className="text-right pb-2">Price</th>
              <th className="text-center pb-2">Qty</th>
              <th className="text-right pb-2">Total</th>
            </tr></thead>
            <tbody>
              {bill.items.map((item, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 text-gray-800">{item.productName}</td>
                  <td className="py-2 text-right text-gray-400">₹{item.mrp}</td>
                  <td className="py-2 text-right">₹{item.sellingPrice}</td>
                  <td className="py-2 text-center">{item.qty}</td>
                  <td className="py-2 text-right font-medium">₹{item.itemTotal.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{bill.subtotal.toLocaleString('en-IN')}</span></div>
            {bill.discountAmount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>−₹{bill.discountAmount.toLocaleString('en-IN')}</span></div>}
            <div className="flex justify-between text-gray-600"><span>GST</span><span>+₹{Math.round(bill.taxAmount || 0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2"><span>Total Paid</span><span>₹{bill.total.toLocaleString('en-IN')}</span></div>
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={() => printBill(bill, shop)} className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <Printer size={16} /> Print / PDF
            </button>
            <button onClick={onClose} className="btn-primary flex-1">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SalesHistory() {
  const { bills, shop } = useApp();
  const [query, setQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all | today | week | month
  const [selectedBill, setSelectedBill] = useState(null);

  const debouncedQuery = useDebounce(query, 200);

  const filtered = useMemo(() => {
    const now = new Date();
    return bills.filter(b => {
      const matchesQuery = !debouncedQuery || b.customerName.toLowerCase().includes(debouncedQuery.toLowerCase()) || b.billNumber.toLowerCase().includes(debouncedQuery.toLowerCase());
      const matchesPayment = paymentFilter === 'all' || b.paymentMode === paymentFilter;
      const billDate = new Date(b.createdAt);
      const matchesDate =
        dateFilter === 'all' ? true :
        dateFilter === 'today' ? billDate.toDateString() === now.toDateString() :
        dateFilter === 'week' ? (now - billDate) < 7 * 24 * 60 * 60 * 1000 :
        dateFilter === 'month' ? billDate.getMonth() === now.getMonth() && billDate.getFullYear() === now.getFullYear() : true;
      return matchesQuery && matchesPayment && matchesDate;
    });
  }, [bills, debouncedQuery, paymentFilter, dateFilter]);

  const totalRevenue = useMemo(() => filtered.reduce((s, b) => s + b.total, 0), [filtered]);

  const exportCSV = () => {
    // Wrap every field in double-quotes and escape internal quotes.
    // This prevents commas inside values (dates, names, etc.) from
    // splitting into extra columns in Excel / Google Sheets.
    const esc = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const headers = [
      'Bill Number', 'Date', 'Time', 'Customer', 'Phone',
      'Payment Mode', 'Subtotal (Rs)', 'Discount (Rs)', 'GST %', 'GST (Rs)', 'Total (Rs)', 'Items',
    ];

    const dataRows = filtered.map(b => {
      const d = new Date(b.createdAt);
      // Separate date and time so no comma appears inside a single field
      const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      return [
        b.billNumber,
        date,
        time,
        b.customerName,
        b.customerPhone || '',
        PAYMENT_LABELS[b.paymentMode] || b.paymentMode,
        b.subtotal || 0,
        b.discountAmount || 0,
        (b.gstRate ?? 0) + '%',
        Math.round(b.taxAmount || 0),
        b.total,
        b.items?.length || 0,
      ].map(esc).join(',');
    });

    // UTF-8 BOM (﻿) makes Excel open the file with correct encoding
    // so the Rs symbol and Indian names display properly
    const csv = '﻿' + [headers.map(esc).join(','), ...dataRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const today = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
    a.href = url; a.download = `shopease-sales-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales History</h2>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} bills · Total ₹{totalRevenue.toLocaleString('en-IN')}</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by customer name or bill number..." className="input-field pl-10" />
          {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
        </div>
        <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="input-field w-auto">
          <option value="all">All Payments</option>
          {Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {[['all', 'All'], ['today', 'Today'], ['week', 'Week'], ['month', 'Month']].map(([v, l]) => (
            <button key={v} onClick={() => setDateFilter(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${dateFilter === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Bills Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Bill No.', 'Date & Time', 'Customer', 'Items', 'Discount', 'GST', 'Total', 'Payment', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(bill => (
                <tr key={bill.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{bill.billNumber}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    <div>{new Date(bill.createdAt).toLocaleDateString('en-IN')}</div>
                    <div className="text-xs">{new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{bill.customerName}</div>
                    {bill.customerPhone && <div className="text-xs text-gray-400">+91 {bill.customerPhone}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{bill.items.length} items</td>
                  <td className="px-4 py-3 text-green-700">{(bill.discountAmount || 0) > 0 ? `−₹${(bill.discountAmount).toLocaleString('en-IN')}` : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">₹{Math.round(bill.taxAmount || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 font-bold text-gray-900">₹{bill.total.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PAYMENT_COLORS[bill.paymentMode] || 'bg-gray-100 text-gray-700'}`}>
                      {PAYMENT_LABELS[bill.paymentMode] || bill.paymentMode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setSelectedBill(bill)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => printBill(bill, shop)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg" title="Print / PDF">
                        <Printer size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  <Filter size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No bills found for selected filters</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBill && <BillDetailModal bill={selectedBill} onClose={() => setSelectedBill(null)} />}
    </div>
  );
}
