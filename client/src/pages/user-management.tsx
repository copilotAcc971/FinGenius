import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Shield } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

export default function UserManagement() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const tenantId = currentTenant?.id;

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['/api/tenants/members', { tenantId }],
    enabled: !!tenantId,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['/api/rbac/roles', { tenantId }],
    enabled: !!tenantId,
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      return apiRequest('POST', `/api/rbac/users/${userId}/roles?tenantId=${tenantId}`, { roleId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants/members'] });
      toast({
        title: "Role assigned",
        description: "The role has been successfully assigned to the user.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign role",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage workspace members and their role assignments
          </p>
        </div>
        <Button data-testid="button-invite-user">
          <UserPlus className="w-4 h-4 mr-2" />
          Invite User
        </Button>
      </div>

      {isLoading ? (
        <div data-testid="loading-users" className="flex items-center justify-center p-12">
          <div className="text-muted-foreground">Loading users...</div>
        </div>
      ) : (
        <div className="grid gap-4">
          {members.length === 0 ? (
            <Card className="p-12">
              <div className="text-center text-muted-foreground">
                No members found in this workspace.
              </div>
            </Card>
          ) : (
            members.map((member: any) => (
              <Card key={member.id} className="p-6" data-testid={`card-user-${member.id}`}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="font-semibold text-base" data-testid={`text-user-email-${member.id}`}>
                      {member.email}
                    </div>
                    {(member.firstName || member.lastName) && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {member.firstName} {member.lastName}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {member.roles && member.roles.length > 0 ? (
                        member.roles.map((role: any) => (
                          <Badge 
                            key={role.id} 
                            variant="secondary" 
                            className="flex items-center gap-1"
                            data-testid={`badge-role-${member.id}-${role.id}`}
                          >
                            <Shield className="w-3 h-3" />
                            {role.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No roles assigned</span>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    data-testid={`button-manage-roles-${member.id}`}
                  >
                    Manage Roles
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
