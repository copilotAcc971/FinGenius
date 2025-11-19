import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Tenant } from "@shared/schema";
import { tenantSession } from "@/shared/lib/auth/tenantSession";

interface TenantContextType {
  currentTenant: Tenant | null;
  setCurrentTenant: (tenant: Tenant | null) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
  
  useEffect(() => {
    let mounted = true;

    console.log("[TenantProvider] Initializing TenantSession...");
    tenantSession.initialize();
    
    const tenant = tenantSession.getTenant();
    console.log("[TenantProvider] Initial tenant from TenantSession:", tenant?.name || "none");
    setCurrentTenantState(tenant);

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

    // TEST-ONLY: Expose tenant bootstrap hook for E2E testing
    // This allows Playwright tests to set tenant context programmatically
    // Delegates to setCurrentTenant to ensure consistent behavior
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
      (window as any).__setTenantForTesting = setCurrentTenant;
      console.log("[TenantProvider] TEST-ONLY: Exposed window.__setTenantForTesting hook");
    }

    return () => {
      mounted = false;
      tenantSession.off("tenant-changed", handleTenantChanged);
      tenantSession.off("tenant-lost", handleTenantLost);
      
      // Clean up test hook
      if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
        delete (window as any).__setTenantForTesting;
      }
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
