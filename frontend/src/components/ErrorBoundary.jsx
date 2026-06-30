import { Component } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log for debugging — in production this would go to an error tracking service
    console.error('[ShopEase] Unhandled render error:', error, errorInfo?.componentStack);
  }

  handleReload = () => window.location.reload();
  handleHome = () => { window.location.href = '/dashboard'; };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            An unexpected error occurred. Your billing data is safe in local storage.
            Reload the page to continue working.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleHome}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Home size={15} /> Dashboard
            </button>
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <RefreshCcw size={15} /> Reload App
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-5 text-left">
              <summary className="text-xs text-gray-400 cursor-pointer select-none">Developer info</summary>
              <pre className="mt-2 text-xs bg-red-50 border border-red-100 p-3 rounded-lg overflow-auto text-red-700 max-h-40">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
