import { useMemo } from 'react';
import { Trash2, Mail, CheckCircle2 } from 'lucide-react';
import { AdvancedDataTable } from '@/shared/components/tables/advanced-data-table';
import { AdvancedColumnDef, BulkAction } from '@/shared/lib/utils/advanced-table-types';
import { Badge } from '@/shared/components/ui/badge';
import { useToast } from '@/shared/hooks/use-toast';
import { formatCurrency } from '@/shared/lib/utils/currency-utils';

interface SampleInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  date: string;
  dueDate: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  emailStatus: 'not_sent' | 'sent' | 'opened' | 'bounced';
  description: string;
}

const sampleInvoices: SampleInvoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-001',
    customerName: 'Acme Corporation',
    date: '2024-01-15',
    dueDate: '2024-02-14',
    amount: 12500.00,
    status: 'paid',
    emailStatus: 'opened',
    description: 'Web development services',
  },
  {
    id: '2',
    invoiceNumber: 'INV-002',
    customerName: 'TechStart Inc',
    date: '2024-01-20',
    dueDate: '2024-02-19',
    amount: 8750.50,
    status: 'sent',
    emailStatus: 'sent',
    description: 'Mobile app design',
  },
  {
    id: '3',
    invoiceNumber: 'INV-003',
    customerName: 'Global Industries',
    date: '2024-01-25',
    dueDate: '2024-02-24',
    amount: 15000.00,
    status: 'overdue',
    emailStatus: 'opened',
    description: 'Consulting services',
  },
  {
    id: '4',
    invoiceNumber: 'INV-004',
    customerName: 'Small Business LLC',
    date: '2024-02-01',
    dueDate: '2024-03-02',
    amount: 3200.00,
    status: 'draft',
    emailStatus: 'not_sent',
    description: 'Logo design',
  },
  {
    id: '5',
    invoiceNumber: 'INV-005',
    customerName: 'Enterprise Solutions',
    date: '2024-02-05',
    dueDate: '2024-03-07',
    amount: 25000.00,
    status: 'sent',
    emailStatus: 'sent',
    description: 'Annual maintenance',
  },
  {
    id: '6',
    invoiceNumber: 'INV-006',
    customerName: 'Startup Ventures',
    date: '2024-02-10',
    dueDate: '2024-03-12',
    amount: 5500.00,
    status: 'paid',
    emailStatus: 'opened',
    description: 'Brand identity package',
  },
  {
    id: '7',
    invoiceNumber: 'INV-007',
    customerName: 'Manufacturing Co',
    date: '2024-02-12',
    dueDate: '2024-03-14',
    amount: 18500.00,
    status: 'sent',
    emailStatus: 'not_sent',
    description: 'ERP system integration',
  },
  {
    id: '8',
    invoiceNumber: 'INV-008',
    customerName: 'Retail Chain',
    date: '2024-02-15',
    dueDate: '2024-03-17',
    amount: 9800.00,
    status: 'overdue',
    emailStatus: 'bounced',
    description: 'POS system setup',
  },
];

const statusColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
  draft: 'secondary',
  sent: 'default',
  paid: 'default',
  overdue: 'destructive',
};

const emailStatusLabels: Record<string, string> = {
  not_sent: 'Not Sent',
  sent: 'Sent',
  opened: 'Opened',
  bounced: 'Bounced',
};

export default function AdvancedTableDemo() {
  const { toast } = useToast();

  const columns = useMemo<AdvancedColumnDef<SampleInvoice>[]>(() => [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      accessorKey: 'invoiceNumber',
      width: '150px',
      enableSorting: true,
      enableFiltering: true,
      filterFn: 'text',
    },
    {
      key: 'customerName',
      header: 'Customer',
      accessorKey: 'customerName',
      minWidth: '200px',
      enableSorting: true,
      enableFiltering: true,
      filterFn: 'text',
    },
    {
      key: 'description',
      header: 'Description',
      accessorKey: 'description',
      minWidth: '200px',
      enableSorting: false,
      enableFiltering: true,
      filterFn: 'text',
      defaultHidden: true,
    },
    {
      key: 'date',
      header: 'Date',
      accessorKey: 'date',
      width: '110px',
      enableSorting: true,
      enableFiltering: true,
      filterFn: 'date',
      sortingFn: 'datetime',
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      accessorKey: 'dueDate',
      width: '110px',
      enableSorting: true,
      enableFiltering: true,
      filterFn: 'date',
      sortingFn: 'datetime',
    },
    {
      key: 'amount',
      header: 'Amount',
      accessorKey: 'amount',
      width: '120px',
      align: 'right',
      enableSorting: true,
      enableFiltering: true,
      filterFn: 'number',
      cell: ({ getValue }) => (
        <span className="font-mono">{formatCurrency(getValue() as number, 'USD')}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessorKey: 'status',
      width: '100px',
      enableSorting: true,
      enableFiltering: true,
      filterFn: 'select',
      filterOptions: ['draft', 'sent', 'paid', 'overdue'],
      cell: ({ getValue }) => {
        const status = getValue() as string;
        return (
          <Badge variant={statusColors[status] || 'default'} className="capitalize">
            {status}
          </Badge>
        );
      },
    },
    {
      key: 'emailStatus',
      header: 'Email Status',
      accessorKey: 'emailStatus',
      width: '120px',
      enableSorting: true,
      enableFiltering: true,
      filterFn: 'select',
      filterOptions: ['not_sent', 'sent', 'opened', 'bounced'],
      cell: ({ getValue }) => {
        const status = getValue() as string;
        return (
          <span className="text-sm text-muted-foreground">
            {emailStatusLabels[status] || status}
          </span>
        );
      },
    },
  ], []);

  const bulkActions: BulkAction[] = [
    {
      label: 'Send Email',
      value: 'send-email',
      icon: <Mail className="h-4 w-4 mr-2" />,
      variant: 'default',
    },
    {
      label: 'Mark as Paid',
      value: 'mark-paid',
      icon: <CheckCircle2 className="h-4 w-4 mr-2" />,
      variant: 'default',
    },
    {
      label: 'Delete',
      value: 'delete',
      icon: <Trash2 className="h-4 w-4 mr-2" />,
      variant: 'destructive',
    },
  ];

  const handleBulkAction = (action: string, rows: SampleInvoice[]) => {
    toast({
      title: 'Bulk Action',
      description: `${action} action performed on ${rows.length} invoice(s)`,
    });
    console.log('Bulk action:', action, 'on rows:', rows);
  };

  const handleRowClick = (row: SampleInvoice) => {
    toast({
      title: 'Invoice Clicked',
      description: `You clicked on ${row.invoiceNumber}`,
    });
    console.log('Row clicked:', row);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Advanced Data Table Demo</h1>
        <p className="text-muted-foreground mt-2">
          Enterprise-grade table with sorting, filtering, pagination, column visibility, and bulk actions
        </p>
      </div>

      <AdvancedDataTable
        tableId="invoice-demo"
        columns={columns}
        data={sampleInvoices}
        onRowClick={handleRowClick}
        onBulkAction={handleBulkAction}
        bulkActions={bulkActions}
        enableRowSelection
        enableFiltering
        enableSorting
        enablePagination
        enableExport
        defaultPageSize={10}
        emptyState={
          <div className="py-12">
            <p className="text-lg font-medium">No invoices found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your filters or create a new invoice
            </p>
          </div>
        }
      />

      <div className="rounded-lg border p-6 bg-card space-y-4">
        <h2 className="text-lg font-semibold">Features Demonstrated</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>✅ <strong>Sorting:</strong> Click column headers to sort (Invoice #, Customer, Date, Amount, etc.)</li>
          <li>✅ <strong>Global Search:</strong> Search across all columns using the search input</li>
          <li>✅ <strong>Advanced Filtering:</strong> Click "Add Filter" to create column-specific filters</li>
          <li>✅ <strong>Column Visibility:</strong> Click "Columns" dropdown to show/hide columns</li>
          <li>✅ <strong>Row Selection:</strong> Select rows using checkboxes</li>
          <li>✅ <strong>Bulk Actions:</strong> Perform actions on selected rows (Send Email, Mark as Paid, Delete)</li>
          <li>✅ <strong>Pagination:</strong> Navigate through pages and adjust rows per page</li>
          <li>✅ <strong>Export:</strong> Export to CSV or Excel (respects column visibility and selection)</li>
          <li>✅ <strong>LocalStorage:</strong> Column visibility preferences are persisted</li>
          <li>✅ <strong>Accessibility:</strong> Full keyboard navigation and ARIA labels</li>
          <li>✅ <strong>Responsive:</strong> Works on all screen sizes</li>
        </ul>
      </div>
    </div>
  );
}
