import type { Invoice, TenantCompanyProfile } from '@shared/schema';

export class KSAZATCAQRGenerator {
  /**
   * Generate ZATCA TLV QR code
   * Tag 1: Seller name
   * Tag 2: VAT registration number
   * Tag 3: Invoice timestamp (ISO 8601)
   * Tag 4: Invoice total (including VAT)
   * Tag 5: VAT amount
   * Tag 6: Invoice hash (SHA-256)
   * Tag 7: Invoice digital signature (PKI)
   * Tag 8: Public key certificate
   * Tag 9: Cryptographic stamp identifier
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
