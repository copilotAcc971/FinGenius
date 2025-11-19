/**
 * UAE Peppol E-Invoicing Module
 * 
 * Comprehensive e-invoicing compliance infrastructure for UAE Peppol network.
 * 
 * **Features:**
 * - UBL 2.1 XML generation (PINT-AE standard)
 * - TLV QR code generation
 * - ASP integration foundation
 * - 14-day transmission deadline tracking
 * - Audit trail preservation
 * 
 * **Requirements:**
 * - Invoice must have customer with valid details
 * - Company profile must be configured
 * - Invoice must have line items
 * 
 * **Usage:**
 * ```typescript
 * import { UAEPeppolService } from './e-invoicing/uae-peppol';
 * 
 * const peppolService = new UAEPeppolService(storage);
 * 
 * // Step 1: Prepare invoice (generate UBL XML & QR code)
 * const prepared = await peppolService.prepareInvoice(tenantId, invoiceId);
 * 
 * // Step 2: Transmit to Peppol network via ASP
 * const transmitted = await peppolService.transmitInvoice(tenantId, invoiceId);
 * 
 * // Step 3: Check status
 * const status = await peppolService.getStatus(tenantId, invoiceId);
 * ```
 * 
 * **Production Setup:**
 * Set environment variables for your ASP provider:
 * - UAE_PEPPOL_ASP_ENDPOINT
 * - UAE_PEPPOL_ASP_API_KEY
 * - UAE_PEPPOL_ASP_SECRET
 */

export { UAEPeppolUBLGenerator } from './ubl-generator';
export { UAEPeppolQRGenerator } from './qr-generator';
export { UAEPeppolASPService } from './asp-service';
export { UAEPeppolService } from './peppol-service';
