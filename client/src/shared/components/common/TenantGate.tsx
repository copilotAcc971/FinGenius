import { useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { tenantSession } from "@/shared/lib/auth/tenantSession";
import { useTenant } from "@/shared/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Loader2, Building2 } from "lucide-react";
import { OrganizationSwitcher } from "../layout/organization-switcher";
import type { Tenant } from "@shared/schema";

interface TenantGateProps {
  children: ReactNode;
}

export function TenantGate({ children }: TenantGateProps) {
  const [isReady, setIsReady] = useState(() => tenantSession.isReady());
  const { currentTenant } = useTenant();
  
  const { isLoading: tenantsLoading, isError: tenantsError } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  useEffect(() => {
    if (isReady) {
      console.log("[TenantGate] Already ready on mount");
      return;
    }

    console.log("[TenantGate] Waiting for ready state...");
    
    const handleReady = () => {
      console.log("[TenantGate] TenantSession ready");
      setIsReady(true);
    };

    tenantSession.on("ready", handleReady);

    if (tenantSession.isReady()) {
      setIsReady(true);
    }

    return () => {
      tenantSession.off("ready", handleReady);
    };
  }, [isReady]);

  if (!isReady || (tenantsLoading && !tenantsError)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/20">
        <Card className="w-[400px]">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Loading organization...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/20">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Building2 className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle>Select an Organization</CardTitle>
            <CardDescription>
              Please select an organization to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <OrganizationSwitcher />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
