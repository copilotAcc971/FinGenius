import { Suspense, lazy, useEffect, useState } from 'react';
import { Switch, Route, useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/shared/components/ui/sidebar";
import { PageSkeleton } from "@/shared/components/layout/page-skeleton";
import { useAuth } from "@/shared/hooks/useAuth";
import { useTenant, TenantProvider } from "@/shared/contexts/TenantContext";
import { RBACProvider } from "@/shared/contexts/rbac-context";
import { Toaster } from "@/shared/components/ui/toaster";

// Simplified loading component
const Loading = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="text-center">
      <div className="mb-4 text-2xl">⏳</div>
      <div>Loading...</div>
    </div>
  </div>
);

// Basic error fallback
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

// Minimal Dashboard component
const MinimalDashboard = () => {
  const { user } = useAuth();
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

// Lazy load only critical pages
const Dashboard = lazy(() => import("@/features/dashboard/pages/dashboard-page").catch(() => ({
  default: MinimalDashboard
})));

const TenantSelect = lazy(() => import("@/features/auth/pages/tenant-select").catch(() => ({
  default: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Select Organization</h1>
        <p className="mb-4">Loading organizations...</p>
      </div>
    </div>
  )
})));

const Landing = lazy(() => import("@/features/auth/pages/landing-page").catch(() => ({
  default: () => (
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
  )
})));

// Minimal sidebar
const MinimalSidebar = () => (
  <div className="w-64 border-r bg-white">
    <div className="p-4">
      <h2 className="font-semibold mb-4">Navigation</h2>
      <nav className="space-y-2">
        <a href="/" className="block p-2 hover:bg-gray-100 rounded">Dashboard</a>
        <a href="/income" className="block p-2 hover:bg-gray-100 rounded">Income</a>
        <a href="/expenses" className="block p-2 hover:bg-gray-100 rounded">Expenses</a>
        <a href="/settings" className="block p-2 hover:bg-gray-100 rounded">Settings</a>
      </nav>
    </div>
  </div>
);

function ProtectedLayout() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { currentTenant } = useTenant();
  const [mounted, setMounted] = useState(false);
  const [, location] = useLocation();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Loading />;
  }

  if (authLoading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<Loading />}>
        <Landing />
      </Suspense>
    );
  }

  // Allow access to tenant-select page without a tenant
  const isTenantSelectPage = location === "/tenant-select";
  
  // If authenticated but no tenant selected and not on tenant-select page, redirect there
  if (!currentTenant && !isTenantSelectPage) {
    return (
      <Suspense fallback={<Loading />}>
        <TenantSelect />
      </Suspense>
    );
  }

  // For tenant-select page, render without the sidebar layout
  if (isTenantSelectPage) {
    return (
      <Suspense fallback={<Loading />}>
        <TenantSelect />
      </Suspense>
    );
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background">
        <MinimalSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-2 border-b">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <span className="font-semibold">Copilot Accountant</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 text-sm border rounded">
                Settings
              </button>
              <button 
                onClick={() => window.location.href = '/api/logout'}
                className="px-3 py-1 text-sm bg-black text-white rounded"
              >
                Logout
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Suspense fallback={<Loading />}>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/tenant-select" component={TenantSelect} />
                <Route component={MinimalDashboard} />
              </Switch>
            </Suspense>
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}

export default function SimplifiedApp() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[SimplifiedApp] Error:', event.error);
      setError(event.error);
    };
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[SimplifiedApp] Unhandled rejection:', event.reason);
      setError(new Error(event.reason));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (error) {
    return <ErrorFallback error={error} />;
  }

  return (
    <TenantProvider>
      <RBACProvider>
        <ProtectedLayout />
      </RBACProvider>
    </TenantProvider>
  );
}