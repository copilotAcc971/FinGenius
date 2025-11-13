import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Tenant } from "@shared/schema";

interface TenantContextType {
  currentTenant: Tenant | null;
  setCurrentTenant: (tenant: Tenant | null) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
  
  useEffect(() => {
    const stored = localStorage.getItem("currentTenant");
    if (stored) {
      try {
        setCurrentTenantState(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored tenant", e);
        localStorage.removeItem("currentTenant");
      }
    }
  }, []);

  const setCurrentTenant = (tenant: Tenant | null) => {
    setCurrentTenantState(tenant);
    if (tenant) {
      localStorage.setItem("currentTenant", JSON.stringify(tenant));
    } else {
      localStorage.removeItem("currentTenant");
    }
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
