/**
 * OPTIMISTIC UI PATTERN EXAMPLES
 * 
 * This file demonstrates how to use the optimistic UI hooks in various scenarios.
 * Copy these patterns into your actual components as needed.
 */

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useOptimisticCreate } from "@/shared/hooks/optimistic-ui/useOptimisticCreate";
import { useOptimisticUpdate } from "@/shared/hooks/optimistic-ui/useOptimisticUpdate";
import { useOptimisticDelete } from "@/shared/hooks/optimistic-ui/useOptimisticDelete";
import { PendingBadge } from "@/shared/components/ui/pending-badge";
import { Button } from "@/shared/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

// ============================================================================
// EXAMPLE 1: CREATE PATTERN - Invoice Creation
// ============================================================================

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid';
  isPending?: boolean; // Flag for optimistic items
}

export function InvoiceListExample() {
  // Fetch invoices
  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
  });

  // CREATE: Optimistic invoice creation
  const createInvoice = useOptimisticCreate<Invoice[], Invoice, Partial<Invoice>>({
    endpoint: '/api/invoices',
    queryKey: ['/api/invoices'],
    generateOptimisticItem: (data) => ({
      ...data,
      id: `temp-${Date.now()}`, // Temporary ID until server responds
      isPending: true,          // Visual indicator
      status: data.status || 'draft',
      customerName: data.customerName || 'New Customer',
      amount: data.amount || 0,
      invoiceNumber: `INV-TEMP-${Date.now()}`,
    } as Invoice),
    successMessage: 'Invoice created successfully',
    errorMessage: 'Failed to create invoice',
  });

  // UPDATE: Optimistic status change
  const updateInvoice = useOptimisticUpdate<Invoice[], Invoice>({
    endpoint: '/api/invoices',
    queryKey: ['/api/invoices'],
    successMessage: 'Invoice updated successfully',
  });

  // DELETE: Optimistic deletion
  const deleteInvoice = useOptimisticDelete<Invoice[], Invoice>({
    endpoint: '/api/invoices',
    queryKey: ['/api/invoices'],
    itemName: 'Invoice',
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = () => {
    createInvoice.mutate({
      customerName: 'Acme Corp',
      amount: 1500.00,
      status: 'draft',
    });
  };

  const handleStatusChange = (id: string, status: Invoice['status']) => {
    updateInvoice.mutate({
      id,
      data: { status },
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteInvoice.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Button
          onClick={handleCreate}
          disabled={createInvoice.isPending}
          data-testid="button-create-invoice"
        >
          <Plus className="w-4 h-4 mr-2" />
          {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>State</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow
              key={invoice.id}
              className={invoice.isPending ? 'opacity-60' : ''}
              data-testid={`row-invoice-${invoice.id}`}
            >
              <TableCell className="font-medium">
                {invoice.invoiceNumber}
              </TableCell>
              <TableCell>{invoice.customerName}</TableCell>
              <TableCell className="text-right font-mono">
                ${invoice.amount.toFixed(2)}
              </TableCell>
              <TableCell>
                <Select
                  value={invoice.status}
                  onValueChange={(status) => handleStatusChange(invoice.id, status as Invoice['status'])}
                  disabled={updateInvoice.isPending || invoice.isPending}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <PendingBadge isPending={invoice.isPending} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteId(invoice.id)}
                  disabled={deleteInvoice.isPending || invoice.isPending}
                  data-testid={`button-delete-${invoice.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// EXAMPLE 2: MULTI-TENANT PATTERN - Tenant-Scoped Queries
// ============================================================================

interface Customer {
  id: string;
  name: string;
  email: string;
  isPending?: boolean;
}

export function CustomerListExample() {
  const tenantId = 'tenant-123'; // From context in real app

  // Tenant-scoped query key
  const queryKey = ['/api/customers', { tenantId }];

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey,
  });

  // All hooks automatically work with tenant-scoped keys
  const createCustomer = useOptimisticCreate<Customer[], Customer, Partial<Customer>>({
    endpoint: '/api/customers',
    queryKey, // Tenant-scoped
    generateOptimisticItem: (data) => ({
      id: `temp-${Date.now()}`,
      name: data.name || '',
      email: data.email || '',
      isPending: true,
    } as Customer),
    successMessage: 'Customer created',
  });

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">
        Customers (Tenant: {tenantId})
      </h2>
      {/* UI implementation... */}
    </div>
  );
}

// ============================================================================
// EXAMPLE 3: FORM INTEGRATION - With React Hook Form
// ============================================================================

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";

const invoiceSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  amount: z.number().min(0, 'Amount must be positive'),
  status: z.enum(['draft', 'sent', 'paid']),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

export function InvoiceFormExample() {
  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerName: '',
      amount: 0,
      status: 'draft',
    },
  });

  const createInvoice = useOptimisticCreate<Invoice[], Invoice, InvoiceFormData>({
    endpoint: '/api/invoices',
    queryKey: ['/api/invoices'],
    generateOptimisticItem: (data) => ({
      ...data,
      id: `temp-${Date.now()}`,
      invoiceNumber: `INV-TEMP-${Date.now()}`,
      isPending: true,
    } as Invoice),
    successMessage: 'Invoice created successfully',
  });

  const onSubmit = (data: InvoiceFormData) => {
    createInvoice.mutate(data, {
      onSuccess: () => {
        form.reset(); // Reset form after successful creation
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Name</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-customer-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  data-testid="input-amount"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={createInvoice.isPending}
          data-testid="button-submit"
        >
          {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
        </Button>
      </form>
    </Form>
  );
}

// ============================================================================
// EXAMPLE 4: ERROR HANDLING - Custom Error Messages
// ============================================================================

export function ErrorHandlingExample() {
  const createInvoice = useOptimisticCreate<Invoice[], Invoice, Partial<Invoice>>({
    endpoint: '/api/invoices',
    queryKey: ['/api/invoices'],
    generateOptimisticItem: (data) => ({
      id: `temp-${Date.now()}`,
      isPending: true,
      ...data,
    } as Invoice),
    successMessage: 'Invoice created successfully',
    // Custom error message
    errorMessage: 'Unable to create invoice. Please check the form and try again.',
  });

  // The hook automatically:
  // 1. Shows the error toast
  // 2. Rolls back the optimistic update
  // 3. Refetches to ensure data consistency

  return null;
}

// ============================================================================
// EXAMPLE 5: BATCH OPERATIONS - Multiple Items
// ============================================================================

export function BatchOperationsExample() {
  const deleteInvoice = useOptimisticDelete<Invoice[], Invoice>({
    endpoint: '/api/invoices',
    queryKey: ['/api/invoices'],
    itemName: 'Invoice',
  });

  const handleBatchDelete = (ids: string[]) => {
    // Delete multiple items sequentially
    // Each deletion is optimistic and can rollback individually
    ids.forEach((id) => {
      deleteInvoice.mutate(id);
    });
  };

  return null;
}

// ============================================================================
// KEY TAKEAWAYS
// ============================================================================

/**
 * 1. ALWAYS use temporary IDs with 'temp-' prefix
 * 2. ALWAYS set isPending: true for optimistic items
 * 3. ALWAYS handle loading states in UI (disable buttons, show spinners)
 * 4. ALWAYS use PendingBadge to show pending items
 * 5. ALWAYS provide user-friendly success/error messages
 * 6. Works automatically with multi-tenant query keys
 * 7. Automatically rolls back on error
 * 8. Automatically refetches after success/error for data consistency
 */
