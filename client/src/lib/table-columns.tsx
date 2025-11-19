export interface TableColumnDef {
  key: string;                    // Column identifier
  header: string;                 // Header text
  width?: string;                 // Fixed width: "40px", "120px", etc.
  minWidth?: string;              // Minimum width: "100px", etc.
  maxWidth?: string;              // Maximum width: "200px", etc.
  align?: 'left' | 'center' | 'right';
  className?: string;             // Additional classes
}

// Helper to generate <colgroup> from column definitions
export function renderColgroup(columns: TableColumnDef[]) {
  return (
    <colgroup>
      {columns.map((col) => (
        <col 
          key={col.key}
          style={{
            width: col.width,
            minWidth: col.minWidth,
            maxWidth: col.maxWidth
          }}
        />
      ))}
    </colgroup>
  );
}

// Helper to get cell className from column definition
export function getColumnClassName(col: TableColumnDef): string {
  const classes = [col.className || ''];
  if (col.align) classes.push(`text-${col.align}`);
  return classes.filter(Boolean).join(' ');
}

// Invoices table column definitions
export const invoiceColumns: TableColumnDef[] = [
  { key: 'invoice-number', header: 'Invoice #', width: '150px' },
  { key: 'customer', header: 'Customer', minWidth: '200px' },
  { key: 'date', header: 'Date', width: '110px' },
  { key: 'due-date', header: 'Due Date', width: '110px' },
  { key: 'amount', header: 'Amount', width: '120px', align: 'right' },
  { key: 'status', header: 'Status', width: '100px' },
  { key: 'email-status', header: 'Email Status', width: '120px' },
  { key: 'actions', header: '', width: '70px' },
];

// Bills table column definitions
export const billColumns: TableColumnDef[] = [
  { key: 'bill-number', header: 'Bill #', width: '150px' },
  { key: 'vendor', header: 'Vendor', minWidth: '200px' },
  { key: 'date', header: 'Date', width: '110px' },
  { key: 'due-date', header: 'Due Date', width: '110px' },
  { key: 'amount', header: 'Amount', width: '120px', align: 'right' },
  { key: 'status', header: 'Status', width: '100px' },
  { key: 'actions', header: '', width: '50px' },
];

// Customers table column definitions
export const customerColumns: TableColumnDef[] = [
  { key: 'name', header: 'Name', minWidth: '200px' },
  { key: 'email', header: 'Email', width: '200px' },
  { key: 'phone', header: 'Phone', width: '120px' },
  { key: 'company', header: 'Company', width: '150px' },
  { key: 'actions', header: '', width: '70px' },
];

// Vendors table column definitions
export const vendorColumns: TableColumnDef[] = [
  { key: 'name', header: 'Name', minWidth: '200px' },
  { key: 'email', header: 'Email', width: '200px' },
  { key: 'phone', header: 'Phone', width: '120px' },
  { key: 'company', header: 'Company', width: '150px' },
  { key: 'payment-status', header: 'Payment Status', width: '140px' },
  { key: 'actions', header: '', width: '70px' },
];

// Items table column definitions
export const itemColumns: TableColumnDef[] = [
  { key: 'name', header: 'Name', minWidth: '200px' },
  { key: 'sku', header: 'SKU', width: '120px' },
  { key: 'type', header: 'Type', width: '100px' },
  { key: 'rate', header: 'Rate', width: '120px', align: 'right' },
  { key: 'unit', header: 'Unit', width: '100px' },
  { key: 'status', header: 'Status', width: '100px' },
  { key: 'actions', header: '', width: '70px' },
];

// Payments table column definitions
export const paymentColumns: TableColumnDef[] = [
  { key: 'date', header: 'Date', width: '110px' },
  { key: 'vendor', header: 'Vendor', minWidth: '150px' },
  { key: 'type', header: 'Type', width: '120px' },
  { key: 'amount', header: 'Amount', width: '120px', align: 'right' },
  { key: 'scheduled-for', header: 'Scheduled For', width: '130px' },
  { key: 'status', header: 'Status', width: '100px' },
  { key: 'actions', header: 'Actions', width: '100px' },
];

// Expenses table column definitions
export const expenseColumns: TableColumnDef[] = [
  { key: 'date', header: 'Date', width: '110px' },
  { key: 'category', header: 'Category', width: '140px' },
  { key: 'description', header: 'Description', minWidth: '200px' },
  { key: 'vendor', header: 'Vendor', width: '150px' },
  { key: 'amount', header: 'Amount', width: '120px', align: 'right' },
  { key: 'status', header: 'Status', width: '100px' },
];

// Customer Payments table column definitions
export const customerPaymentColumns: TableColumnDef[] = [
  { key: 'payment-number', header: 'Payment Number', width: '150px' },
  { key: 'customer', header: 'Customer', minWidth: '150px' },
  { key: 'invoice', header: 'Invoice', width: '130px' },
  { key: 'date', header: 'Date', width: '110px' },
  { key: 'amount', header: 'Amount', width: '120px', align: 'right' },
  { key: 'payment-method', header: 'Payment Method', width: '140px' },
  { key: 'reference', header: 'Reference', width: '130px' },
  { key: 'actions', header: 'Actions', width: '100px' },
];

// Purchase Orders table column definitions
export const purchaseOrderColumns: TableColumnDef[] = [
  { key: 'po-number', header: 'PO Number', width: '150px' },
  { key: 'vendor', header: 'Vendor', minWidth: '200px' },
  { key: 'order-date', header: 'Order Date', width: '130px' },
  { key: 'expected-delivery', header: 'Expected Delivery', width: '150px' },
  { key: 'total', header: 'Total', width: '120px', align: 'right' },
  { key: 'status', header: 'Status', width: '120px' },
  { key: 'actions', header: '', width: '50px' },
];
