import PDFDocument from 'pdfkit';

interface InvoicePDFData {
  invoice: {
    id: string;
    invoiceNumber: string;
    invoiceDate: Date;
    dueDate: Date;
    invoiceSubject?: string;
    status: string;
    subtotal: number;
    totalTax: number;
    total: number;
    issuerTaxId: string;
    customerTaxId?: string;
  };
  customer: {
    name: string;
    email: string;
    address?: string;
    taxRegistrationNumber?: string;
  };
  companyProfile: {
    legalName: string;
    taxRegistrationNumber: string;
    address?: string;
    logoUrl?: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    discount?: number;
    taxName?: string;
    taxRate?: number;
  }>;
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text(data.companyProfile.legalName, 50, 50);
    doc.fontSize(10).text(`Tax ID: ${data.companyProfile.taxRegistrationNumber}`, 50, 75);
    if (data.companyProfile.address) {
      doc.text(data.companyProfile.address, 50, 90);
    }

    // Invoice title
    doc.fontSize(24).text('INVOICE', 400, 50, { align: 'right' });
    doc.fontSize(12).text(data.invoice.invoiceNumber, 400, 80, { align: 'right' });

    // Invoice details
    const detailsY = 150;
    doc.fontSize(10);
    doc.text('Invoice Date:', 50, detailsY);
    doc.text(new Date(data.invoice.invoiceDate).toLocaleDateString(), 150, detailsY);
    doc.text('Due Date:', 50, detailsY + 15);
    doc.text(new Date(data.invoice.dueDate).toLocaleDateString(), 150, detailsY + 15);
    doc.text('Status:', 50, detailsY + 30);

    // Enhance status display with color coding (via text)
    const statusText = (data.invoice.status ?? 'draft').toUpperCase();
    const statusDisplay = statusText === 'PAID' ? `${statusText} ✓` : statusText;
    doc.text(statusDisplay, 150, detailsY + 30);

    let subjectHeight = 0;
    if (data.invoice.invoiceSubject) {
      doc.text('Subject:', 50, detailsY + 45);
      doc.text(data.invoice.invoiceSubject, 150, detailsY + 45, { width: 300 });
      subjectHeight = 15;
    }

    // Customer details
    const customerY = detailsY;
    doc.fontSize(12).text('Bill To:', 350, customerY);
    doc.fontSize(10).text(data.customer.name, 350, customerY + 20);
    doc.text(data.customer.email, 350, customerY + 35);
    let customerYOffset = 50;
    if (data.customer.taxRegistrationNumber) {
      doc.text(`Tax ID: ${data.customer.taxRegistrationNumber}`, 350, customerY + customerYOffset);
      customerYOffset += 15;
    }
    if (data.customer.address) {
      doc.text(data.customer.address, 350, customerY + customerYOffset, { width: 200 });
    }

    // Table
    const tableTop = 280;
    const tableHeaders = ['Description', 'Qty', 'Rate', 'Discount', 'Tax', 'Amount'];
    const columnWidths = [200, 50, 70, 60, 60, 70];
    let currentX = 50;

    doc.fontSize(10).font('Helvetica-Bold');
    tableHeaders.forEach((header, i) => {
      doc.text(header, currentX, tableTop);
      currentX += columnWidths[i];
    });
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Line items with dynamic Y tracking
    doc.font('Helvetica');
    let itemY = tableTop + 25;
    
    data.lineItems.forEach((item) => {
      // Check if we need new page
      if (itemY > 700) {
        doc.addPage();
        itemY = 50;
      }

      currentX = 50;
      doc.text(item.description, currentX, itemY, { width: columnWidths[0] - 10 });
      currentX += columnWidths[0];
      doc.text(item.quantity.toString(), currentX, itemY);
      currentX += columnWidths[1];
      doc.text(`$${item.rate.toFixed(2)}`, currentX, itemY);
      currentX += columnWidths[2];
      doc.text(item.discount ? `${item.discount}%` : '-', currentX, itemY);
      currentX += columnWidths[3];
      doc.text(item.taxName ? `${item.taxName} (${item.taxRate}%)` : '-', currentX, itemY, { width: columnWidths[4] - 5 });
      currentX += columnWidths[4];
      doc.text(`$${item.amount.toFixed(2)}`, currentX, itemY);

      itemY += 25;
    });

    // Totals - place dynamically after items
    const totalsY = itemY + 20;
    doc.fontSize(10).font('Helvetica');
    doc.text('Subtotal:', 400, totalsY);
    doc.text(`$${data.invoice.subtotal.toFixed(2)}`, 480, totalsY);
    doc.text('Total Tax:', 400, totalsY + 15);
    doc.text(`$${data.invoice.totalTax.toFixed(2)}`, 480, totalsY + 15);

    // Add line separator
    doc.moveTo(400, totalsY + 30).lineTo(550, totalsY + 30).stroke();

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total Amount:', 400, totalsY + 35);
    doc.text(`$${data.invoice.total.toFixed(2)}`, 480, totalsY + 35);

    // Add payment status and outstanding balance
    doc.fontSize(10).font('Helvetica');

    // Calculate outstanding balance based on status (accounting compliance)
    // - draft: $0 (not yet issued)
    // - cancelled: $0 (voided)
    // - paid: $0 (fully paid)
    // - sent/overdue: full total (no partial payment tracking yet - Phase 3)
    const status = (data.invoice.status ?? 'draft').toLowerCase();
    let outstandingBalance: number;
    
    if (status === 'paid' || status === 'cancelled' || status === 'draft') {
      outstandingBalance = 0;
    } else {
      // sent, overdue, or any other active status
      outstandingBalance = data.invoice.total;
    }

    doc.text('Payment Status:', 400, totalsY + 55);
    doc.text((data.invoice.status ?? 'draft').toUpperCase(), 480, totalsY + 55);

    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Amount Due:', 400, totalsY + 75);
    doc.text(`$${outstandingBalance.toFixed(2)}`, 480, totalsY + 75);

    // Add status notes for clarity
    if (status === 'paid') {
      doc.fontSize(9).font('Helvetica');
      doc.text('(PAID IN FULL)', 480, totalsY + 90);
    } else if (status === 'cancelled') {
      doc.fontSize(9).font('Helvetica');
      doc.text('(CANCELLED)', 480, totalsY + 90);
    } else if (status === 'draft') {
      doc.fontSize(9).font('Helvetica');
      doc.text('(NOT YET ISSUED)', 480, totalsY + 90);
    }

    // Footer - calculate position dynamically
    const footerY = Math.max(totalsY + 110, doc.page.height - 50);
    doc.fontSize(8).font('Helvetica');
    doc.text(
      `Issuer Tax Registration: ${data.invoice.issuerTaxId}${data.invoice.customerTaxId ? ` | Customer Tax Registration: ${data.invoice.customerTaxId}` : ''}`,
      50,
      footerY,
      { align: 'center', width: 500 }
    );

    doc.end();
  });
}
