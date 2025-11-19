import type { Customer, CustomerRiskProfile } from '@shared/schema';

export interface RiskFactors {
  geographicRisk: number;       // 0-20 based on country risk ratings
  industryRisk: number;          // 0-20 based on business type
  productServiceRisk: number;    // 0-20 based on products/services
  transactionRisk: number;       // 0-20 based on transaction patterns
  customerTypeRisk: number;      // 0-20 based on customer category
}

export class RiskScoringService {
  /**
   * Calculate overall customer risk score (0-100)
   * Risk Levels: Low (0-33), Medium (34-66), High (67-89), Critical (90-100)
   */
  calculateCustomerRiskScore(customer: Customer, factors: Partial<RiskFactors> = {}): {
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    factors: RiskFactors;
  } {
    // 1. Geographic Risk (0-20)
    const geographicRisk = factors.geographicRisk ?? this.assessGeographicRisk(customer);
    
    // 2. Industry Risk (0-20)
    const industryRisk = factors.industryRisk ?? this.assessIndustryRisk(customer);
    
    // 3. Product/Service Risk (0-20)
    const productServiceRisk = factors.productServiceRisk ?? this.assessProductServiceRisk(customer);
    
    // 4. Transaction Risk (0-20) - to be enhanced with actual transaction data
    const transactionRisk = factors.transactionRisk ?? 5; // Default medium-low
    
    // 5. Customer Type Risk (0-20)
    const customerTypeRisk = factors.customerTypeRisk ?? this.assessCustomerTypeRisk(customer);
    
    // Calculate total risk score
    const riskScore = geographicRisk + industryRisk + productServiceRisk + transactionRisk + customerTypeRisk;
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore <= 33) {
      riskLevel = 'low';
    } else if (riskScore <= 66) {
      riskLevel = 'medium';
    } else if (riskScore <= 89) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }
    
    return {
      riskScore,
      riskLevel,
      factors: {
        geographicRisk,
        industryRisk,
        productServiceRisk,
        transactionRisk,
        customerTypeRisk,
      },
    };
  }
  
  private assessGeographicRisk(customer: Customer): number {
    // HIGH RISK COUNTRIES (FATF blacklist/greylist, sanctions, etc.)
    const highRiskCountries = ['IR', 'KP', 'SY', 'AF', 'YE', 'MM', 'PK'];
    const mediumRiskCountries = ['IQ', 'LB', 'LY', 'SO', 'SD', 'VE', 'ZW'];
    
    const billingCountry = (customer.billingAddress as any)?.country;
    const shippingCountry = (customer.shippingAddress as any)?.country;
    
    if (billingCountry && highRiskCountries.includes(billingCountry)) {
      return 20; // Maximum geographic risk
    }
    if (shippingCountry && highRiskCountries.includes(shippingCountry)) {
      return 18;
    }
    if (billingCountry && mediumRiskCountries.includes(billingCountry)) {
      return 12;
    }
    if (shippingCountry && mediumRiskCountries.includes(shippingCountry)) {
      return 10;
    }
    
    // UAE and GCC countries (low risk)
    const gccCountries = ['AE', 'SA', 'KW', 'BH', 'QA', 'OM'];
    if (billingCountry && gccCountries.includes(billingCountry)) {
      return 2;
    }
    
    return 5; // Default moderate risk
  }
  
  private assessIndustryRisk(customer: Customer): number {
    // HIGH RISK INDUSTRIES per FATF guidelines
    const company = customer.company?.toLowerCase() || '';
    
    if (company.includes('casino') || company.includes('gaming') || company.includes('gambling')) {
      return 18;
    }
    if (company.includes('crypto') || company.includes('bitcoin') || company.includes('exchange')) {
      return 16;
    }
    if (company.includes('money') && company.includes('transfer')) {
      return 16;
    }
    if (company.includes('precious metal') || company.includes('gold') || company.includes('diamond')) {
      return 14;
    }
    if (company.includes('real estate') || company.includes('property')) {
      return 12;
    }
    if (company.includes('law firm') || company.includes('legal')) {
      return 10;
    }
    
    // LOW RISK: Standard businesses
    if (company.includes('software') || company.includes('technology') || company.includes('consulting')) {
      return 3;
    }
    
    return 5; // Default moderate risk
  }
  
  private assessProductServiceRisk(customer: Customer): number {
    // This would be enhanced based on actual product/service catalog
    // For now, use customer type as proxy
    
    const type = customer.customerType;
    
    if (type === 'business') {
      return 5; // Standard B2B transactions
    }
    
    return 3; // Individual customers typically lower risk in B2B accounting context
  }
  
  private assessCustomerTypeRisk(customer: Customer): number {
    const type = customer.customerType;
    
    if (type === 'business') {
      // Business customers need UBO verification
      return 8;
    }
    
    return 4; // Individuals
  }
  
  /**
   * Determine review frequency based on risk level
   */
  getReviewFrequency(riskLevel: string): 'monthly' | 'quarterly' | 'semi_annual' | 'annual' {
    switch (riskLevel) {
      case 'critical':
        return 'monthly';
      case 'high':
        return 'quarterly';
      case 'medium':
        return 'semi_annual';
      case 'low':
      default:
        return 'annual';
    }
  }
  
  /**
   * Calculate next review date based on risk level
   */
  getNextReviewDate(riskLevel: string): Date {
    const now = new Date();
    const frequency = this.getReviewFrequency(riskLevel);
    
    switch (frequency) {
      case 'monthly':
        return new Date(now.setMonth(now.getMonth() + 1));
      case 'quarterly':
        return new Date(now.setMonth(now.getMonth() + 3));
      case 'semi_annual':
        return new Date(now.setMonth(now.getMonth() + 6));
      case 'annual':
      default:
        return new Date(now.setFullYear(now.getFullYear() + 1));
    }
  }
  
  /**
   * Determine if Enhanced Due Diligence is required
   * Based on FATF Risk-Based Approach guidelines
   */
  isEDDRequired(customer: Customer, riskProfile: CustomerRiskProfile, beneficialOwners: any[] = []): boolean {
    // TRIGGER 1: High or Critical risk level
    if (riskProfile.overallRiskLevel === 'high' || riskProfile.overallRiskLevel === 'critical') {
      return true;
    }
    
    // TRIGGER 2: Customer is PEP or has PEP beneficial owners
    const hasPEP = beneficialOwners.some(owner => owner.isPEP);
    if (hasPEP) {
      return true;
    }
    
    // TRIGGER 3: High-risk country exposure
    const highRiskCountries = ['IR', 'KP', 'SY', 'AF', 'YE', 'MM', 'PK', 'IQ', 'LB', 'LY', 'SO', 'SD', 'VE', 'ZW'];
    const billingCountry = (customer.billingAddress as any)?.country;
    if (billingCountry && highRiskCountries.includes(billingCountry)) {
      return true;
    }
    
    // TRIGGER 4: Cash-intensive business
    if (riskProfile.cashIntensiveBusiness) {
      return true;
    }
    
    // TRIGGER 5: Sanctioned country exposure
    if (riskProfile.sanctionedCountryExposure) {
      return true;
    }
    
    return false;
  }
}
