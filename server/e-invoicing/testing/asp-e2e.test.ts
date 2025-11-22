/**
 * E2E Test Suite: UAE Peppol ASP Integration
 * 
 * Tests ASP transmission workflows without real ASP credentials
 * Using MockASPService for local sandbox testing
 * 
 * OFFICIAL REFERENCE: https://docs.peppol.eu/poac/ae/2025-Q2/pint-ae/
 */

import { MockASPService } from './mock-asp';
import { 
  createTestInvoice, 
  createTestCustomer, 
  createTestCompanyProfile,
  createTestLineItems,
  formatTestResult,
  assert
} from './test-utilities';
import { UAEPeppolUBLGenerator } from '../uae-peppol/ubl-generator';
import { UAEPeppolQRGenerator } from '../uae-peppol/qr-generator';

export class ASPTestSuite {
  private mockASP: MockASPService;
  private testResults: string[] = [];

  constructor(options: { simulateFailure?: boolean; simulateDelay?: boolean } = {}) {
    this.mockASP = new MockASPService(options);
  }

  /**
   * TEST 1: Basic invoice transmission
   */
  async testBasicTransmission(): Promise<void> {
    const testName = 'ASP: Basic Invoice Transmission';
    try {
      const invoice = createTestInvoice();
      const customer = createTestCustomer('B2B');
      const company = createTestCompanyProfile();
      const lineItems = createTestLineItems();

      // Generate UBL XML
      const ublXml = UAEPeppolUBLGenerator.generateInvoiceUBL(
        invoice,
        customer,
        company,
        lineItems
      );

      assert(ublXml.includes('<?xml'), 'UBL XML should contain XML declaration');
      assert(ublXml.includes('Invoice'), 'UBL XML should contain Invoice element');
      assert(
        ublXml.includes('urn:peppol:pint:billing-1@ae-1'),
        'UBL XML should have PINT-AE CustomizationID'
      );

      // Transmit via mock ASP
      const result = await this.mockASP.transmitInvoice(ublXml, invoice.invoiceNumber);

      assert(result.success, 'Transmission should succeed');
      assert(result.aspReference, 'ASP reference should be generated');
      assert(result.status === 'accepted', 'Transmission status should be accepted');
      assert(result.invoiceNumber === invoice.invoiceNumber, 'Invoice number should match');

      this.testResults.push(
        formatTestResult(testName, true, `ASP Reference: ${result.aspReference}`)
      );
    } catch (error) {
      this.testResults.push(
        formatTestResult(testName, false, error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * TEST 2: QR code generation with transmission
   */
  async testQRCodeGeneration(): Promise<void> {
    const testName = 'ASP: QR Code with Transmission';
    try {
      const invoice = createTestInvoice();
      const customer = createTestCustomer('B2B');
      const company = createTestCompanyProfile();
      const lineItems = createTestLineItems();

      // Generate UBL XML
      const ublXml = UAEPeppolUBLGenerator.generateInvoiceUBL(
        invoice,
        customer,
        company,
        lineItems
      );

      // Generate QR code
      const qrCode = UAEPeppolQRGenerator.generateQRCode(invoice, company);

      assert(qrCode, 'QR code should be generated');
      assert(qrCode.length > 0, 'QR code should not be empty');

      // Decode and verify QR code
      const decodedQR = UAEPeppolQRGenerator.decodeQRCode(qrCode);
      assert(decodedQR[1], 'QR code should contain seller name (tag 1)');
      assert(decodedQR[2], 'QR code should contain VAT/TIN (tag 2)');
      assert(decodedQR[4], 'QR code should contain total amount (tag 4)');
      assert(decodedQR[5], 'QR code should contain VAT amount (tag 5)');

      // Transmit
      const result = await this.mockASP.transmitInvoice(ublXml, invoice.invoiceNumber);
      assert(result.success, 'Transmission with QR code should succeed');

      this.testResults.push(
        formatTestResult(testName, true, `QR Code: ${qrCode.substring(0, 30)}...`)
      );
    } catch (error) {
      this.testResults.push(
        formatTestResult(testName, false, error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * TEST 3: Multiple invoice transmission
   */
  async testMultipleTransmissions(): Promise<void> {
    const testName = 'ASP: Multiple Invoice Transmissions';
    try {
      const company = createTestCompanyProfile();
      const invoices = [];
      const aspReferences = [];

      for (let i = 0; i < 3; i++) {
        const invoice = createTestInvoice({ invoiceNumber: `TEST-MULTI-${i}` });
        const customer = createTestCustomer('B2B');
        const lineItems = createTestLineItems();

        const ublXml = UAEPeppolUBLGenerator.generateInvoiceUBL(
          invoice,
          customer,
          company,
          lineItems
        );

        const result = await this.mockASP.transmitInvoice(ublXml, invoice.invoiceNumber);
        assert(result.success, `Transmission ${i + 1} should succeed`);
        aspReferences.push(result.aspReference);
        invoices.push(invoice);
      }

      assert(invoices.length === 3, 'Should transmit 3 invoices');
      assert(aspReferences.length === 3, 'Should get 3 ASP references');

      const stats = this.mockASP.getStats();
      assert(stats.totalTransmissions === 3, 'Stats should show 3 transmissions');
      assert(stats.successfulTransmissions === 3, 'All transmissions should succeed');

      this.testResults.push(
        formatTestResult(
          testName,
          true,
          `Transmitted ${stats.totalTransmissions} invoices, ${stats.successfulTransmissions} successful`
        )
      );
    } catch (error) {
      this.testResults.push(
        formatTestResult(testName, false, error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * TEST 4: Status checking
   */
  async testStatusChecking(): Promise<void> {
    const testName = 'ASP: Transmission Status Checking';
    try {
      const invoice = createTestInvoice();
      const customer = createTestCustomer('B2B');
      const company = createTestCompanyProfile();
      const lineItems = createTestLineItems();

      const ublXml = UAEPeppolUBLGenerator.generateInvoiceUBL(
        invoice,
        customer,
        company,
        lineItems
      );

      const transmitResult = await this.mockASP.transmitInvoice(ublXml, invoice.invoiceNumber);
      assert(transmitResult.success, 'Transmission should succeed');

      const aspReference = transmitResult.aspReference!;

      // Wait a moment for status to update
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Check status
      const status = await this.mockASP.checkStatus(aspReference);
      assert(status.status === 'transmitted', 'Status should be transmitted after transmission');
      assert(status.aspReference === aspReference, 'ASP reference should match');

      this.testResults.push(
        formatTestResult(
          testName,
          true,
          `Status: ${status.status}, Reference: ${aspReference}`
        )
      );
    } catch (error) {
      this.testResults.push(
        formatTestResult(testName, false, error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }

  /**
   * TEST 5: Invalid XML rejection
   */
  async testInvalidXMLRejection(): Promise<void> {
    const testName = 'ASP: Invalid XML Rejection';
    try {
      const invalidXml = '<Invalid>This is not a valid invoice</Invalid>';

      const result = await this.mockASP.transmitInvoice(invalidXml, 'INVALID-TEST');

      assert(!result.success, 'Invalid XML should be rejected');
      assert(result.status === 'rejected', 'Status should be rejected');

      this.testResults.push(
        formatTestResult(testName, true, `Rejected with reason: ${result.message}`)
      );
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
    console.log('🧪 UAE Peppol ASP E2E Test Suite');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    this.mockASP.clearLogs();

    await this.testBasicTransmission();
    await this.testQRCodeGeneration();
    await this.testMultipleTransmissions();
    await this.testStatusChecking();
    await this.testInvalidXMLRejection();

    // Print results
    this.testResults.forEach(result => console.log(result));

    // Print summary
    const passed = this.testResults.filter(r => r.includes('✅')).length;
    const total = this.testResults.length;
    console.log(
      `\n📊 Summary: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)\n`
    );

    // Print ASP stats
    const stats = this.mockASP.getStats();
    console.log('ASP Statistics:');
    console.log(`  Total Transmissions: ${stats.totalTransmissions}`);
    console.log(`  Successful: ${stats.successfulTransmissions}`);
    console.log(`  Failed: ${stats.failedTransmissions}`);
    console.log(`  Pending Status: ${stats.pendingStatus}`);
    console.log(`  Delivered Status: ${stats.deliveredStatus}\n`);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const suite = new ASPTestSuite({ simulateDelay: true });
  suite.runAll().catch(console.error);
}
