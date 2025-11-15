import { db } from './db';
import { tenantCompanyProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Check if a tenant has IFRS compliance enabled
 * Returns false by default (non-IFRS mode is the default)
 */
export async function isIFRSCompliant(
  tenantId: string
): Promise<boolean> {
  const profile = await db
    .select({ ifrsComplianceEnabled: tenantCompanyProfiles.ifrsComplianceEnabled })
    .from(tenantCompanyProfiles)
    .where(eq(tenantCompanyProfiles.tenantId, tenantId))
    .limit(1);
  
  return profile[0]?.ifrsComplianceEnabled || false;
}
