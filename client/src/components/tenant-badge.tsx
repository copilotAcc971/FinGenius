import { Building } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { Badge } from "@/components/ui/badge";

export function TenantBadge() {
  const { currentTenant } = useTenant();

  if (!currentTenant) {
    return null;
  }

  return (
    <Badge variant="outline" className="gap-1.5 px-3 py-1.5 font-normal" data-testid="badge-tenant">
      <Building className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs">{currentTenant.name}</span>
    </Badge>
  );
}
