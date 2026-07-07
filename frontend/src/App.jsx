import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// ── Lazy-loaded pages — each split into its own JS chunk ─────────────────────
// This cuts the initial bundle from ~1 MB to ~150 KB so the login screen
// appears almost instantly, even on a slow mobile connection.
const Login         = lazy(() => import('./pages/Login'));
const Register      = lazy(() => import('./pages/Register'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const NewBill       = lazy(() => import('./pages/NewBill'));
const Products      = lazy(() => import('./pages/Products'));
const SalesHistory  = lazy(() => import('./pages/SalesHistory'));
const Reports       = lazy(() => import('./pages/Reports'));
const Coupons       = lazy(() => import('./pages/Coupons'));
const Returns       = lazy(() => import('./pages/Returns'));
const Expenses      = lazy(() => import('./pages/Expenses'));
const Inventory     = lazy(() => import('./pages/Inventory'));
const Settings      = lazy(() => import('./pages/Settings'));
const AdminLogin    = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));

// ── Page loading skeleton ─────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[60vh]">
      <div style={{ width: 34, height: 34, border: '3px solid #dcfce7', borderTopColor: '#16a34a', borderRadius: '50%' }} className="animate-spin" />
      <p className="text-sm text-gray-400 font-medium">Loading…</p>
    </div>
  );
}

// ── Route guards ──────────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { isLoggedIn } = useApp();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AdminRoute({ children }) {
  const { isAdmin } = useApp();
  if (!isAdmin) return <Navigate to="/admin" replace />;
  return children;
}

// ── Route tree ────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { isLoggedIn, isAdmin } = useApp();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/login"    element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/register" element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Register />} />

        {/* Protected shop routes */}
        <Route path="/dashboard"    element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/new-bill"     element={<ProtectedRoute><NewBill /></ProtectedRoute>} />
        <Route path="/products"     element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/sales-history" element={<ProtectedRoute><SalesHistory /></ProtectedRoute>} />
        <Route path="/reports"      element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/coupons"      element={<ProtectedRoute><Coupons /></ProtectedRoute>} />
        <Route path="/returns"      element={<ProtectedRoute><Returns /></ProtectedRoute>} />
        <Route path="/expenses"     element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
        <Route path="/inventory"    element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        <Route path="/settings"     element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/admin"           element={isAdmin ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to={isLoggedIn ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </Suspense>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
