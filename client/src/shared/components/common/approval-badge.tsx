import { useQuery } from "@tanstack/react-query";
import { SidebarMenuBadge } from "@/shared/components/ui/sidebar";
import { useTenant } from "@/shared/hooks/useTenant";
import { defaultQueryFn } from "@/shared/lib/api/queryClient";
import type { PendingApproval } from "@/shared/types/approvals";

export function ApprovalBadge() {
  const { currentTenant } = useTenant();

  // Return null during tenant transitions
  if (!currentTenant?.id) return null;

  const { data: pendingApprovals = [] } = useQuery<PendingApproval[]>({
    queryKey: ["/api/approvals/pending", { tenantId: currentTenant.id }],
    queryFn: defaultQueryFn,
    enabled: true, // Always enabled since we already checked currentTenant
  });

  const pendingCount = pendingApprovals.length;
  
  if (pendingCount === 0) return null;
  
  return (
    <SidebarMenuBadge data-testid="badge-pending-approvals">
      {pendingCount}
    </SidebarMenuBadge>
  );
}
