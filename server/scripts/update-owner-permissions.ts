import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { permissions, roles, rolePermissions, tenants, tenantMembers, tenantMemberRoles } from '@shared/schema';

/**
 * Comprehensive RBAC initialization:
 * 1. Ensure every tenant has an Owner role
 * 2. Assign all permissions to every Owner role
 * 3. Migrate legacy tenant members to RBAC system
 */
export async function initializeRBACForAllTenants() {
  console.log('[RBAC Init] Starting comprehensive RBAC initialization...');
  
  try {
    // Get all permissions
    const allPermissions = await db.select().from(permissions);
    console.log(`[RBAC Init] Found ${allPermissions.length} permissions`);
    
    // Get all tenants
    const allTenants = await db.select().from(tenants);
    console.log(`[RBAC Init] Processing ${allTenants.length} tenants...`);
    
    for (const tenant of allTenants) {
      // 1. Ensure Owner role exists for this tenant
      let ownerRole = await db.select().from(roles).where(
        and(
          eq(roles.tenantId, tenant.id),
          eq(roles.name, 'Owner')
        )
      );
      
      if (ownerRole.length === 0) {
        // Create Owner role
        const [newOwnerRole] = await db.insert(roles).values({
          tenantId: tenant.id,
          name: 'Owner',
          description: 'Full access to the tenant',
          isSystem: true
        }).returning();
        
        ownerRole = [newOwnerRole];
        console.log(`[RBAC Init]   Created Owner role for tenant ${tenant.name}`);
      }
      
      const ownerRoleId = ownerRole[0].id;
      
      // 2. Ensure Owner role has ALL permissions
      // Delete existing permissions first
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, ownerRoleId));
      
      // Add all permissions
      await db.insert(rolePermissions).values(
        allPermissions.map(p => ({
          roleId: ownerRoleId,
          permissionId: p.id
        }))
      );
      
      console.log(`[RBAC Init]   Updated Owner role for tenant ${tenant.name} with ${allPermissions.length} permissions`);
      
      // 3. Migrate legacy tenant members to RBAC
      const membersToMigrate = await db.select().from(tenantMembers).where(
        and(
          eq(tenantMembers.tenantId, tenant.id),
          eq(tenantMembers.role, 'owner')
        )
      );
      
      for (const member of membersToMigrate) {
        // Check if already migrated
        const existing = await db.select().from(tenantMemberRoles).where(
          eq(tenantMemberRoles.tenantMemberId, member.id)
        );
        
        if (existing.length === 0) {
          // Assign Owner role
          await db.insert(tenantMemberRoles).values({
            tenantMemberId: member.id,
            roleId: ownerRoleId
          });
          
          console.log(`[RBAC Init]     Migrated member ${member.id} to Owner role`);
        }
      }
    }
    
    console.log('[RBAC Init] Complete - all tenants now have Owner roles with full permissions');
  } catch (error) {
    console.error('[RBAC Init] Error during RBAC initialization:', error);
    throw error;
  }
}

// Keep old function name for backward compatibility
export const updateOwnerPermissions = initializeRBACForAllTenants;
