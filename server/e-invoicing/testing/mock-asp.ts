/**
 * Mock ASP (Access Point Service Provider) for E2E Testing
 * 
 * Simulates UAE Peppol ASP behavior for local testing without real ASP credentials.
 * This is useful for development and E2E testing of Peppol workflows.
 * 
 * Real ASPs: Tradeshift, TietoEVRY, Pagero, Basware, etc.
 */

export interface MockASPTransmissionResult {
  success: boolean;
  aspReference?: string;
  status: 'accepted' | 'rejected' | 'pending';
  message: string;
  timestamp: Date;
  invoiceNumber?: string;
}

export interface MockASPStatusResult {
  status: 'pending' | 'transmitted' | 'delivered' | 'failed';
  message: string;
  updatedAt: Date;
  aspReference: string;
}

export class MockASPService {
  private transmissionLog: Map<string, MockASPTransmissionResult> = new Map();
  private statusLog: Map<string, MockASPStatusResult> = new Map();

  constructor(private options: { simulateFailure?: boolean; simulateDelay?: boolean } = {}) {}

  /**
   * Simulate ASP transmission with realistic behavior
   * 
   * @param ublXml - UBL 2.1 XML invoice
   * @param invoiceNumber - Invoice number for reference
   * @returns Mock transmission result
   */
  async transmitInvoice(
    ublXml: string,
    invoiceNumber: string
  ): Promise<MockASPTransmissionResult> {
    // Simulate network delay (optional)
    if (this.options.simulateDelay) {
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    }

    // Validate XML format
    if (!ublXml.includes('<?xml') || !ublXml.includes('<Invoice')) {
      return {
        success: false,
        status: 'rejected',
        message: 'Invalid UBL XML format',
        timestamp: new Date()
      };
    }

    // Simulate occasional failures
    if (this.options.simulateFailure && Math.random() < 0.1) {
      const result: MockASPTransmissionResult = {
        success: false,
        status: 'rejected',
        message: 'ASP service temporarily unavailable (simulated failure)',
        timestamp: new Date(),
        invoiceNumber
      };
      return result;
    }

    // Simulate size validation
    if (ublXml.length > 1000000) {
      return {
        success: false,
        status: 'rejected',
        message: 'XML exceeds maximum size (1MB)',
        timestamp: new Date(),
        invoiceNumber
      };
    }

    // Generate ASP reference
    const aspReference = `ASP-${Date.now()}-${invoiceNumber.substring(0, 6)}`;

    // Log transmission
    const result: MockASPTransmissionResult = {
      success: true,
      aspReference,
      status: 'accepted',
      message: 'Invoice accepted for Peppol transmission',
      timestamp: new Date(),
      invoiceNumber
    };

    this.transmissionLog.set(aspReference, result);

    // Auto-update status to transmitted after delay
    setTimeout(() => {
      this.statusLog.set(aspReference, {
        status: 'transmitted',
        message: 'Invoice transmitted to Peppol network',
        updatedAt: new Date(),
        aspReference
      });
    }, 2000);

    return result;
  }

  /**
   * Check transmission status with ASP
   * 
   * @param aspReference - ASP transaction reference
   * @returns Current transmission status
   */
  async checkStatus(aspReference: string): Promise<MockASPStatusResult> {
    // Simulate network delay (optional)
    if (this.options.simulateDelay) {
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 500));
    }

    const status = this.statusLog.get(aspReference);
    
    if (!status) {
      // Return default status if not found
      return {
        status: 'pending',
        message: 'Transmission status pending',
        updatedAt: new Date(),
        aspReference
      };
    }

    return status;
  }

  /**
   * Get transmission log for testing/debugging
   */
  getTransmissionLog(aspReference?: string): MockASPTransmissionResult[] {
    if (aspReference) {
      const result = this.transmissionLog.get(aspReference);
      return result ? [result] : [];
    }
    return Array.from(this.transmissionLog.values());
  }

  /**
   * Clear logs for fresh test runs
   */
  clearLogs(): void {
    this.transmissionLog.clear();
    this.statusLog.clear();
  }

  /**
   * Get statistics for testing
   */
  getStats(): {
    totalTransmissions: number;
    successfulTransmissions: number;
    failedTransmissions: number;
    pendingStatus: number;
    deliveredStatus: number;
  } {
    const transmissions = Array.from(this.transmissionLog.values());
    const statuses = Array.from(this.statusLog.values());

    return {
      totalTransmissions: transmissions.length,
      successfulTransmissions: transmissions.filter(t => t.success).length,
      failedTransmissions: transmissions.filter(t => !t.success).length,
      pendingStatus: statuses.filter(s => s.status === 'pending').length,
      deliveredStatus: statuses.filter(s => s.status === 'delivered').length
    };
  }
}
