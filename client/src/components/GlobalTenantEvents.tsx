import { useEffect } from "react";
import { tenantSession } from "@/lib/tenantSession";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tenant } from "@shared/schema";

export function GlobalTenantEvents() {
  const { toast } = useToast();

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
