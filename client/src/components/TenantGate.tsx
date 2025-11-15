import { useEffect, useState, ReactNode } from "react";
import { tenantSession } from "@/lib/tenantSession";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2 } from "lucide-react";
import { WorkspaceSwitcher } from "./workspace-switcher";

interface TenantGateProps {
  children: ReactNode;
}

export function TenantGate({ children }: TenantGateProps) {
  const [isReady, setIsReady] = useState(false);
  const { currentTenant } = useTenant();

  useEffect(() => {
    async function waitForReady() {
      try {
        await tenantSession.waitForReady(10000);
        setIsReady(true);
        console.log("[TenantGate] TenantSession ready");
      } catch (error) {
        console.error("[TenantGate] TenantSession ready timeout:", error);
        setIsReady(true);
      }
    }

    waitForReady();
  }, []);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/20">
        <Card className="w-[400px]">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Loading workspace...</p>
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
            <CardTitle>Select a Workspace</CardTitle>
            <CardDescription>
              Please select a workspace to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <WorkspaceSwitcher />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
