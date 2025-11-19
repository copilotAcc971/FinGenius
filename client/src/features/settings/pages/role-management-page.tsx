import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/shared/lib/api/queryClient';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Plus, Edit, Trash } from 'lucide-react';
import { useState } from 'react';
import { useTenant } from '@/shared/hooks/useTenant';
import { useToast } from '@/shared/hooks/use-toast';

export default function RoleManagement() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const tenantId = currentTenant?.id;

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['/api/rbac/roles', { tenantId }],
    enabled: !!tenantId,
  });

  const { data: allPermissions = [] } = useQuery({
    queryKey: ['/api/rbac/permissions'],
    enabled: !!tenantId,
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      return apiRequest('DELETE', `/api/rbac/roles/${roleId}?tenantId=${tenantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/roles'] });
      toast({
        title: "Role deleted",
        description: "The role has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Role Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage roles and permissions for your organization
          </p>
        </div>
        <Button data-testid="button-create-role">
          <Plus className="w-4 h-4 mr-2" />
          Create Custom Role
        </Button>
      </div>

      {isLoading ? (
        <div data-testid="loading-roles" className="flex items-center justify-center p-12">
          <div className="text-muted-foreground">Loading roles...</div>
        </div>
      ) : (
        <div className="grid gap-4">
          {roles.length === 0 ? (
            <Card className="p-12">
              <div className="text-center text-muted-foreground">
                No roles found. Create your first custom role to get started.
              </div>
            </Card>
          ) : (
            roles.map((role: any) => (
              <Card key={role.id} data-testid={`card-role-${role.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle data-testid={`text-role-name-${role.id}`}>{role.name}</CardTitle>
                        {role.isSystem && (
                          <Badge variant="secondary" data-testid={`badge-system-${role.id}`}>System</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`text-role-description-${role.id}`}>
                        {role.description || 'No description provided'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!role.isSystem && (
                        <>
                          <Button size="icon" variant="ghost" data-testid={`button-edit-role-${role.id}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            data-testid={`button-delete-role-${role.id}`}
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
                                deleteRoleMutation.mutate(role.id);
                              }
                            }}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <strong>Permissions:</strong> {role.permissionCount || 0} permissions assigned
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
