import { KSAZATCAXMLGenerator } from './xml-generator';
import { KSAZATCAQRGenerator } from './qr-generator';
import { FATOORAHService } from './fatoorah-service';
import type { IStorage } from '../../storage';
import type { InvoiceLineItem } from '@shared/schema';

export class KSAZATCAService {
  private fatoorahService: FATOORAHService;
  
  constructor(private storage: IStorage) {
    this.fatoorahService = new FATOORAHService();
  }
  
  /**
   * Prepare invoice for ZATCA compliance
   */
  async prepareInvoice(tenantId: string, invoiceId: string): Promise<{
    success: boolean;
    xml?: string;
    uuid?: string;
    hash?: string;
    qrCode?: string;
    invoiceType?: 'B2B' | 'B2C';
    error?: string;
  }> {
    try {
      const invoice = await this.storage.getInvoice(invoiceId);
      if (!invoice || invoice.tenantId !== tenantId) {
        return { success: false, error: 'Invoice not found' };
      }
      
      const customer = await this.storage.getCustomer(invoice.customerId);
      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }
      
      const companyProfile = await this.storage.getCompanyProfile(tenantId);
      if (!companyProfile) {
        return { success: false, error: 'Company profile not found' };
      }
      
      // Get line items
      const lineItems = await this.storage.getInvoiceLineItems(invoiceId, tenantId);
      if (!lineItems || lineItems.length === 0) {
        return { success: false, error: 'Invoice must have line items' };
      }
      
      // Get previous invoice hash for hash chaining
      const previousInvoiceHash = invoice.zatcaPreviousInvoiceHash;
      
      // Generate ZATCA XML with UUID and hash
      const { xml, uuid, hash } = KSAZATCAXMLGenerator.generateInvoiceXML(
        invoice,
        customer,
        companyProfile,
        lineItems,
        previousInvoiceHash
      );
      
      // Generate QR code
      const qrCode = KSAZATCAQRGenerator.generateQRCode(
        invoice,
        companyProfile,
        hash
      );
      
      // Determine invoice type
      const invoiceType = customer.taxId ? 'B2B' : 'B2C';
      
      // Update invoice
      await this.storage.updateInvoice(invoiceId, tenantId, {
        zatcaFatoorahXml: xml,
        zatcaUuid: uuid,
        zatcaHash: hash,
        zatcaPreviousInvoiceHash: previousInvoiceHash,
        zatcaQrCode: qrCode,
        zatcaClearanceStatus: 'pending'
      });
      
      return {
        success: true,
        xml,
        uuid,
        hash,
        qrCode,
        invoiceType
      };
    } catch (error) {
      console.error('[ZATCA] Preparation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * B2B: Clear invoice with FATOORAH (real-time, before issuance)
   */
  async clearB2BInvoice(tenantId: string, invoiceId: string): Promise<{
    success: boolean;
    clearanceStatus?: 'cleared' | 'rejected';
    error?: string;
  }> {
    try {
      const invoice = await this.storage.getInvoice(invoiceId);
      if (!invoice || invoice.tenantId !== tenantId) {
        return { success: false, error: 'Invoice not found' };
      }
      
      if (!invoice.zatcaFatoorahXml || !invoice.zatcaUuid || !invoice.zatcaHash) {
        return { success: false, error: 'Invoice not prepared - run prepare first' };
      }
      
      // Request clearance from FATOORAH
      const result = await this.fatoorahService.clearB2BInvoice(
        invoice.zatcaFatoorahXml,
        invoice.zatcaUuid,
        invoice.zatcaHash
      );
      
      // Update invoice with clearance status
      if (result.success && result.clearanceStatus === 'cleared') {
        await this.storage.updateInvoice(invoiceId, tenantId, {
          zatcaClearanceStatus: 'cleared',
          zatcaClearedAt: result.clearanceDate
        });
      } else {
        await this.storage.updateInvoice(invoiceId, tenantId, {
          zatcaClearanceStatus: 'rejected'
        });
      }
      
      return result;
    } catch (error) {
      console.error('[ZATCA] B2B clearance error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * B2C: Report invoice to FATOORAH (within 24 hours)
   */
  async reportB2CInvoice(tenantId: string, invoiceId: string): Promise<{
    success: boolean;
    reportedDate?: Date;
    error?: string;
  }> {
    try {
      const invoice = await this.storage.getInvoice(invoiceId);
      if (!invoice || invoice.tenantId !== tenantId) {
        return { success: false, error: 'Invoice not found' };
      }
      
      if (!invoice.zatcaFatoorahXml || !invoice.zatcaUuid || !invoice.zatcaHash) {
        return { success: false, error: 'Invoice not prepared - run prepare first' };
      }
      
      // Report to FATOORAH
      const result = await this.fatoorahService.reportB2CInvoice(
        invoice.zatcaFatoorahXml,
        invoice.zatcaUuid,
        invoice.zatcaHash
      );
      
      if (result.success) {
        await this.storage.updateInvoice(invoiceId, tenantId, {
          zatcaReportedAt: result.reportedDate
        });
      }
      
      return result;
    } catch (error) {
      console.error('[ZATCA] B2C reporting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
