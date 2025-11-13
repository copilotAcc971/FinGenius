import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Role, Permission } from '@shared/schema';

interface RBACContextType {
  permissions: string[];
  roles: Role[];
  isOwner: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  isLoading: boolean;
}

const RBACContext = createContext<RBACContextType | null>(null);

export function RBACProvider({ children, tenantId }: { children: ReactNode; tenantId: string | null }) {
  const { data: permissionsData, isLoading: permissionsLoading } = useQuery<{ permissions: string[] }>({
    queryKey: ['/api/rbac/permissions/me', { tenantId }],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const { data: rolesData, isLoading: rolesLoading } = useQuery<{ roles: Role[] }>({
    queryKey: ['/api/rbac/roles/me', { tenantId }],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const permissions = permissionsData?.permissions || [];
  const roles = rolesData?.roles || [];
  const isOwner = roles.some((r: Role) => r.name === 'Owner');
  const isLoading = permissionsLoading || rolesLoading;

  // Debug logging for RBAC state
  useEffect(() => {
    if (!isLoading && permissions.length > 0) {
      console.log('[RBAC] User permissions loaded:', {
        permissionCount: permissions.length,
        hasWildcard: permissions.includes('*'),
        isOwner,
        roles: roles.map((r: Role) => r.name),
      });
    }
  }, [permissions, roles, isOwner, isLoading]);

  const hasPermission = (permission: string) => {
    // During loading, default to false to prevent flash of unauthorized content
    if (isLoading) return false;
    
    // Check if Owner by role (primary check)
    if (isOwner) return true;
    
    // Check for wildcard permission (backup for Owner or any role granted '*')
    if (permissions.includes('*')) return true;
    
    // Check for specific permission
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: string[]) => {
    // During loading, default to false
    if (isLoading) return false;
    
    // Check if Owner by role
    if (isOwner) return true;
    
    // Check for wildcard permission
    if (permissions.includes('*')) return true;
    
    // Check if any specific permission exists
    return perms.some(p => permissions.includes(p));
  };

  const hasAllPermissions = (perms: string[]) => {
    // During loading, default to false
    if (isLoading) return false;
    
    // Check if Owner by role
    if (isOwner) return true;
    
    // Check for wildcard permission
    if (permissions.includes('*')) return true;
    
    // Check if all specific permissions exist
    return perms.every(p => permissions.includes(p));
  };

  const hasRole = (role: string) => {
    return roles.some((r: Role) => r.name === role);
  };

  const value = {
    permissions,
    roles,
    isOwner,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isLoading,
  };

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
}

export function useRBAC() {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error('useRBAC must be used within RBACProvider');
  }
  return context;
}

export function useHasPermission(permission: string) {
  const { hasPermission } = useRBAC();
  return hasPermission(permission);
}

export function useHasAnyPermission(permissions: string[]) {
  const { hasAnyPermission } = useRBAC();
  return hasAnyPermission(permissions);
}
