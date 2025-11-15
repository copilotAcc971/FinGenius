import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { tenantSession } from "@/lib/tenantSession";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tenant } from "@shared/schema";

export function GlobalTenantEvents() {
  const { currentTenant } = useTenant();
  const reactQueryClient = useQueryClient();
  const { toast } = useToast();

  // Reset all tenant-scoped caches on tenant change
  useEffect(() => {
    if (currentTenant?.id) {
      console.log("[GlobalTenantEvents] Tenant ID changed, resetting tenant-scoped queries");
      
      // Tenant changed or initialized - reset tenant-scoped queries
      reactQueryClient.resetQueries({ 
        predicate: (query) => {
          // Reset queries that have tenantId in their key
          const key = query.queryKey;
          return Array.isArray(key) && (
            key[0] === '/api/approvals/pending' ||
            key[0] === '/api/journal-entries' ||
            // Add other tenant-scoped query keys as needed
            (typeof key[1] === 'object' && key[1] !== null && 'tenantId' in key[1])
          );
        }
      });
    }
  }, [currentTenant?.id, reactQueryClient]);

  useEffect(() => {
    const handleTenantLost = async () => {
      console.log("[GlobalTenantEvents] Tenant lost, clearing all query cache");
      
      // Clear ALL queries and mutations to prevent stale data
      await queryClient.clear();
      
      // Show warning toast
      toast({
        title: "Workspace Disconnected",
        description: "Please select a workspace to continue.",
        variant: "destructive",
      });
    };

    const handleTenantChanged = async (tenant: Tenant | null) => {
      if (tenant) {
        console.log("[GlobalTenantEvents] Tenant changed, invalidating queries");
        
        // Invalidate ALL queries to refetch with new tenant context
        await queryClient.invalidateQueries({ exact: false });
        
        // Show success toast
        toast({
          title: "Workspace Selected",
          description: `Now viewing ${tenant.name}`,
        });
      }
    };

    tenantSession.on("tenant-lost", handleTenantLost);
    tenantSession.on("tenant-changed", handleTenantChanged);

    return () => {
      tenantSession.off("tenant-lost", handleTenantLost);
      tenantSession.off("tenant-changed", handleTenantChanged);
    };
  }, [toast]);

  return null;
}
