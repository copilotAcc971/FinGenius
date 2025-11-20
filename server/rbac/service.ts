import { db } from '../db';
import { eq, and, inArray, or, isNull, gt } from 'drizzle-orm';
import {
  permissions,
  roles,
  rolePermissions,
  tenantMembers,
  tenantMemberRoles,
  rolePermissionOverrides,
  tenants,
  type Role,
  type Permission,
  type InsertRole,
  type InsertRolePermission,
  type InsertTenantMemberRole,
  type InsertRolePermissionOverride,
} from '@shared/schema';
import { expandPermissions, matchesPermissionPattern, resolveWildcardPermissions } from './permissions';
import { RBAC_BYPASS_ENABLED } from './dev-bypass';

export class RBACService {
  constructor(private tenantId: string) {}

  /**
   * Check if user has a specific permission
   * Owner role bypasses all permission checks
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    // Development bypass
    if (RBAC_BYPASS_ENABLED) {
      return true;
    }
    
    try {
      // Get user's permissions
      const userPermissions = await this.getUserPermissions(userId);
      
      // Check for exact match or wildcard match
      return userPermissions.some(userPerm => 
        matchesPermissionPattern(permission, userPerm)
      );
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get all permissions for a user (with inheritance expanded)
   * Returns expanded permission list including inherited permissions
   * Includes rolePermissionOverrides (per-user customizations)
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      // 1. Get user's roles via tenantMembers -> tenantMemberRoles -> roles
      const userRoles = await this.getUserRoles(userId);
      
      // 2. Check if user is Owner (has all permissions)
      const isOwner = userRoles.some(role => role.name === 'Owner');
      if (isOwner) {
        return ['*']; // Special wildcard for all permissions
      }
      
      // 3. Get all role IDs
      const roleIds = userRoles.map(role => role.id);
      
      // 4. Get base permissions from roles
      let permissionNames: string[] = [];
      
      if (roleIds.length > 0) {
        const rolePermsResult = await db
          .select({
            permissionName: permissions.name,
          })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(inArray(rolePermissions.roleId, roleIds));
        
        permissionNames = rolePermsResult.map(rp => rp.permissionName);
      }
      
      // 5. Get permission overrides for this user (excluding expired overrides)
      const now = new Date();
      const overridesResult = await db
        .select({
          permissionName: permissions.name,
          granted: rolePermissionOverrides.granted,
        })
        .from(rolePermissionOverrides)
        .innerJoin(permissions, eq(rolePermissionOverrides.permissionId, permissions.id))
        .where(
          and(
            eq(rolePermissionOverrides.tenantId, this.tenantId),
            eq(rolePermissionOverrides.userId, userId),
            // Include only non-expired overrides (expiresAt is null OR expiresAt > now)
            or(
              isNull(rolePermissionOverrides.expiresAt),
              gt(rolePermissionOverrides.expiresAt, now)
            )
          )
        );
      
      // 6. Apply overrides to base permissions
      const overridesToGrant = overridesResult
        .filter(o => o.granted)
        .map(o => o.permissionName);
      
      const overridesToRevoke = new Set(
        overridesResult
          .filter(o => !o.granted)
          .map(o => o.permissionName)
      );
      
      // Start with base permissions, remove revoked, add granted
      let finalPermissions = permissionNames.filter(perm => !overridesToRevoke.has(perm));
      finalPermissions = [...new Set([...finalPermissions, ...overridesToGrant])];
      
      // 7. Expand with inheritance (delete includes update and read, etc.)
      const expanded = expandPermissions(finalPermissions);
      
      return expanded;
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  /**
   * Get all roles assigned to a user in this tenant
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    try {
      // Find tenant member record
      const [member] = await db
        .select()
        .from(tenantMembers)
        .where(
          and(
            eq(tenantMembers.tenantId, this.tenantId),
            eq(tenantMembers.userId, userId)
          )
        );
      
      if (!member) {
        return [];
      }
      
      // Get roles assigned to this member
      const userRolesResult = await db
        .select({
          role: roles,
        })
        .from(tenantMemberRoles)
        .innerJoin(roles, eq(tenantMemberRoles.roleId, roles.id))
        .where(eq(tenantMemberRoles.tenantMemberId, member.id));
      
      return userRolesResult.map(r => r.role);
    } catch (error) {
      console.error('Error getting user roles:', error);
      return [];
    }
  }

  /**
   * Check if user is an owner of the tenant
   */
  async isOwner(userId: string): Promise<boolean> {
    try {
      const userRoles = await this.getUserRoles(userId);
      return userRoles.some(role => role.name === 'Owner');
    } catch (error) {
      console.error('Error checking owner status:', error);
      return false;
    }
  }

  /**
   * Create a custom role (non-system role)
   */
  async createCustomRole(
    name: string,
    description: string,
    permissionIds: string[]
  ): Promise<Role> {
    try {
      // Create the role
      const [role] = await db
        .insert(roles)
        .values({
          tenantId: this.tenantId,
          name,
          description,
          isSystem: false,
        })
        .returning();
      
      // Assign permissions to the role
      if (permissionIds.length > 0) {
        await db.insert(rolePermissions).values(
          permissionIds.map(permissionId => ({
            roleId: role.id,
            permissionId,
          }))
        );
      }
      
      return role;
    } catch (error) {
      console.error('Error creating custom role:', error);
      throw new Error('Failed to create custom role');
    }
  }

  /**
   * Update a custom role
   * Cannot update system roles
   */
  async updateRole(
    roleId: string,
    updates: { name?: string; description?: string },
    newPermissionIds?: string[]
  ): Promise<Role> {
    try {
      // Verify role exists and is not a system role
      const [role] = await db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.tenantId, this.tenantId)
          )
        );
      
      if (!role) {
        throw new Error('Role not found');
      }
      
      if (role.isSystem) {
        throw new Error('Cannot update system roles');
      }
      
      // Update role details
      const [updatedRole] = await db
        .update(roles)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(roles.id, roleId))
        .returning();
      
      // Update permissions if provided
      if (newPermissionIds !== undefined) {
        // Remove all existing permissions
        await db
          .delete(rolePermissions)
          .where(eq(rolePermissions.roleId, roleId));
        
        // Add new permissions
        if (newPermissionIds.length > 0) {
          await db.insert(rolePermissions).values(
            newPermissionIds.map(permissionId => ({
              roleId,
              permissionId,
            }))
          );
        }
      }
      
      return updatedRole;
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  }

  /**
   * Delete a custom role
   * Cannot delete system roles or roles currently assigned to users
   */
  async deleteRole(roleId: string): Promise<void> {
    try {
      // Verify role exists and is not a system role
      const [role] = await db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.tenantId, this.tenantId)
          )
        );
      
      if (!role) {
        throw new Error('Role not found');
      }
      
      if (role.isSystem) {
        throw new Error('Cannot delete system roles');
      }
      
      // Check if role is assigned to any users
      const assignments = await db
        .select()
        .from(tenantMemberRoles)
        .where(eq(tenantMemberRoles.roleId, roleId));
      
      if (assignments.length > 0) {
        throw new Error('Cannot delete role that is assigned to users');
      }
      
      // Delete the role (rolePermissions will be cascade deleted)
      await db.delete(roles).where(eq(roles.id, roleId));
    } catch (error) {
      console.error('Error deleting role:', error);
      throw error;
    }
  }

  /**
   * Assign a role to a user
   */
  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    try {
      // Verify role exists in this tenant
      const [role] = await db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.tenantId, this.tenantId)
          )
        );
      
      if (!role) {
        throw new Error('Role not found');
      }
      
      // Find tenant member record
      const [member] = await db
        .select()
        .from(tenantMembers)
        .where(
          and(
            eq(tenantMembers.tenantId, this.tenantId),
            eq(tenantMembers.userId, userId)
          )
        );
      
      if (!member) {
        throw new Error('User is not a member of this tenant');
      }
      
      // Assign the role (will fail if already assigned due to unique constraint)
      await db
        .insert(tenantMemberRoles)
        .values({
          tenantMemberId: member.id,
          roleId,
        })
        .onConflictDoNothing(); // Gracefully handle duplicate assignments
    } catch (error) {
      console.error('Error assigning role to user:', error);
      throw error;
    }
  }

  /**
   * Remove a role from a user
   */
  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    try {
      // Find tenant member record
      const [member] = await db
        .select()
        .from(tenantMembers)
        .where(
          and(
            eq(tenantMembers.tenantId, this.tenantId),
            eq(tenantMembers.userId, userId)
          )
        );
      
      if (!member) {
        throw new Error('User is not a member of this tenant');
      }
      
      // Remove the role assignment
      await db
        .delete(tenantMemberRoles)
        .where(
          and(
            eq(tenantMemberRoles.tenantMemberId, member.id),
            eq(tenantMemberRoles.roleId, roleId)
          )
        );
    } catch (error) {
      console.error('Error removing role from user:', error);
      throw error;
    }
  }

  /**
   * Get all roles for this tenant
   */
  async getAllRoles(): Promise<Role[]> {
    try {
      return await db
        .select()
        .from(roles)
        .where(eq(roles.tenantId, this.tenantId));
    } catch (error) {
      console.error('Error getting all roles:', error);
      return [];
    }
  }

  /**
   * Get role by ID with permission count
   */
  async getRoleWithPermissions(roleId: string): Promise<{
    role: Role;
    permissions: Permission[];
  } | null> {
    try {
      // Get the role
      const [role] = await db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.tenantId, this.tenantId)
          )
        );
      
      if (!role) {
        return null;
      }
      
      // Get permissions for this role
      const rolePermsResult = await db
        .select({
          permission: permissions,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, roleId));
      
      return {
        role,
        permissions: rolePermsResult.map(rp => rp.permission),
      };
    } catch (error) {
      console.error('Error getting role with permissions:', error);
      return null;
    }
  }
}

/**
 * Global helper to get all available permissions from the catalog
 */
export async function getAllPermissions(): Promise<Permission[]> {
  try {
    return await db.select().from(permissions);
  } catch (error) {
    console.error('Error getting all permissions:', error);
    return [];
  }
}

/**
 * Standalone utility: Get all permissions for a user in a specific tenant
 * Includes role-based permissions and per-user overrides
 * 
 * @param userId - The user ID to check permissions for
 * @param tenantId - The tenant context
 * @returns Array of permission strings (with inheritance expanded)
 */
export async function getUserPermissions(
  userId: string,
  tenantId: string
): Promise<string[]> {
  const rbacService = new RBACService(tenantId);
  return await rbacService.getUserPermissions(userId);
}

/**
 * Standalone utility: Check if a user has a specific permission in a tenant
 * Supports wildcard matching (e.g., 'invoices.*' matches 'invoices.create')
 * 
 * @param userId - The user ID to check
 * @param tenantId - The tenant context
 * @param permission - The permission to check (e.g., 'invoices.create')
 * @returns true if user has the permission, false otherwise
 */
export async function hasPermission(
  userId: string,
  tenantId: string,
  permission: string
): Promise<boolean> {
  const rbacService = new RBACService(tenantId);
  return await rbacService.hasPermission(userId, permission);
}

/**
 * Standalone utility: Grant or revoke a specific permission for a user
 * Creates a permission override in the rolePermissionOverrides table
 * 
 * @param userId - The user ID
 * @param tenantId - The tenant context
 * @param permissionName - The permission name (e.g., 'invoices.delete')
 * @param granted - true to grant, false to revoke
 * @param grantedBy - The user ID who is creating this override
 * @param reason - Optional reason for the override (audit trail)
 * @param expiresAt - Optional expiration date for the override
 */
export async function setPermissionOverride(
  userId: string,
  tenantId: string,
  permissionName: string,
  granted: boolean,
  grantedBy: string,
  reason?: string,
  expiresAt?: Date
): Promise<void> {
  try {
    // Find the permission by name
    const [permission] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.name, permissionName));
    
    if (!permission) {
      throw new Error(`Permission '${permissionName}' not found`);
    }
    
    // Upsert the override (insert or update if exists)
    await db
      .insert(rolePermissionOverrides)
      .values({
        tenantId,
        userId,
        permissionId: permission.id,
        granted,
        reason,
        grantedBy,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          rolePermissionOverrides.tenantId,
          rolePermissionOverrides.userId,
          rolePermissionOverrides.permissionId,
        ],
        set: {
          granted,
          reason,
          grantedBy,
          expiresAt,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Error setting permission override:', error);
    throw error;
  }
}

/**
 * Standalone utility: Remove a permission override for a user
 * 
 * @param userId - The user ID
 * @param tenantId - The tenant context
 * @param permissionName - The permission name to remove override for
 */
export async function removePermissionOverride(
  userId: string,
  tenantId: string,
  permissionName: string
): Promise<void> {
  try {
    // Find the permission by name
    const [permission] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.name, permissionName));
    
    if (!permission) {
      throw new Error(`Permission '${permissionName}' not found`);
    }
    
    // Delete the override
    await db
      .delete(rolePermissionOverrides)
      .where(
        and(
          eq(rolePermissionOverrides.tenantId, tenantId),
          eq(rolePermissionOverrides.userId, userId),
          eq(rolePermissionOverrides.permissionId, permission.id)
        )
      );
  } catch (error) {
    console.error('Error removing permission override:', error);
    throw error;
  }
}
