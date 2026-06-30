import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Save, Store, Mail, Bell, Shield, Check } from 'lucide-react';

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card mb-4">
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
          <Icon size={16} className="text-blue-600" />
        </div>
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { shop, updateShop } = useApp();
  const [form, setForm] = useState({ ...shop });
  const [saved, setSaved] = useState(false);

  // Sync form when shop changes (e.g. after login/account switch)
  useEffect(() => { setForm({ ...shop }); }, [shop?.id]);

  const handleSave = (e) => {
    e.preventDefault();
    updateShop(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const Field = ({ label, name, type = 'text', placeholder, sub, disabled }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[name] || ''}
        onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
        placeholder={placeholder}
        disabled={disabled}
        className="input-field disabled:bg-gray-50 disabled:text-gray-400"
      />
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );

  const Toggle = ({ label, name, sub }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
      <button
        type="button"
        onClick={() => setForm(p => ({ ...p, [name]: !p[name] }))}
        className={`relative w-11 h-6 rounded-full transition-colors ${form[name] ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form[name] ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-500 text-sm mt-0.5">Manage your shop configuration</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg text-sm font-medium">
            <Check size={16} /> Settings saved!
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-0">
        {/* Shop Info */}
        <Section title="Shop Information" icon={Store}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Shop Name" name="shopName" placeholder="Ravi's Clothing Store" />
              <Field label="Owner Name" name="ownerName" placeholder="Ravi Kumar" />
            </div>
            <Field label="Shop Address" name="address" placeholder="12, MG Road, Bangalore, Karnataka" sub="Printed on every bill" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="GSTIN" name="gstin" placeholder="29ABCDE1234F1ZS" sub="GST registration number" />
              <Field label="Phone Number" name="phone" placeholder="+91 98000 00000" />
            </div>
            <Field label="Login Email" name="email" type="email" placeholder="ravi@yourshop.com" disabled sub="Contact support to change login credentials" />
          </div>
        </Section>

        {/* Email Reports */}
        <Section title="Email Reports" icon={Mail}>
          <div className="space-y-4">
            <Field
              label="Report Email Address"
              name="reportEmail"
              type="email"
              placeholder="ravi@yourshop.com"
              sub="Reports will be sent to this address. Can be different from login email."
            />

            <div className="divide-y divide-gray-100">
              <Toggle label="Daily Sales Report" name="dailyReport" sub="Sent every night with today's summary" />
              {form.dailyReport && (
                <div className="py-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Daily Report Send Time</label>
                  <input
                    type="time"
                    value={form.dailyTime || '21:00'}
                    onChange={e => setForm(p => ({ ...p, dailyTime: e.target.value }))}
                    className="input-field w-auto"
                  />
                  <p className="text-xs text-gray-400 mt-1">Default: 9:00 PM</p>
                </div>
              )}
              <Toggle label="Monthly Report" name="monthlyReport" sub="Sent on the 1st of every month at 8:00 AM" />
              <Toggle label="Attach PDF to Monthly Report" name="pdfAttachment" sub="Full PDF report attached to monthly email" />
            </div>
          </div>
        </Section>

        {/* Stock Alerts */}
        <Section title="Stock Alerts" icon={Bell}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert Threshold</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={form.lowStockLimit || 5}
                min={1}
                max={100}
                onChange={e => setForm(p => ({ ...p, lowStockLimit: parseInt(e.target.value) }))}
                className="input-field w-24"
              />
              <span className="text-sm text-gray-500">units</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Products with stock below this number will show a red alert on the dashboard and in daily reports. Default: 5 units.</p>
          </div>
        </Section>

        {/* Security */}
        <Section title="Security & Session" icon={Shield}>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <div>
                <div className="font-medium text-gray-700">Session Duration</div>
                <div className="text-xs text-gray-400">You stay logged in for 8 hours without re-entering OTP</div>
              </div>
              <span className="font-semibold text-gray-800">8 hours</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <div>
                <div className="font-medium text-gray-700">Authentication Method</div>
                <div className="text-xs text-gray-400">Mobile OTP (primary) or email + password</div>
              </div>
              <span className="font-semibold text-gray-800">OTP / Email</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <div>
                <div className="font-medium text-gray-700">Data Backup</div>
                <div className="text-xs text-gray-400">PostgreSQL backed up daily to AWS S3</div>
              </div>
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Daily</span>
            </div>
          </div>
        </Section>

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
          <Save size={18} /> Save Settings
        </button>
      </form>
    </div>
  );
}
