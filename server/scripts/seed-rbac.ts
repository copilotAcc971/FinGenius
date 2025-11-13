import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import {
  permissions,
  roles,
  rolePermissions,
  tenants,
  tenantMembers,
  tenantMemberRoles,
  type Permission,
} from '@shared/schema';
import { PERMISSION_DEFINITIONS } from '../rbac/permissions';
import { DEFAULT_ROLES, ROLE_HIERARCHY } from '../rbac/default-roles';

/**
 * Local helper to resolve wildcard permissions using actual DB permission IDs
 * @param patterns - Array of permission patterns (e.g., 'customers.*', 'invoices.create')
 * @param permissionMap - Map of permission names to IDs from the database
 * @returns Array of permission IDs
 */
function resolveWildcardPermissions(
  patterns: string[],
  permissionMap: Map<string, string>
): string[] {
  const permissionIds: string[] = [];
  
  for (const pattern of patterns) {
    if (pattern.endsWith('.*')) {
      // Wildcard: customers.* → customers.create, customers.read, etc.
      const module = pattern.slice(0, -2);
      for (const [permName, permId] of permissionMap.entries()) {
        if (permName.startsWith(`${module}.`)) {
          permissionIds.push(permId);
        }
      }
    } else {
      // Exact match
      const permId = permissionMap.get(pattern);
      if (permId) {
        permissionIds.push(permId);
      }
    }
  }
  
  return permissionIds;
}

/**
 * Seed all permissions into the global permissions table
 * Idempotent - can be run multiple times without duplicates
 */
export async function seedPermissions(): Promise<void> {
  try {
    console.log('[RBAC Seed] Seeding permissions...');
    
    // Insert all permissions with ON CONFLICT DO NOTHING for idempotency
    for (const perm of PERMISSION_DEFINITIONS) {
      await db
        .insert(permissions)
        .values({
          module: perm.module,
          action: perm.action,
          name: perm.name,
          description: perm.description,
        })
        .onConflictDoNothing();
    }
    
    console.log(`[RBAC Seed] ✓ Seeded ${PERMISSION_DEFINITIONS.length} permissions`);
  } catch (error) {
    console.error('[RBAC Seed] Error seeding permissions:', error);
    throw error;
  }
}

/**
 * Seed default roles for a specific tenant
 * Creates all system roles (Owner, Admin, Accountant, etc.) with their permissions
 */
export async function seedRolesForTenant(tenantId: string): Promise<void> {
  try {
    console.log(`[RBAC Seed] Seeding roles for tenant ${tenantId}...`);
    
    // Get all permissions for wildcard resolution - use actual DB permissions
    const allPermissions = await db.select().from(permissions);
    const permissionMap = new Map(allPermissions.map(p => [p.name, p.id]));
    
    let rolesCreated = 0;
    
    // Create each default role
    for (const [key, roleDefinition] of Object.entries(DEFAULT_ROLES)) {
      // Check if role already exists for this tenant
      const existingRole = await db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.tenantId, tenantId),
            eq(roles.name, roleDefinition.name)
          )
        );
      
      if (existingRole.length > 0) {
        console.log(`[RBAC Seed]   - Role "${roleDefinition.name}" already exists, skipping`);
        continue;
      }
      
      // Create the role
      const [newRole] = await db
        .insert(roles)
        .values({
          tenantId,
          name: roleDefinition.name,
          description: roleDefinition.description,
          isSystem: roleDefinition.isSystem,
        })
        .returning();
      
      // Resolve permissions to actual IDs
      let permissionIds: string[] = [];
      
      if (roleDefinition.permissions === '*') {
        // Owner gets ALL permissions from DB
        permissionIds = allPermissions.map(p => p.id);
      } else if (Array.isArray(roleDefinition.permissions)) {
        // Resolve wildcard patterns to actual permission IDs
        permissionIds = resolveWildcardPermissions(roleDefinition.permissions, permissionMap);
      }
      
      // Assign permissions to role
      if (permissionIds.length > 0) {
        await db.insert(rolePermissions).values(
          permissionIds.map(permissionId => ({
            roleId: newRole.id,
            permissionId,
          }))
        );
      }
      
      console.log(`[RBAC Seed]   ✓ Created role "${roleDefinition.name}" with ${permissionIds.length} permissions`);
      rolesCreated++;
    }
    
    console.log(`[RBAC Seed] ✓ Seeded ${rolesCreated} roles for tenant ${tenantId}`);
  } catch (error) {
    console.error('[RBAC Seed] Error seeding roles for tenant:', error);
    throw error;
  }
}

/**
 * Migrate existing tenant members from old role string to new RBAC system
 * Maps old role strings ('owner', 'admin', 'member') to new role IDs
 */
export async function migrateExistingMembers(): Promise<void> {
  try {
    console.log('[RBAC Migration] Starting migration of legacy role strings...');
    
    // Get all tenant members
    const allMembers = await db.select().from(tenantMembers);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const member of allMembers) {
      // Check if member already has RBAC roles assigned
      const existingRoleAssignments = await db
        .select()
        .from(tenantMemberRoles)
        .where(eq(tenantMemberRoles.tenantMemberId, member.id));
      
      if (existingRoleAssignments.length > 0) {
        // Already migrated
        console.log(`[RBAC Migration]   Member ${member.id} already migrated`);
        skippedCount++;
        continue;
      }
      
      // Map old role string to new role name
      const legacyRole = member.role || 'member'; // Default to 'member' if null/undefined
      const normalizedRole = legacyRole.toLowerCase().trim();
      
      let roleName: string;
      
      switch (normalizedRole) {
        case 'owner':
          roleName = 'Owner';
          break;
        case 'admin':
          roleName = 'Admin';
          break;
        case 'accountant':
          roleName = 'Accountant';
          break;
        case 'bookkeeper':
          roleName = 'Bookkeeper';
          break;
        case 'sales':
          roleName = 'Sales';
          break;
        case 'purchase':
          roleName = 'Purchase';
          break;
        case 'viewer':
          roleName = 'Viewer';
          break;
        case 'member':
        default:
          // Default to Bookkeeper for generic members or unknown roles
          roleName = 'Bookkeeper';
          break;
      }
      
      // Find the role ID for this tenant
      const [role] = await db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.tenantId, member.tenantId),
            eq(roles.name, roleName)
          )
        );
      
      if (!role) {
        console.error(`[RBAC Migration]   ERROR: Role "${roleName}" not found for tenant ${member.tenantId}, skipping member ${member.id}`);
        skippedCount++;
        continue;
      }
      
      // Assign the role
      await db.insert(tenantMemberRoles).values({
        tenantMemberId: member.id,
        roleId: role.id,
      });
      
      console.log(`[RBAC Migration]   ✓ Migrated member ${member.id}: "${legacyRole}" → "${roleName}"`);
      migratedCount++;
    }
    
    console.log(`[RBAC Migration] ✓ Migration complete: ${migratedCount} migrated, ${skippedCount} skipped`);
  } catch (error) {
    console.error('[RBAC Migration] Error migrating existing members:', error);
    throw error;
  }
}

/**
 * Complete RBAC initialization for all tenants
 * Runs all seed operations in sequence
 */
export async function initializeRBAC(): Promise<void> {
  try {
    console.log('===== Initializing RBAC System =====');
    
    // Step 1: Seed global permissions
    await seedPermissions();
    
    // Step 2: Seed roles for all existing tenants
    const allTenants = await db.select().from(tenants);
    console.log(`\nSeeding roles for ${allTenants.length} tenants...`);
    
    for (const tenant of allTenants) {
      await seedRolesForTenant(tenant.id);
    }
    
    // Step 3: Migrate existing members
    console.log('\nMigrating existing tenant members...');
    await migrateExistingMembers();
    
    console.log('\n===== RBAC Initialization Complete =====');
  } catch (error) {
    console.error('Error initializing RBAC:', error);
    throw error;
  }
}
