import type { Invoice, Customer, TenantCompanyProfile, InvoiceLineItem } from '@shared/schema';

/**
 * UAE Peppol UBL 2.1 XML Generator
 * 
 * Generates UBL (Universal Business Language) 2.1 XML compliant with:
 * - PINT-AE (Peppol International Model - Arab Emirates)
 * - UAE Federal Tax Authority (FTA) requirements
 * 
 * Standard: urn:peppol:pint:billing-1@ae-1
 */
export class UAEPeppolUBLGenerator {
  /**
   * Generate UBL 2.1 XML for UAE Peppol invoice
   * 
   * @param invoice - Invoice record
   * @param customer - Customer record
   * @param companyProfile - Company profile (supplier)
   * @param lineItems - Invoice line items
   * @returns UBL 2.1 XML string
   */
  static generateInvoiceUBL(
    invoice: Invoice,
    customer: Customer,
    companyProfile: TenantCompanyProfile,
    lineItems: InvoiceLineItem[]
  ): string {
    // Escape XML special characters
    const escapeXml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    // Format date to YYYY-MM-DD
    const formatDate = (date: Date | string): string => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toISOString().split('T')[0];
    };

    // UBL 2.1 XML structure
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:peppol:pint:billing-1@ae-1</cbc:CustomizationID>
  <cbc:ID>${escapeXml(invoice.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${formatDate(invoice.invoiceDate)}</cbc:IssueDate>
  ${invoice.dueDate ? `<cbc:DueDate>${formatDate(invoice.dueDate)}</cbc:DueDate>` : ''}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${invoice.currencyCode || 'AED'}</cbc:DocumentCurrencyCode>
  ${invoice.notes ? `<cbc:Note>${escapeXml(invoice.notes)}</cbc:Note>` : ''}
  
  <!-- Supplier (Company) -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="EM">${escapeXml(companyProfile.email || '')}</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>${escapeXml(companyProfile.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        ${companyProfile.address ? `<cbc:StreetName>${escapeXml(companyProfile.address)}</cbc:StreetName>` : ''}
        ${companyProfile.city ? `<cbc:CityName>${escapeXml(companyProfile.city)}</cbc:CityName>` : ''}
        ${companyProfile.postalCode ? `<cbc:PostalZone>${escapeXml(companyProfile.postalCode)}</cbc:PostalZone>` : ''}
        <cac:Country>
          <cbc:IdentificationCode>${companyProfile.country || 'AE'}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      ${companyProfile.taxId ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(companyProfile.taxId)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      ${companyProfile.tradeRegistration ? `
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(companyProfile.name)}</cbc:RegistrationName>
        <cbc:CompanyID>${escapeXml(companyProfile.tradeRegistration)}</cbc:CompanyID>
      </cac:PartyLegalEntity>` : ''}
    </cac:Party>
  </cac:AccountingSupplierParty>
  
  <!-- Customer -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${customer.email ? `<cbc:EndpointID schemeID="EM">${escapeXml(customer.email)}</cbc:EndpointID>` : ''}
      <cac:PartyName>
        <cbc:Name>${escapeXml(customer.companyName || customer.displayName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        ${customer.billingAddress?.street ? `<cbc:StreetName>${escapeXml(customer.billingAddress.street)}</cbc:StreetName>` : ''}
        ${customer.billingAddress?.city ? `<cbc:CityName>${escapeXml(customer.billingAddress.city)}</cbc:CityName>` : ''}
        ${customer.billingAddress?.postalCode ? `<cbc:PostalZone>${escapeXml(customer.billingAddress.postalCode)}</cbc:PostalZone>` : ''}
        <cac:Country>
          <cbc:IdentificationCode>${customer.billingAddress?.country || 'AE'}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      ${customer.taxId ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(customer.taxId)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
    </cac:Party>
  </cac:AccountingCustomerParty>
  
  <!-- Tax Total -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${invoice.currencyCode || 'AED'}">${invoice.taxAmount}</cbc:TaxAmount>
  </cac:TaxTotal>
  
  <!-- Legal Monetary Total -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${invoice.currencyCode || 'AED'}">${invoice.subtotal}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${invoice.currencyCode || 'AED'}">${invoice.subtotal}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${invoice.currencyCode || 'AED'}">${invoice.total}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${invoice.currencyCode || 'AED'}">${invoice.total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  
  <!-- Invoice Lines -->
${lineItems.map((line, index) => `  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${escapeXml(line.unit || 'C62')}">${line.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${invoice.currencyCode || 'AED'}">${line.amount}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${escapeXml(line.description)}</cbc:Description>
      <cbc:Name>${escapeXml(line.description)}</cbc:Name>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${invoice.currencyCode || 'AED'}">${line.unitPrice}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`).join('\n')}
</Invoice>`;
    
    return xml;
  }
}
