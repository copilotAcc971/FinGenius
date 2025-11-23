import { Suspense, lazy } from 'react';
import { Switch, Route } from "wouter";
import { queryClient } from "@/shared/lib/api/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/shared/components/ui/toaster";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { ErrorBoundary } from "./ErrorBoundary";

console.log('[App] Starting App component...');

// Simple loading fallback
const LoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    height: '100vh', 
    fontFamily: 'Inter, system-ui, sans-serif' 
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
      <div>Loading...</div>
    </div>
  </div>
);

// Lazy load the main application
const MainApp = lazy(() => {
  console.log('[App] Loading MainApp component...');
  return import('./MainApp').catch(error => {
    console.error('[App] Failed to load MainApp:', error);
    // Return a fallback component if MainApp fails to load
    return {
      default: () => (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h1>Welcome to Copilot Accountant</h1>
          <p>The application is initializing. Please wait...</p>
          <p style={{ color: 'red', marginTop: '20px' }}>
            Error loading main application: {error?.message || 'Unknown error'}
          </p>
        </div>
      )
    };
  });
});

function App() {
  console.log('[App] Rendering App component...');
  
  try {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Suspense fallback={<LoadingFallback />}>
              <MainApp />
            </Suspense>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('[App] Error in App render:', error);
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <h1>Application Error</h1>
        <p>Failed to initialize the application. Please refresh the page.</p>
        <pre>{error?.toString()}</pre>
      </div>
    );
  }
}

export default App;

console.log('[App] App component module loaded');