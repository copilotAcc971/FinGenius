import { UAEPeppolUBLGenerator } from './ubl-generator';
import { UAEPeppolQRGenerator } from './qr-generator';
import { UAEPeppolASPService } from './asp-service';
import type { IStorage } from '../../storage';

/**
 * UAE Peppol Service - Main Orchestration Layer
 * 
 * Implements PINT-AE (Peppol International Model - Arab Emirates) e-invoicing
 * in compliance with UAE Ministry of Finance official specifications.
 * 
 * OFFICIAL SPECIFICATIONS:
 * - PINT AE Billing: https://docs.peppol.eu/poac/ae/2025-Q2/pint-ae/
 * - Test Specifications: https://test-docs.peppol.eu/pint/pint-ae/pint-ae/bis/
 * - UAE eInvoicing Portal: https://mof.gov.ae/einvoicing/
 * - Official Guidelines: https://docs.peppol.eu/poac/ae/2025-Q2/
 * 
 * Key Compliance Requirements:
 * - UBL 2.1 XML format with CustomizationID: urn:peppol:pint:billing-1@ae-1
 * - TLV (Tag-Length-Value) QR code generation
 * - Invoice transmission within 14 days of invoice date
 * - Document type codes: 380 (Tax Invoice), 381 (Tax Credit Note), 480 (Out of Scope), 81 (Credit Note)
 * - VAT amount and total payable mandatory in AED per UAE VAT regulations
 * - Tax identification number (TIN) required for both supplier and buyer
 * - Transmission via Accredited Service Provider (ASP) using DCTCE 5-corner model
 * - Audit trail preservation for all operations
 * 
 * Timeline:
 * - Q4 2024: Service provider accreditation
 * - Q2 2025: Legislation updates & system testing
 * - July 2026: Phase 1 go-live (pilot)
 * - January 2027: Mandatory for large businesses (revenue ≥ AED 50 million)
 */
export class UAEPeppolService {
  private aspService: UAEPeppolASPService;
  
  constructor(private storage: IStorage) {
    this.aspService = new UAEPeppolASPService();
  }
  
  /**
   * Prepare invoice for Peppol transmission
   * - Generate UBL 2.1 XML
   * - Generate TLV QR code
   * - Calculate 14-day transmission deadline
   * - Store data in invoice record
   * 
   * @param tenantId - Tenant ID
   * @param invoiceId - Invoice ID
   * @returns Preparation result with UBL XML and QR code
   */
  async prepareInvoice(tenantId: string, invoiceId: string): Promise<{
    success: boolean;
    ublXml?: string;
    qrCode?: string;
    transmissionDeadline?: Date;
    error?: string;
  }> {
    try {
      // Get invoice with related data
      const invoice = await this.storage.getInvoice(invoiceId);
      if (!invoice || invoice.tenantId !== tenantId) {
        return { success: false, error: 'Invoice not found' };
      }
      
      // Get customer
      const customer = await this.storage.getCustomer(invoice.customerId);
      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }
      
      // Get company profile
      const companyProfile = await this.storage.getCompanyProfile(tenantId);
      if (!companyProfile) {
        return { success: false, error: 'Company profile not found - please configure company settings' };
      }
      
      // Get invoice line items
      const lineItems = await this.storage.getInvoiceLineItems(invoiceId, tenantId);
      if (!lineItems || lineItems.length === 0) {
        return { success: false, error: 'Invoice has no line items' };
      }
      
      // Generate UBL 2.1 XML
      const ublXml = UAEPeppolUBLGenerator.generateInvoiceUBL(
        invoice,
        customer,
        companyProfile,
        lineItems
      );
      
      // Generate TLV QR code
      const qrCode = UAEPeppolQRGenerator.generateQRCode(invoice, companyProfile);
      
      // Calculate transmission deadline (invoice date + 14 days)
      const transmissionDeadline = new Date(invoice.invoiceDate);
      transmissionDeadline.setDate(transmissionDeadline.getDate() + 14);
      
      // Update invoice with Peppol data
      await this.storage.updateInvoice(invoiceId, tenantId, {
        peppolUblXml: ublXml,
        peppolQrCode: qrCode,
        peppolTransmissionDeadline: transmissionDeadline,
        peppolTransmissionStatus: 'pending'
      });
      
      console.log(`[UAE Peppol] Invoice ${invoice.invoiceNumber} prepared for transmission`);
      console.log(`[UAE Peppol] Transmission deadline: ${transmissionDeadline.toISOString()}`);
      
      return {
        success: true,
        ublXml,
        qrCode,
        transmissionDeadline
      };
    } catch (error) {
      console.error('[UAE Peppol] Preparation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown preparation error'
      };
    }
  }
  
  /**
   * Transmit invoice to Peppol network via ASP
   * - Verify invoice is prepared
   * - Check transmission deadline
   * - Submit to ASP
   * - Update invoice status
   * 
   * @param tenantId - Tenant ID
   * @param invoiceId - Invoice ID
   * @returns Transmission result with ASP reference
   */
  async transmitInvoice(tenantId: string, invoiceId: string): Promise<{
    success: boolean;
    aspReference?: string;
    error?: string;
  }> {
    try {
      // Get invoice
      const invoice = await this.storage.getInvoice(invoiceId);
      if (!invoice || invoice.tenantId !== tenantId) {
        return { success: false, error: 'Invoice not found' };
      }
      
      // Verify invoice is prepared
      if (!invoice.peppolUblXml) {
        return { 
          success: false, 
          error: 'Invoice not prepared for Peppol - please prepare invoice first' 
        };
      }
      
      // Check if already transmitted
      if (invoice.peppolTransmissionStatus === 'transmitted') {
        return {
          success: false,
          error: 'Invoice already transmitted',
          aspReference: invoice.peppolAspReference || undefined
        };
      }
      
      // Check deadline (warn if past, but allow transmission)
      if (invoice.peppolTransmissionDeadline && new Date() > invoice.peppolTransmissionDeadline) {
        console.warn(`[UAE Peppol] Invoice ${invoice.invoiceNumber} transmission is past 14-day deadline`);
      }
      
      // Transmit via ASP
      const result = await this.aspService.transmitInvoice(
        invoice.peppolUblXml,
        invoice.invoiceNumber
      );
      
      if (result.success) {
        // Update invoice status to transmitted
        await this.storage.updateInvoice(invoiceId, tenantId, {
          peppolTransmittedAt: new Date(),
          peppolTransmissionStatus: 'transmitted',
          peppolAspReference: result.aspReference
        });
        
        console.log(`[UAE Peppol] Invoice ${invoice.invoiceNumber} transmitted successfully`);
        console.log(`[UAE Peppol] ASP Reference: ${result.aspReference}`);
      } else {
        // Update invoice status to failed
        await this.storage.updateInvoice(invoiceId, tenantId, {
          peppolTransmissionStatus: 'failed'
        });
        
        console.error(`[UAE Peppol] Invoice ${invoice.invoiceNumber} transmission failed: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      console.error('[UAE Peppol] Transmission error:', error);
      
      // Try to update invoice status to failed
      try {
        await this.storage.updateInvoice(invoiceId, tenantId, {
          peppolTransmissionStatus: 'failed'
        });
      } catch (updateError) {
        console.error('[UAE Peppol] Failed to update invoice status:', updateError);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown transmission error'
      };
    }
  }
  
  /**
   * Get Peppol status for an invoice
   * 
   * @param tenantId - Tenant ID
   * @param invoiceId - Invoice ID
   * @returns Peppol status information
   */
  async getStatus(tenantId: string, invoiceId: string): Promise<{
    status: string;
    transmissionDeadline: Date | null;
    transmittedAt: Date | null;
    aspReference: string | null;
    hasQrCode: boolean;
    hasUblXml: boolean;
  } | null> {
    try {
      const invoice = await this.storage.getInvoice(invoiceId);
      if (!invoice || invoice.tenantId !== tenantId) {
        return null;
      }
      
      return {
        status: invoice.peppolTransmissionStatus || 'not_prepared',
        transmissionDeadline: invoice.peppolTransmissionDeadline,
        transmittedAt: invoice.peppolTransmittedAt,
        aspReference: invoice.peppolAspReference,
        hasQrCode: !!invoice.peppolQrCode,
        hasUblXml: !!invoice.peppolUblXml
      };
    } catch (error) {
      console.error('[UAE Peppol] Status check error:', error);
      return null;
    }
  }
  
  /**
   * Check if ASP is configured for this tenant
   * 
   * @returns True if ASP credentials are configured
   */
  isASPConfigured(): boolean {
    return this.aspService.isConfigured();
  }
}
