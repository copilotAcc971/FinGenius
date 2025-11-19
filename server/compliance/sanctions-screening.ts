import type { IStorage } from '../storage';
import type { InsertSanctionsScreening } from '@shared/schema';

/**
 * PRODUCTION INTEGRATION REQUIRED:
 * 
 * Replace mock implementations with real sanctions screening APIs:
 * - OFAC: https://sanctionslist.ofac.treas.gov/
 * - UN: https://www.un.org/securitycouncil/sanctions/information
 * - EU: https://webgate.ec.europa.eu/fsd/fsf
 * - UK: https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets
 * 
 * Recommended Third-Party Providers:
 * - Dow Jones Risk & Compliance: https://www.dowjones.com/professional/risk/
 * - Refinitiv World-Check One: https://www.refinitiv.com/en/products/world-check-kyc-screening
 * - ComplyAdvantage: https://complyadvantage.com/
 * - LexisNexis Bridger: https://risk.lexisnexis.com/
 * 
 * Current implementation uses keyword matching for demonstration purposes only.
 * Production deployments MUST integrate with authoritative sanctions databases.
 */

export interface ScreeningEntity {
  entityType: 'customer' | 'vendor' | 'beneficial_owner';
  entityId: string;
  entityName: string;
  dateOfBirth?: string;
  nationality?: string;
  countryOfResidence?: string;
}

export interface ScreeningResult {
  overallResult: 'clear' | 'potential_match' | 'match';
  requiresReview: boolean;
  lists: {
    ofac: { result: 'clear' | 'match'; confidence?: number; details?: any };
    un: { result: 'clear' | 'match'; confidence?: number; details?: any };
    eu: { result: 'clear' | 'match'; confidence?: number; details?: any };
    uk: { result: 'clear' | 'match'; confidence?: number; details?: any };
    pep: { result: 'clear' | 'match'; confidence?: number; details?: any };
  };
}

export class SanctionsScreeningService {
  constructor(private storage: IStorage) {}
  
  /**
   * Screen an entity against all sanctions lists
   * NOTE: This is a mock implementation. Production should integrate with:
   * - Dow Jones Risk & Compliance
   * - Refinitiv World-Check One
   * - ComplyAdvantage
   * - LexisNexis Bridger
   */
  async screenEntity(
    tenantId: string,
    entity: ScreeningEntity,
    screeningType: 'onboarding' | 'daily_batch' | 'transaction' | 'manual'
  ): Promise<ScreeningResult> {
    console.log(`[SanctionsScreening] Screening ${entity.entityType} ${entity.entityName}`);
    
    // Perform screening (MOCK IMPLEMENTATION - Replace with real API)
    const result: ScreeningResult = {
      overallResult: 'clear',
      requiresReview: false,
      lists: {
        ofac: await this.checkOFAC(entity),
        un: await this.checkUN(entity),
        eu: await this.checkEU(entity),
        uk: await this.checkUK(entity),
        pep: await this.checkPEP(entity),
      },
    };
    
    // Determine overall result
    const hasMatch = Object.values(result.lists).some(list => list.result === 'match');
    if (hasMatch) {
      result.overallResult = 'match';
      result.requiresReview = true;
    }
    
    // Store screening result
    const screening: InsertSanctionsScreening = {
      tenantId,
      entityType: entity.entityType,
      entityId: entity.entityId,
      entityName: entity.entityName,
      screeningType,
      screeningDate: new Date(),
      overallResult: result.overallResult,
      ofacResult: result.lists.ofac.result,
      ofacConfidence: result.lists.ofac.confidence?.toString(),
      ofacMatchDetails: result.lists.ofac.details,
      unResult: result.lists.un.result,
      unConfidence: result.lists.un.confidence?.toString(),
      unMatchDetails: result.lists.un.details,
      euResult: result.lists.eu.result,
      euConfidence: result.lists.eu.confidence?.toString(),
      euMatchDetails: result.lists.eu.details,
      ukResult: result.lists.uk.result,
      ukConfidence: result.lists.uk.confidence?.toString(),
      ukMatchDetails: result.lists.uk.details,
      pepResult: result.lists.pep.result,
      pepConfidence: result.lists.pep.confidence?.toString(),
      pepMatchDetails: result.lists.pep.details,
      requiresReview: result.requiresReview,
      reviewStatus: result.requiresReview ? 'pending' : undefined,
    };
    
    await this.storage.createSanctionsScreening(screening);
    
    return result;
  }
  
  private async checkOFAC(entity: ScreeningEntity): Promise<{ result: 'clear' | 'match'; confidence?: number; details?: any }> {
    // MOCK: Replace with actual OFAC API call
    // Real implementation: Call OFAC SDN API or third-party provider
    
    const normalizedName = entity.entityName.toLowerCase();
    
    // Simple mock: flag suspicious keywords
    const suspiciousKeywords = ['sanction', 'blocked', 'denied'];
    if (suspiciousKeywords.some(kw => normalizedName.includes(kw))) {
      return {
        result: 'match',
        confidence: 0.95,
        details: { list: 'OFAC SDN', matchType: 'keyword', name: entity.entityName },
      };
    }
    
    return { result: 'clear' };
  }
  
  private async checkUN(entity: ScreeningEntity): Promise<{ result: 'clear' | 'match'; confidence?: number; details?: any }> {
    // MOCK: Replace with UN Sanctions List API
    return { result: 'clear' };
  }
  
  private async checkEU(entity: ScreeningEntity): Promise<{ result: 'clear' | 'match'; confidence?: number; details?: any }> {
    // MOCK: Replace with EU Sanctions List API
    return { result: 'clear' };
  }
  
  private async checkUK(entity: ScreeningEntity): Promise<{ result: 'clear' | 'match'; confidence?: number; details?: any }> {
    // MOCK: Replace with UK Sanctions List API
    return { result: 'clear' };
  }
  
  private async checkPEP(entity: ScreeningEntity): Promise<{ result: 'clear' | 'match'; confidence?: number; details?: any }> {
    // PRODUCTION: Replace with PEP database API (e.g., World-Check, Dow Jones)
    const normalizedName = entity.entityName.toLowerCase();
    
    // Enhanced keyword matching for PEP classification
    const pepKeywords = {
      senior_official: ['minister', 'president', 'prime minister', 'deputy', 'vice president', 'secretary', 'director general', 'ambassador', 'senator', 'governor'],
      family_member: ['spouse', 'son of', 'daughter of', 'wife of', 'husband of'],
      close_associate: ['business partner', 'advisor to', 'associate of'],
    };
    
    // Check each category
    for (const [category, keywords] of Object.entries(pepKeywords)) {
      const hasKeyword = keywords.some(kw => normalizedName.includes(kw));
      if (hasKeyword) {
        return {
          result: 'match',
          confidence: 0.88,
          details: {
            category,
            title: `Possible PEP (${category})`,
            name: entity.entityName,
            keywords: keywords.filter(kw => normalizedName.includes(kw)),
            requiresManualReview: true,
            // PRODUCTION: Would include additional fields like country, position, etc.
          },
        };
      }
    }
    
    return { result: 'clear' };
  }
}
