import { useEffect } from "react";
import { tenantSession } from "@/lib/tenantSession";
import { useToast } from "@/hooks/use-toast";
import type { Tenant } from "@shared/schema";

export function GlobalTenantEvents() {
  const { toast } = useToast();

  useEffect(() => {
    const handleTenantLost = () => {
      console.log("[GlobalTenantEvents] Tenant lost - showing notification");
      toast({
        title: "Workspace Disconnected",
        description: "Please select a workspace to continue using the application.",
        variant: "destructive",
      });
    };

    const handleTenantChanged = (tenant: Tenant | null) => {
      if (tenant) {
        console.log("[GlobalTenantEvents] Tenant changed to:", tenant.name);
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
