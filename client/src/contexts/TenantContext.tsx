import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Tenant } from "@shared/schema";
import { tenantSession } from "@/lib/tenantSession";

interface TenantContextType {
  currentTenant: Tenant | null;
  setCurrentTenant: (tenant: Tenant | null) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
  
  useEffect(() => {
    let mounted = true;

    async function initializeTenant() {
      console.log("[TenantProvider] Initializing TenantSession...");
      await tenantSession.initialize();
      
      if (!mounted) return;

      const tenant = tenantSession.getTenant();
      console.log("[TenantProvider] Initial tenant from TenantSession:", tenant?.name || "none");
      setCurrentTenantState(tenant);
    }

    initializeTenant();

    const handleTenantChanged = (tenant: Tenant | null) => {
      console.log("[TenantProvider] Tenant changed event:", tenant?.name || "none");
      if (mounted) {
        setCurrentTenantState(tenant);
      }
    };

    const handleTenantLost = () => {
      console.log("[TenantProvider] Tenant lost event");
      if (mounted) {
        setCurrentTenantState(null);
      }
    };

    tenantSession.on("tenant-changed", handleTenantChanged);
    tenantSession.on("tenant-lost", handleTenantLost);

    return () => {
      mounted = false;
      tenantSession.off("tenant-changed", handleTenantChanged);
      tenantSession.off("tenant-lost", handleTenantLost);
    };
  }, []);

  const setCurrentTenant = (tenant: Tenant | null) => {
    console.log("[TenantProvider] setCurrentTenant called:", tenant?.name || "null");
    tenantSession.setTenant(tenant);
    setCurrentTenantState(tenant);
  };

  return (
    <TenantContext.Provider value={{ currentTenant, setCurrentTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
