import type { Invoice, TenantCompanyProfile } from '@shared/schema';

/**
 * KSA ZATCA QR Code Generator
 * 
 * OFFICIAL SPECIFICATION:
 * - ZATCA E-Invoicing Guidelines: https://zatca.gov.sa/en/E-Invoicing/
 * - Detailed Technical Spec: https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-Invoicing_Detailed__Guideline.pdf
 * 
 * COMPLIANCE REQUIREMENTS:
 * - Format: TLV (Tag-Length-Value) Base64-encoded
 * - Mandatory: ALL invoices (B2B, B2C, B2G) MUST include QR codes (Phase 1 & 2)
 * - Verification: QR code enables instant authenticity verification
 * - Updates: QR code is regenerated during FATOORAH processing (Phase 2)
 * - Encoding: Base64 for safe transmission and storage
 * 
 * PHASE 1 (Generation Phase - Dec 4, 2021):
 * - B2C invoices: MANDATORY QR code
 * - B2B invoices: Optional QR code
 * 
 * PHASE 2 (Integration Phase - Jan 1, 2023 onwards):
 * - ALL invoice types: MANDATORY QR code
 * - Tags 1-6: Always present
 * - Tags 7-9: Added by ZATCA during digital signature/cryptographic stamping
 * 
 * TLV Tag Specification:
 * - Tag 1: Seller name (string, max 255 bytes UTF-8)
 * - Tag 2: VAT registration number / TIN (max 15 bytes)
 * - Tag 3: Invoice timestamp (ISO 8601, DateTime format)
 * - Tag 4: Invoice total including VAT (numeric, 2 decimals SAR)
 * - Tag 5: VAT amount (numeric, 2 decimals SAR)
 * - Tag 6: Invoice hash SHA-256 (base64-encoded)
 * - Tag 7: Invoice digital signature (RSASSA-PKCS1-v1_5, optional - added by ZATCA)
 * - Tag 8: Public key certificate (X.509, optional - added by ZATCA)
 * - Tag 9: Cryptographic stamp identifier (optional - added by ZATCA)
 */
export class KSAZATCAQRGenerator {
  /**
   * Generate ZATCA TLV QR code per official specifications
   * https://zatca.gov.sa/en/E-Invoicing/
   */
  static generateQRCode(
    invoice: Invoice,
    companyProfile: TenantCompanyProfile,
    invoiceHash: string,
    digitalSignature?: string
  ): string {
    const total = typeof invoice.total === 'string' ? invoice.total : invoice.total.toString();
    const taxAmount = typeof invoice.taxAmount === 'string' ? invoice.taxAmount : invoice.taxAmount.toString();
    
    const data = [
      { tag: 1, value: companyProfile.name },
      { tag: 2, value: companyProfile.taxId || '' },
      { tag: 3, value: invoice.invoiceDate.toISOString() },
      { tag: 4, value: total },
      { tag: 5, value: taxAmount },
      { tag: 6, value: invoiceHash },
      // Tags 7-9 require PKI certificates (production only)
      ...(digitalSignature ? [{ tag: 7, value: digitalSignature }] : [])
    ];
    
    // Encode TLV format
    const tlv = data.map(({ tag, value }) => {
      const valueBytes = Buffer.from(value, 'utf-8');
      const length = valueBytes.length;
      return Buffer.concat([
        Buffer.from([tag]),
        Buffer.from([length]),
        valueBytes
      ]);
    });
    
    const combined = Buffer.concat(tlv);
    return combined.toString('base64');
  }
}
