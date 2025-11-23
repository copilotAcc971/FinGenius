import { queryClient } from "@/shared/lib/api/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { ErrorBoundary } from "./ErrorBoundary";
import SimplifiedApp from "./SimplifiedApp";

console.log('[App] Starting App component...');

function App() {
  console.log('[App] Rendering App component...');
  
  try {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <SimplifiedApp />
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