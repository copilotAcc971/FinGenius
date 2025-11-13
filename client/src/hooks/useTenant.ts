import { useState, useEffect } from "react";
import type { Tenant } from "@shared/schema";

export function useTenant() {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  
  useEffect(() => {
    const stored = localStorage.getItem("currentTenant");
    if (stored) {
      setCurrentTenant(JSON.parse(stored));
    }
  }, []);

  const switchTenant = (tenant: Tenant) => {
    setCurrentTenant(tenant);
    localStorage.setItem("currentTenant", JSON.stringify(tenant));
  };

  return {
    currentTenant,
    setCurrentTenant: switchTenant,
  };
}
