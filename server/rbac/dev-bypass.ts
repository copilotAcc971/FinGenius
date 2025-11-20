/**
 * DEVELOPMENT BYPASS for RBAC
 * 
 * When DISABLE_RBAC_CHECKS=true is set in environment variables,
 * all permission checks will be bypassed for rapid development.
 * 
 * This keeps the RBAC infrastructure in place but removes friction during development.
 * 
 * PRODUCTION: Always set DISABLE_RBAC_CHECKS=false or leave unset
 */

export const RBAC_BYPASS_ENABLED = process.env.DISABLE_RBAC_CHECKS === 'true';

/**
 * Check if RBAC checks should be bypassed
 */
export function shouldBypassRBAC(): boolean {
  if (RBAC_BYPASS_ENABLED) {
    console.log('[RBAC Bypass] ⚠️  RBAC checks disabled for development');
    return true;
  }
  return false;
}

/**
 * Wrapper for permission checks that respects bypass flag
 */
export function checkPermissionWithBypass(
  actualCheck: () => boolean,
  permissionName: string
): boolean {
  if (shouldBypassRBAC()) {
    console.log(`[RBAC Bypass] Granting permission: ${permissionName}`);
    return true;
  }
  return actualCheck();
}

/**
 * Async wrapper for permission checks that respects bypass flag
 */
export async function checkPermissionWithBypassAsync(
  actualCheck: () => Promise<boolean>,
  permissionName: string
): Promise<boolean> {
  if (shouldBypassRBAC()) {
    console.log(`[RBAC Bypass] Granting permission: ${permissionName}`);
    return true;
  }
  return await actualCheck();
}

/**
 * Log bypass status on server start
 */
export function logBypassStatus() {
  if (RBAC_BYPASS_ENABLED) {
    console.log('\n⚠️  ═══════════════════════════════════════════════════════════');
    console.log('⚠️  RBAC CHECKS DISABLED FOR DEVELOPMENT');
    console.log('⚠️  All users have full permissions');
    console.log('⚠️  Set DISABLE_RBAC_CHECKS=false to enable security');
    console.log('⚠️  ═══════════════════════════════════════════════════════════\n');
  } else {
    console.log('[RBAC] ✓ Security enabled - all permissions will be checked');
  }
}
