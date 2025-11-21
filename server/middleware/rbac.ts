import { RBACService } from '../rbac/service';
import { matchesPermissionPattern } from '../rbac/permissions';
import type { Role } from '@shared/schema';

// Extend Express Request type to include RBAC context
declare global {
  namespace Express {
    interface Request {
      permissions?: string[];
      roles?: Role[];
      isOwner?: boolean;
    }
  }
}

/**
 * Load RBAC context for the authenticated user
 * Attaches permissions, roles, and owner status to the request
 * Must be used after isAuthenticated and verifyTenantAccess middleware
 */
export async function loadAuthContext(req: Express.Request & { user?: any; tenantId?: string; permissions?: string[]; roles?: Role[]; isOwner?: boolean }, res: any, next: any) {
  try {
    // Verify prerequisites
    if (!req.user || !req.user.claims || !req.user.claims.sub) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!req.tenantId) {
      return res.status(400).json({ message: 'Tenant context required' });
    }
    
    const userId = req.user.claims.sub;
    const tenantId = req.tenantId;
    
    // Initialize RBAC service for this tenant
    const rbacService = new RBACService(tenantId);
    
    // Load user's permissions and roles
    req.permissions = await rbacService.getUserPermissions(userId);
    req.roles = await rbacService.getUserRoles(userId);
    req.isOwner = req.roles.some((r: Role) => r.name === 'Owner');
    
    next();
  } catch (error) {
    console.error('Error loading auth context:', error);
    res.status(500).json({ message: 'Failed to load authorization context' });
  }
}

/**
 * Require a specific permission
 * Returns 403 if user doesn't have the permission
 * Owner role bypasses all permission checks
 */
export function requirePermission(permission: string) {
  return (req: Express.Request & { permissions?: string[]; roles?: Role[]; isOwner?: boolean }, res: any, next: any) => {
    // Owner bypass
    if (req.isOwner) {
      return next();
    }
    
    // Check if permissions are loaded
    if (!req.permissions) {
      return res.status(500).json({ 
        message: 'Authorization context not loaded. Ensure loadAuthContext middleware is applied.' 
      });
    }
    
    // Check for wildcard '*' (all permissions)
    if (req.permissions.includes('*')) {
      return next();
    }
    
    // Check if user has the required permission (with wildcard support)
    const hasPermission = req.permissions.some((userPerm: string) => 
      matchesPermissionPattern(permission, userPerm)
    );
    
    if (!hasPermission) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: permission 
      });
    }
    
    next();
  };
}

/**
 * Require ANY of the specified permissions (OR logic)
 * User needs at least one of the permissions
 */
export function requireAnyPermission(requiredPermissions: string[]) {
  return (req: Express.Request & { permissions?: string[]; roles?: Role[]; isOwner?: boolean }, res: any, next: any) => {
    // Owner bypass
    if (req.isOwner) {
      return next();
    }
    
    // Check if permissions are loaded
    if (!req.permissions) {
      return res.status(500).json({ 
        message: 'Authorization context not loaded. Ensure loadAuthContext middleware is applied.' 
      });
    }
    
    // Check for wildcard '*' (all permissions)
    if (req.permissions.includes('*')) {
      return next();
    }
    
    // Check if user has ANY of the required permissions
    const hasAnyPermission = requiredPermissions.some(requiredPerm =>
      req.permissions.some((userPerm: string) => 
        matchesPermissionPattern(requiredPerm, userPerm)
      )
    );
    
    if (!hasAnyPermission) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: `One of: ${requiredPermissions.join(', ')}` 
      });
    }
    
    next();
  };
}

/**
 * Require ALL of the specified permissions (AND logic)
 * User needs every permission in the list
 */
export function requireAllPermissions(requiredPermissions: string[]) {
  return (req: Express.Request & { permissions?: string[]; roles?: Role[]; isOwner?: boolean }, res: any, next: any) => {
    // Owner bypass
    if (req.isOwner) {
      return next();
    }
    
    // Check if permissions are loaded
    if (!req.permissions) {
      return res.status(500).json({ 
        message: 'Authorization context not loaded. Ensure loadAuthContext middleware is applied.' 
      });
    }
    
    // Check for wildcard '*' (all permissions)
    if (req.permissions.includes('*')) {
      return next();
    }
    
    // Check if user has ALL of the required permissions
    const hasAllPermissions = requiredPermissions.every(requiredPerm =>
      req.permissions.some((userPerm: string) => 
        matchesPermissionPattern(requiredPerm, userPerm)
      )
    );
    
    if (!hasAllPermissions) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: `All of: ${requiredPermissions.join(', ')}` 
      });
    }
    
    next();
  };
}

/**
 * Require a specific role
 * Checks role by name
 */
export function requireRole(roleName: string) {
  return (req: any, res: any, next: any) => {
    // Check if roles are loaded
    if (!req.roles) {
      return res.status(500).json({ 
        message: 'Authorization context not loaded. Ensure loadAuthContext middleware is applied.' 
      });
    }
    
    // Check if user has the required role
    const hasRole = req.roles.some((role: Role) => role.name === roleName);
    
    if (!hasRole) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: `Role: ${roleName}` 
      });
    }
    
    next();
  };
}

/**
 * Require any of the specified roles (OR logic)
 */
export function requireAnyRole(roleNames: string[]) {
  return (req: any, res: any, next: any) => {
    // Check if roles are loaded
    if (!req.roles) {
      return res.status(500).json({ 
        message: 'Authorization context not loaded. Ensure loadAuthContext middleware is applied.' 
      });
    }
    
    // Check if user has any of the required roles
    const hasAnyRole = req.roles.some((role: Role) => 
      roleNames.includes(role.name)
    );
    
    if (!hasAnyRole) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: `One of roles: ${roleNames.join(', ')}` 
      });
    }
    
    next();
  };
}
