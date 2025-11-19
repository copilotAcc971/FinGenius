import type { Invoice, TenantCompanyProfile } from '@shared/schema';

/**
 * UAE Peppol QR Code Generator
 * 
 * Generates TLV (Tag-Length-Value) format QR codes for UAE e-invoices
 * as required by UAE Federal Tax Authority (FTA)
 * 
 * TLV Format:
 * - Tag 1: Seller name
 * - Tag 2: VAT registration number
 * - Tag 3: Invoice date and time
 * - Tag 4: Invoice total (including VAT)
 * - Tag 5: VAT amount
 */
export class UAEPeppolQRGenerator {
  /**
   * Generate TLV (Tag-Length-Value) format QR code
   * 
   * @param invoice - Invoice record
   * @param companyProfile - Company profile (supplier)
   * @returns Base64-encoded TLV data
   */
  static generateQRCode(invoice: Invoice, companyProfile: TenantCompanyProfile): string {
    // TLV data structure
    const data = [
      { tag: 1, value: companyProfile.name },
      { tag: 2, value: companyProfile.taxId || '' },
      { tag: 3, value: new Date(invoice.invoiceDate).toISOString() },
      { tag: 4, value: parseFloat(invoice.total.toString()).toFixed(2) },
      { tag: 5, value: parseFloat(invoice.taxAmount.toString()).toFixed(2) },
    ];
    
    // Encode each tag-length-value triplet
    const tlv = data.map(({ tag, value }) => {
      const valueBytes = Buffer.from(value, 'utf-8');
      const length = valueBytes.length;
      
      return Buffer.concat([
        Buffer.from([tag]),
        Buffer.from([length]),
        valueBytes
      ]);
    });
    
    // Combine all TLV triplets
    const combined = Buffer.concat(tlv);
    
    // Return base64-encoded string (to be converted to QR code image by frontend)
    return combined.toString('base64');
  }
  
  /**
   * Decode TLV QR code data (for verification)
   * 
   * @param base64Data - Base64-encoded TLV data
   * @returns Decoded data object
   */
  static decodeQRCode(base64Data: string): Record<number, string> {
    const buffer = Buffer.from(base64Data, 'base64');
    const decoded: Record<number, string> = {};
    
    let offset = 0;
    while (offset < buffer.length) {
      const tag = buffer[offset];
      const length = buffer[offset + 1];
      const value = buffer.slice(offset + 2, offset + 2 + length).toString('utf-8');
      
      decoded[tag] = value;
      offset += 2 + length;
    }
    
    return decoded;
  }
}
