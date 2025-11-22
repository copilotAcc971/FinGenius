/**
 * Mock FATOORAH (KSA ZATCA) Service for E2E Testing
 * 
 * Simulates FATOORAH behavior for sandbox testing without real API credentials.
 * Supports both B2B clearance and B2C reporting workflows per official Phase 2 requirements.
 * 
 * Official Reference: https://zatca.gov.sa/en/E-Invoicing/
 */

export interface MockFATOORAHClearanceResult {
  success: boolean;
  clearanceStatus: 'cleared' | 'rejected';
  clearanceDate?: Date;
  rejectionReason?: string;
  fatoorahReference?: string;
  certificateHash?: string;
  invoiceHash?: string;
}

export interface MockFATOORAHReportingResult {
  success: boolean;
  reportedDate?: Date;
  reportingDeadline?: Date;
  fatoorahReference?: string;
  hoursUntilDeadline?: number;
  message: string;
}

export class MockFATOORAHService {
  private clearanceLog: Map<string, MockFATOORAHClearanceResult> = new Map();
  private reportingLog: Map<string, MockFATOORAHReportingResult> = new Map();

  constructor(private options: { simulateFailure?: boolean; simulateDelay?: boolean } = {}) {}

  /**
   * B2B Invoice Clearance (Real-time) - CRITICAL Phase 2 Requirement
   * 
   * OFFICIAL REQUIREMENT:
   * - B2B invoices MUST receive clearance BEFORE issuing to customer
   * - Cannot be issued until clearance status = 'cleared'
   * 
   * https://zatca.gov.sa/en/E-Invoicing/
   */
  async clearB2BInvoice(
    xml: string,
    uuid: string,
    hash: string
  ): Promise<MockFATOORAHClearanceResult> {
    // Simulate network delay
    if (this.options.simulateDelay) {
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
    }

    // Validate inputs
    if (!xml || !uuid || !hash) {
      return {
        success: false,
        clearanceStatus: 'rejected',
        rejectionReason: 'Missing required fields: XML, UUID, or Hash',
        fatoorahReference: `REJECT-${Date.now()}`
      };
    }

    // Simulate validation failure
    if (xml.length < 100) {
      return {
        success: false,
        clearanceStatus: 'rejected',
        rejectionReason: 'XML document too small - validation failed',
        fatoorahReference: `REJECT-${Date.now()}`
      };
    }

    // Simulate occasional failures
    if (this.options.simulateFailure && Math.random() < 0.05) {
      return {
        success: false,
        clearanceStatus: 'rejected',
        rejectionReason: 'FATOORAH service temporarily unavailable (simulated)',
        fatoorahReference: `REJECT-${Date.now()}`
      };
    }

    // Generate cryptographic hash for certificate
    const certificateHash = this.generateMockHash(uuid);
    const fatoorahReference = `CLEAR-${uuid.substring(0, 8)}-${Date.now()}`;

    const result: MockFATOORAHClearanceResult = {
      success: true,
      clearanceStatus: 'cleared',
      clearanceDate: new Date(),
      fatoorahReference,
      certificateHash,
      invoiceHash: hash
    };

    this.clearanceLog.set(fatoorahReference, result);

    console.log(`[MockFATOORAH] B2B Clearance Successful - Reference: ${fatoorahReference}`);

    return result;
  }

  /**
   * B2C Invoice Reporting (Within 24 hours) - CRITICAL Phase 2 Requirement
   * 
   * OFFICIAL REQUIREMENT:
   * - B2C invoices CAN be issued immediately to customer
   * - MUST be reported to ZATCA within 24 hours of generation
   * - Late reporting beyond 24 hours triggers penalties (SAR 5,000+)
   * 
   * https://zatca.gov.sa/en/E-Invoicing/
   */
  async reportB2CInvoice(
    xml: string,
    uuid: string,
    hash: string
  ): Promise<MockFATOORAHReportingResult> {
    // Simulate network delay
    if (this.options.simulateDelay) {
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 800));
    }

    // Validate inputs
    if (!xml || !uuid || !hash) {
      return {
        success: false,
        message: 'Missing required fields: XML, UUID, or Hash',
        reportingDeadline: this.calculateDeadline()
      };
    }

    // Calculate 24-hour deadline
    const reportingDeadline = this.calculateDeadline();
    const now = new Date();
    const hoursUntilDeadline = Math.ceil(
      (reportingDeadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    // Simulate occasional failures
    if (this.options.simulateFailure && Math.random() < 0.05) {
      return {
        success: false,
        message: 'FATOORAH service temporarily unavailable (simulated)',
        reportingDeadline,
        hoursUntilDeadline
      };
    }

    // Check if reporting deadline has passed (should not happen in normal operation)
    if (hoursUntilDeadline < 0) {
      return {
        success: false,
        message: 'Reporting deadline has passed - 24 hours exceeded',
        reportingDeadline,
        hoursUntilDeadline
      };
    }

    const fatoorahReference = `REPORT-${uuid.substring(0, 8)}-${Date.now()}`;
    const reportedDate = new Date();

    const result: MockFATOORAHReportingResult = {
      success: true,
      reportedDate,
      reportingDeadline,
      fatoorahReference,
      hoursUntilDeadline,
      message: `Invoice reported successfully. Deadline: ${reportingDeadline.toISOString()}`
    };

    this.reportingLog.set(fatoorahReference, result);

    console.log(
      `[MockFATOORAH] B2C Reporting Successful - Reference: ${fatoorahReference}, Hours until deadline: ${hoursUntilDeadline}`
    );

    return result;
  }

  /**
   * Get clearance log for testing/debugging
   */
  getClearanceLog(fatoorahReference?: string): MockFATOORAHClearanceResult[] {
    if (fatoorahReference) {
      const result = this.clearanceLog.get(fatoorahReference);
      return result ? [result] : [];
    }
    return Array.from(this.clearanceLog.values());
  }

  /**
   * Get reporting log for testing/debugging
   */
  getReportingLog(fatoorahReference?: string): MockFATOORAHReportingResult[] {
    if (fatoorahReference) {
      const result = this.reportingLog.get(fatoorahReference);
      return result ? [result] : [];
    }
    return Array.from(this.reportingLog.values());
  }

  /**
   * Clear logs for fresh test runs
   */
  clearLogs(): void {
    this.clearanceLog.clear();
    this.reportingLog.clear();
  }

  /**
   * Get statistics for testing
   */
  getStats(): {
    totalB2BClearances: number;
    successfulClearances: number;
    rejectedClearances: number;
    totalB2CReports: number;
    successfulReports: number;
    failedReports: number;
  } {
    const clearances = Array.from(this.clearanceLog.values());
    const reports = Array.from(this.reportingLog.values());

    return {
      totalB2BClearances: clearances.length,
      successfulClearances: clearances.filter(c => c.success).length,
      rejectedClearances: clearances.filter(c => !c.success).length,
      totalB2CReports: reports.length,
      successfulReports: reports.filter(r => r.success).length,
      failedReports: reports.filter(r => !r.success).length
    };
  }

  /**
   * Helper: Calculate 24-hour reporting deadline
   */
  private calculateDeadline(): Date {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 24);
    return deadline;
  }

  /**
   * Helper: Generate mock cryptographic hash
   */
  private generateMockHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 64);
  }
}
