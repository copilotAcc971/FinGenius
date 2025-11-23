import { Suspense, lazy, useEffect, useState } from 'react';
import { Switch, Route, useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/shared/components/ui/sidebar";
import { Toaster } from "@/shared/components/ui/toaster";

console.log('[FixedApp] Module loading...');

// Simple loading component
const Loading = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="text-center">
      <div className="mb-4 text-2xl">⏳</div>
      <div>Loading...</div>
    </div>
  </div>
);

// Error boundary component
const ErrorFallback = ({ error }: { error?: Error }) => (
  <div className="flex h-screen items-center justify-center">
    <div className="text-center max-w-md">
      <div className="mb-4 text-2xl">⚠️</div>
      <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
      <p className="text-gray-600 mb-4">The application encountered an error.</p>
      {error && (
        <pre className="text-left text-xs bg-gray-100 p-2 rounded overflow-auto">
          {error.message}
        </pre>
      )}
      <button 
        onClick={() => window.location.reload()} 
        className="mt-4 px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
      >
        Reload Page
      </button>
    </div>
  </div>
);

// Simple auth hook that doesn't depend on query client
function useSimpleAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth status directly without using React Query
    fetch('/api/auth/user', {
      credentials: 'include'
    })
      .then(res => {
        if (res.ok) {
          return res.json();
        }
        throw new Error('Not authenticated');
      })
      .then(data => {
        setUser(data);
        setIsAuthenticated(true);
        setLoading(false);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setLoading(false);
      });
  }, []);

  return { isAuthenticated, user, loading };
}

// Simple Dashboard component
const MinimalDashboard = () => {
  const { user } = useSimpleAuth();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Welcome to Copilot Accountant</h1>
      <p className="mb-4">Logged in as: {user?.email || 'Unknown'}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">Quick Actions</h2>
          <ul className="space-y-1 text-sm">
            <li>• Create Invoice</li>
            <li>• Add Customer</li>
            <li>• View Reports</li>
          </ul>
        </div>
        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">Recent Activity</h2>
          <p className="text-sm text-gray-600">No recent activity</p>
        </div>
        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">Pending Tasks</h2>
          <p className="text-sm text-gray-600">No pending tasks</p>
        </div>
      </div>
    </div>
  );
};

// Simple Landing page
const SimpleLanding = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="text-center">
      <h1 className="text-3xl font-bold mb-4">Copilot Accountant</h1>
      <p className="mb-4">AI-Powered Accounting Platform</p>
      <a 
        href="/api/login" 
        className="inline-block px-6 py-2 bg-black text-white rounded hover:bg-gray-800"
      >
        Sign In with Replit
      </a>
    </div>
  </div>
);

// Lazy load pages
const Dashboard = lazy(() => 
  import("@/features/dashboard/pages/dashboard-page")
    .catch(() => ({ default: MinimalDashboard }))
);

const Landing = lazy(() => 
  import("@/features/auth/pages/landing-page")
    .catch(() => ({ default: SimpleLanding }))
);

// Main App Component
export default function FixedApp() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, loading } = useSimpleAuth();

  useEffect(() => {
    console.log('[FixedApp] Component mounted');
    setMounted(true);
  }, []);

  if (!mounted) {
    console.log('[FixedApp] Not mounted yet');
    return <Loading />;
  }

  if (loading) {
    console.log('[FixedApp] Auth loading');
    return <Loading />;
  }

  console.log('[FixedApp] Auth status:', isAuthenticated);

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<Loading />}>
        <Landing />
      </Suspense>
    );
  }

  // Authenticated view
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full bg-background">
          <div className="w-64 border-r bg-white">
            <div className="p-4">
              <h2 className="font-semibold mb-4">Navigation</h2>
              <nav className="space-y-2">
                <a href="/" className="block p-2 hover:bg-gray-100 rounded">Dashboard</a>
                <a href="/settings" className="block p-2 hover:bg-gray-100 rounded">Settings</a>
              </nav>
            </div>
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between p-2 border-b">
              <div className="flex items-center gap-2">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <span className="font-semibold">Copilot Accountant</span>
              </div>
              <button 
                onClick={() => window.location.href = '/api/logout'}
                className="px-3 py-1 text-sm bg-black text-white rounded"
              >
                Logout
              </button>
            </header>
            <main className="flex-1 overflow-auto">
              <Suspense fallback={<Loading />}>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route component={MinimalDashboard} />
                </Switch>
              </Suspense>
            </main>
          </div>
        </div>
      </SidebarProvider>
      <Toaster />
    </>
  );
}

console.log('[FixedApp] Module loaded');