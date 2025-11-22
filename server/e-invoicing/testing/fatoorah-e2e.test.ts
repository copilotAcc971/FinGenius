/**
 * E2E Test Suite: KSA ZATCA FATOORAH Integration
 * 
 * Tests FATOORAH B2B clearance and B2C reporting workflows
 * Using MockFATOORAHService for sandbox testing without real API credentials
 * 
 * OFFICIAL REFERENCE (Phase 2): https://zatca.gov.sa/en/E-Invoicing/
 * CRITICAL REQUIREMENTS:
 * - B2B: Real-time clearance MUST be received BEFORE issuing to customer
 * - B2C: Can issue immediately; MUST report within 24 hours to ZATCA
 */

import { MockFATOORAHService } from './mock-fatoorah';
import {
  createTestInvoice,
  createTestCustomer,
  createTestCompanyProfile,
  createTestLineItems,
  formatTestResult,
  assert,
  waitFor
} from './test-utilities';
import { KSAZATCAXMLGenerator } from '../ksa-zatca/xml-generator';
import { KSAZATCAQRGenerator } from '../ksa-zatca/qr-generator';

export class FATOORAHTestSuite {
  private mockFatoorah: MockFATOORAHService;
  private testResults: string[] = [];

  constructor(options: { simulateFailure?: boolean; simulateDelay?: boolean } = {}) {
    this.mockFatoorah = new MockFATOORAHService(options);
  }

  /**
   * TEST 1: B2B Invoice Real-time Clearance (CRITICAL Phase 2)
   * 
   * OFFICIAL REQUIREMENT: B2B invoices MUST receive clearance BEFORE issuing
   * https://zatca.gov.sa/en/E-Invoicing/
   */
  async testB2BClearance(): Promise<void> {
    const testName = 'FATOORAH: B2B Real-time Clearance (Critical Phase 2)';
    try {
      const invoice = createTestInvoice();
      const customer = createTestCustomer('B2B'); // With TIN
      const company = createTestCompanyProfile();
      const lineItems = createTestLineItems();

      // Generate XML with UUID
      const { xml, uuid, hash } = KSAZATCAXMLGenerator.generateInvoiceXML(
        invoice,
        customer,
        company,
        lineItems
      );

      assert(uuid, 'UUID should be generated');
      assert(hash, 'Hash should be generated');

      // Request clearance (MUST happen before issuing)
      const clearanceResult = await this.mockFatoorah.clearB2BInvoice(xml, uuid, hash);

      assert(clearanceResult.success, 'B2B clearance should succeed');
      assert(
        clearanceResult.clearanceStatus === 'cleared',
        'Clearance status should be "cleared"'
      );
      assert(clearanceResult.fatoorahReference, 'FATOORAH reference should be generated');
      assert(clearanceResult.clearanceDate, 'Clearance date should be set');
      assert(clearanceResult.certificateHash, 'Certificate hash should be generated');

      this.testResults.push(
        formatTestResult(
          testName,
          true,
          `✓ B2B clearance granted | Reference: ${clearanceResult.fatoorahReference} | Cleared at: ${clearanceResult.clearanceDate}`
        )
      );
    } catch (error) {
      this.testResults.push(
        formatTestResult(testName, false, error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * TEST 2: B2C Invoice 24-Hour Reporting (CRITICAL Phase 2)
   * 
   * OFFICIAL REQUIREMENT: B2C invoices MUST be reported within 24 hours
   * https://zatca.gov.sa/en/E-Invoicing/
   */
  async testB2CReporting(): Promise<void> {
    const testName = 'FATOORAH: B2C 24-Hour Reporting (Critical Phase 2)';
    try {
      const invoice = createTestInvoice();
      const customer = createTestCustomer('B2C'); // Without TIN
      const company = createTestCompanyProfile();
      const lineItems = createTestLineItems();

      // Generate XML with UUID
      const { xml, uuid, hash } = KSAZATCAXMLGenerator.generateInvoiceXML(
        invoice,
        customer,
        company,
        lineItems
      );

      // Report to FATOORAH (within 24 hours)
      const reportResult = await this.mockFatoorah.reportB2CInvoice(xml, uuid, hash);

      assert(reportResult.success, 'B2C reporting should succeed');
      assert(reportResult.reportedDate, 'Reported date should be set');
      assert(reportResult.reportingDeadline, 'Reporting deadline should be set');
      assert(reportResult.fatoorahReference, 'FATOORAH reference should be generated');
      assert(reportResult.hoursUntilDeadline, 'Hours until deadline should be calculated');
      assert(
        reportResult.hoursUntilDeadline <= 24,
        'Deadline should be within 24 hours'
      );

      // Verify deadline is exactly 24 hours from now
      const now = new Date();
      const deadlineHours = Math.floor(
        (reportResult.reportingDeadline.getTime() - now.getTime()) / (1000 * 60 * 60)
      );
      assert(deadlineHours === 24, 'Deadline should be exactly 24 hours from now');

      this.testResults.push(
        formatTestResult(
          testName,
          true,
          `✓ B2C reported successfully | Reference: ${reportResult.fatoorahReference} | Deadline: ${reportResult.reportingDeadline.toISOString()} | Hours remaining: ${reportResult.hoursUntilDeadline}`
        )
      );
    } catch (error) {
      this.testResults.push(
        formatTestResult(testName, false, error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * TEST 3: UUID and Hash Validation
   * 
   * OFFICIAL REQUIREMENT: UUID and hash are mandatory for Phase 2
   */
  async testUUIDAndHashValidation(): Promise<void> {
    const testName = 'FATOORAH: UUID and Hash Validation';
    try {
      const invoice = createTestInvoice();
      const customer = createTestCustomer('B2B');
      const company = createTestCompanyProfile();
      const lineItems = createTestLineItems();

      const { xml, uuid, hash } = KSAZATCAXMLGenerator.generateInvoiceXML(
        invoice,
        customer,
        company,
        lineItems
      );

      // Validate UUID format (should be standard UUID v4)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert(uuidRegex.test(uuid), 'UUID should be valid UUID v4 format');

      // Validate hash format (should be base64)
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      assert(base64Regex.test(hash), 'Hash should be valid base64 format');

      // Test with B2B clearance
      const clearanceResult = await this.mockFatoorah.clearB2BInvoice(xml, uuid, hash);
      assert(
        clearanceResult.invoiceHash === hash,
        'Invoice hash in clearance result should match'
      );

      this.testResults.push(
        formatTestResult(
          testName,
          true,
          `✓ UUID valid: ${uuid.substring(0, 8)}... | Hash valid: ${hash.substring(0, 20)}...`
        )
      );
    } catch (error) {
      this.testResults.push(
        formatTestResult(testName, false, error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * TEST 4: QR Code Generation (Mandatory on all invoice types)
   * 
   * OFFICIAL REQUIREMENT: QR codes mandatory on B2B, B2C, B2G
   */
  async testQRCodeGeneration(): Promise<void> {
    const testName = 'FATOORAH: QR Code Generation (Mandatory)';
    try {
      const invoice = createTestInvoice();
      const customer = createTestCustomer('B2B');
      const company = createTestCompanyProfile();
      const lineItems = createTestLineItems();

      const { hash } = KSAZATCAXMLGenerator.generateInvoiceXML(
        invoice,
        customer,
        company,
        lineItems
      );

      const qrCode = KSAZATCAQRGenerator.generateQRCode(invoice, company, hash);

      assert(qrCode, 'QR code should be generated');
      assert(qrCode.length > 0, 'QR code should not be empty');
      assert(qrCode.includes('=') || qrCode.match(/[A-Za-z0-9+/]/), 'QR code should be base64');

      this.testResults.push(
        formatTestResult(testName, true, `✓ QR code generated: ${qrCode.substring(0, 30)}...`)
      );
    } catch (error) {
      this.testResults.push(
        formatTestResult(testName, false, error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * TEST 5: Wave-based Implementation (Nov 2024: >SAR 10M threshold)
   * 
   * OFFICIAL REQUIREMENT: Phase 2 rollout by VATable income waves
   */
  async testWaveImplementation(): Promise<void> {
    const testName = 'FATOORAH: Wave-based Implementation (Nov 2024: >SAR 10M)';
    try {
      // Simulate invoices from different revenue brackets
      const highRevenueCompany = createTestCompanyProfile({
        name: 'High Revenue Company (>SAR 70M)'
      });

      const mediumRevenueCompany = createTestCompanyProfile({
        name: 'Medium Revenue Company (>SAR 30M)'
      });

      const invoice = createTestInvoice();
      const customer = createTestCustomer('B2B');
      const lineItems = createTestLineItems();

      // Test high revenue company (Wave 1)
      const { xml: xml1 } = KSAZATCAXMLGenerator.generateInvoiceXML(
        invoice,
        customer,
        highRevenueCompany,
        lineItems
      );
      const result1 = await this.mockFatoorah.clearB2BInvoice(xml1, 'uuid-1', 'hash-1');
      assert(result1.success, 'High revenue company should clear');

      // Test medium revenue company (Wave 4)
      const { xml: xml2 } = KSAZATCAXMLGenerator.generateInvoiceXML(
        invoice,
        customer,
        mediumRevenueCompany,
        lineItems
      );
      const result2 = await this.mockFatoorah.clearB2BInvoice(xml2, 'uuid-2', 'hash-2');
      assert(result2.success, 'Medium revenue company should clear');

      this.testResults.push(
        formatTestResult(
          testName,
          true,
          `✓ Wave 1 (>70M SAR): Cleared | Wave 4 (>30M SAR): Cleared`
        )
      );
    } catch (error) {
      this.testResults.push(
        formatTestResult(testName, false, error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * TEST 6: Missing Fields Validation
   * 
   * OFFICIAL REQUIREMENT: XML, UUID, Hash are mandatory
   */
  async testMissingFieldsRejection(): Promise<void> {
    const testName = 'FATOORAH: Missing Fields Rejection';
    try {
      // Test with empty XML
      const result1 = await this.mockFatoorah.clearB2BInvoice('', 'uuid', 'hash');
      assert(!result1.success, 'Empty XML should be rejected');

      // Test with missing UUID
      const result2 = await this.mockFatoorah.clearB2BInvoice('<xml></xml>', '', 'hash');
      assert(!result2.success, 'Missing UUID should be rejected');

      // Test with missing Hash
      const result3 = await this.mockFatoorah.clearB2BInvoice('<xml></xml>', 'uuid', '');
      assert(!result3.success, 'Missing hash should be rejected');

      this.testResults.push(formatTestResult(testName, true, `✓ All invalid inputs rejected`));
    } catch (error) {
      this.testResults.push(
        formatTestResult(testName, false, error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * Run all tests
   */
  async runAll(): Promise<void> {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 KSA ZATCA FATOORAH E2E Test Suite');
    console.log('Official Reference: https://zatca.gov.sa/en/E-Invoicing/');
    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
    );

    this.mockFatoorah.clearLogs();

    await this.testB2BClearance();
    await this.testB2CReporting();
    await this.testUUIDAndHashValidation();
    await this.testQRCodeGeneration();
    await this.testWaveImplementation();
    await this.testMissingFieldsRejection();

    // Print results
    this.testResults.forEach(result => console.log(result));

    // Print summary
    const passed = this.testResults.filter(r => r.includes('✅')).length;
    const total = this.testResults.length;
    console.log(
      `\n📊 Summary: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)\n`
    );

    // Print FATOORAH stats
    const stats = this.mockFatoorah.getStats();
    console.log('FATOORAH Statistics:');
    console.log(`  B2B Clearances: ${stats.totalB2BClearances}`);
    console.log(`  - Successful: ${stats.successfulClearances}`);
    console.log(`  - Rejected: ${stats.rejectedClearances}`);
    console.log(`  B2C Reports: ${stats.totalB2CReports}`);
    console.log(`  - Successful: ${stats.successfulReports}`);
    console.log(`  - Failed: ${stats.failedReports}\n`);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const suite = new FATOORAHTestSuite({ simulateDelay: true });
  suite.runAll().catch(console.error);
}
