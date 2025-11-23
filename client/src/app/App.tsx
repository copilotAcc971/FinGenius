import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { TenantProvider } from "@/shared/contexts/TenantContext";
import { RBACProvider } from "@/shared/contexts/rbac-context";
import SimplifiedApp from "./SimplifiedApp";

console.log('[App] Starting App component...');

// Create a custom query client without the tenant dependency for initial render
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Use a custom default query function that handles auth/tenant gracefully
      queryFn: async ({ queryKey }) => {
        const url = Array.isArray(queryKey) ? queryKey.join("/") : queryKey;
        
        try {
          const response = await fetch(url as string, {
            credentials: "include",
            headers: {
              // Only add tenant header if available from localStorage
              ...(localStorage.getItem('current-tenant-id') 
                ? { 'x-tenant-id': localStorage.getItem('current-tenant-id')! }
                : {}),
            },
          });
          
          if (!response.ok) {
            if (response.status === 401) {
              // Return null for unauthorized - let the app handle it
              return null;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          return response.json();
        } catch (error) {
          console.error('[App] Query error:', error);
          throw error;
        }
      },
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  console.log('[App] Rendering App component...');
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TenantProvider>
          <RBACProvider>
            <SimplifiedApp />
          </RBACProvider>
        </TenantProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

console.log('[App] App component module loaded');