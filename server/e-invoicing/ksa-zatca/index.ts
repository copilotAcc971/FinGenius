/**
 * KSA ZATCA E-Invoicing Module
 * 
 * Comprehensive e-invoicing compliance infrastructure for KSA ZATCA Phase 2.
 * 
 * **Features:**
 * - ZATCA-compliant XML generation with UUID and hash chaining
 * - TLV QR code generation (ZATCA format)
 * - FATOORAH platform integration
 * - B2B real-time clearance workflow
 * - B2C simplified reporting (24-hour deadline)
 * - PKI digital signature support (production)
 * 
 * **Requirements:**
 * - Invoice must have customer with valid details
 * - Company profile must be configured with tax ID
 * - Invoice must have line items
 * 
 * **Usage:**
 * ```typescript
 * import { KSAZATCAService } from './e-invoicing/ksa-zatca';
 * 
 * const zatcaService = new KSAZATCAService(storage);
 * 
 * // Step 1: Prepare invoice (generate XML, UUID, hash, QR code)
 * const prepared = await zatcaService.prepareInvoice(tenantId, invoiceId);
 * 
 * // Step 2a: For B2B - Clear invoice with FATOORAH (real-time)
 * const cleared = await zatcaService.clearB2BInvoice(tenantId, invoiceId);
 * 
 * // Step 2b: For B2C - Report invoice to FATOORAH (within 24h)
 * const reported = await zatcaService.reportB2CInvoice(tenantId, invoiceId);
 * ```
 * 
 * **Production Setup:**
 * Set environment variables:
 * - KSA_ZATCA_SANDBOX=false
 * - KSA_ZATCA_API_KEY=your_fatoorah_api_key
 * - KSA_ZATCA_PKI_CERT_PATH=/path/to/certificate.pem
 * - KSA_ZATCA_PKI_KEY_PATH=/path/to/private-key.pem
 */

export { KSAZATCAXMLGenerator } from './xml-generator';
export { KSAZATCAQRGenerator } from './qr-generator';
export { FATOORAHService } from './fatoorah-service';
export { KSAZATCAService } from './zatca-service';
