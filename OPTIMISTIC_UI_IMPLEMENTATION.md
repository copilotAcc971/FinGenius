# Optimistic UI Pattern System - Implementation Guide

## Overview

This document describes the comprehensive Optimistic UI pattern system implemented for the multi-tenant accounting application. The system provides instant user feedback for mutations (create, update, delete) while handling rollback gracefully on errors.

## Architecture

### Core Philosophy

The Optimistic UI pattern follows this flow:

1. **Immediate Update**: UI updates instantly before server responds
2. **Pending State**: Visual feedback shows operation in progress
3. **Server Processing**: Request sent to backend
4. **Success Path**: Show success toast, invalidate cache to get fresh data
5. **Error Path**: Rollback to previous state, show error toast

### Files Created

```
client/src/hooks/
├── useOptimisticMutation.ts  # Base hook with snapshot/rollback logic
├── useOptimisticCreate.ts    # Helper for create operations
├── useOptimisticUpdate.ts    # Helper for update operations
└── useOptimisticDelete.ts    # Helper for delete operations

client/src/components/ui/
└── pending-badge.tsx         # Visual component for pending states

client/src/examples/
└── optimistic-ui-example.tsx # Comprehensive usage examples
```

## API Reference

### 1. useOptimisticMutation (Base Hook)

**Purpose**: Core hook that provides snapshot/rollback functionality for all mutations.

**Type Signature**:
```typescript
function useOptimisticMutation<TData, TVariables, TContext>({
  mutationFn: (variables: TVariables) => Promise<Response>,
  queryKey: unknown[],
  optimisticUpdate?: (oldData: TData | undefined, variables: TVariables) => TData,
  successMessage?: string,
  errorMessage?: string,
  onSuccess?: (data: unknown, variables: TVariables, context: TContext | undefined) => void,
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void,
}): UseMutationResult
```

**Features**:
- ✅ Automatic cache snapshot before mutation
- ✅ Optimistic cache update
- ✅ Automatic rollback on error
- ✅ Toast notifications for success/error
- ✅ Multi-tenant query key support
- ✅ TypeScript type safety

### 2. useOptimisticCreate

**Purpose**: Specialized hook for creating new items with temporary IDs.

**Type Signature**:
```typescript
function useOptimisticCreate<TData extends TItem[], TItem, TVariables>({
  endpoint: string,
  queryKey: unknown[],
  generateOptimisticItem: (variables: TVariables) => TItem,
  successMessage?: string,
  errorMessage?: string,
}): UseMutationResult
```

**Key Pattern**:
```typescript
const createInvoice = useOptimisticCreate({
  endpoint: '/api/invoices',
  queryKey: ['/api/invoices'],
  generateOptimisticItem: (data) => ({
    ...data,
    id: `temp-${Date.now()}`,    // Temporary ID
    isPending: true,              // Visual flag
  }),
  successMessage: 'Invoice created successfully',
});

// Usage
createInvoice.mutate({ customerName: 'Acme Corp', amount: 1500 });
```

### 3. useOptimisticUpdate

**Purpose**: Update existing items in the cache immediately.

**Type Signature**:
```typescript
function useOptimisticUpdate<TData extends TItem[], TItem>({
  endpoint: string,
  queryKey: unknown[],
  idKey?: string,
  successMessage?: string,
  errorMessage?: string,
}): UseMutationResult<TData, UpdateVariables>
```

**Key Pattern**:
```typescript
const updateInvoice = useOptimisticUpdate({
  endpoint: '/api/invoices',
  queryKey: ['/api/invoices'],
  successMessage: 'Invoice updated',
});

// Usage
updateInvoice.mutate({
  id: 'invoice-123',
  data: { status: 'paid' }
});
```

### 4. useOptimisticDelete

**Purpose**: Remove items from cache immediately with automatic rollback on failure.

**Type Signature**:
```typescript
function useOptimisticDelete<TData extends TItem[], TItem>({
  endpoint: string,
  queryKey: unknown[],
  idKey?: string,
  itemName?: string,
  errorMessage?: string,
}): UseMutationResult<TData, string | number>
```

**Key Pattern**:
```typescript
const deleteInvoice = useOptimisticDelete({
  endpoint: '/api/invoices',
  queryKey: ['/api/invoices'],
  itemName: 'Invoice',
});

// Usage
deleteInvoice.mutate('invoice-123');
```

### 5. PendingBadge Component

**Purpose**: Visual indicator for optimistic items still being processed.

**Props**:
```typescript
interface PendingBadgeProps {
  isPending?: boolean;
}
```

**Usage**:
```tsx
<TableRow className={item.isPending ? 'opacity-60' : ''}>
  <TableCell>{item.name}</TableCell>
  <TableCell>
    <PendingBadge isPending={item.isPending} />
  </TableCell>
</TableRow>
```

## Usage Patterns

### Pattern 1: Create with Form Integration

```typescript
import { useForm } from "react-hook-form";
import { useOptimisticCreate } from "@/hooks/useOptimisticCreate";

function InvoiceForm() {
  const form = useForm({
    defaultValues: {
      customerName: '',
      amount: 0,
    },
  });

  const createInvoice = useOptimisticCreate({
    endpoint: '/api/invoices',
    queryKey: ['/api/invoices'],
    generateOptimisticItem: (data) => ({
      ...data,
      id: `temp-${Date.now()}`,
      isPending: true,
    }),
    successMessage: 'Invoice created',
  });

  const onSubmit = (data) => {
    createInvoice.mutate(data, {
      onSuccess: () => form.reset(),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}
        <Button 
          type="submit" 
          disabled={createInvoice.isPending}
        >
          {createInvoice.isPending ? 'Creating...' : 'Create'}
        </Button>
      </form>
    </Form>
  );
}
```

### Pattern 2: Update with Inline Editing

```typescript
import { useOptimisticUpdate } from "@/hooks/useOptimisticUpdate";
import { Select } from "@/components/ui/select";

function InvoiceStatusCell({ invoice }) {
  const updateInvoice = useOptimisticUpdate({
    endpoint: '/api/invoices',
    queryKey: ['/api/invoices'],
    successMessage: 'Status updated',
  });

  return (
    <Select
      value={invoice.status}
      onValueChange={(status) => {
        updateInvoice.mutate({
          id: invoice.id,
          data: { status }
        });
      }}
      disabled={updateInvoice.isPending}
    >
      <SelectItem value="draft">Draft</SelectItem>
      <SelectItem value="sent">Sent</SelectItem>
      <SelectItem value="paid">Paid</SelectItem>
    </Select>
  );
}
```

### Pattern 3: Delete with Confirmation Dialog

```typescript
import { useState } from "react";
import { useOptimisticDelete } from "@/hooks/useOptimisticDelete";
import { AlertDialog } from "@/components/ui/alert-dialog";

function InvoiceDeleteButton({ invoice }) {
  const [showDialog, setShowDialog] = useState(false);

  const deleteInvoice = useOptimisticDelete({
    endpoint: '/api/invoices',
    queryKey: ['/api/invoices'],
    itemName: 'Invoice',
  });

  const handleDelete = () => {
    deleteInvoice.mutate(invoice.id);
    setShowDialog(false);
  };

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setShowDialog(true)}
      >
        Delete
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
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
    </>
  );
}
```

### Pattern 4: Multi-Tenant Support

```typescript
import { useTenant } from "@/hooks/useTenant";
import { useOptimisticCreate } from "@/hooks/useOptimisticCreate";

function CustomerForm() {
  const { currentTenant } = useTenant();

  // Query key automatically scoped to tenant
  const createCustomer = useOptimisticCreate({
    endpoint: '/api/customers',
    queryKey: ['/api/customers', { tenantId: currentTenant.id }],
    generateOptimisticItem: (data) => ({
      ...data,
      id: `temp-${Date.now()}`,
      isPending: true,
    }),
    successMessage: 'Customer created',
  });

  // The hook automatically:
  // 1. Includes tenant header in API request
  // 2. Updates only this tenant's cache
  // 3. Invalidates only this tenant's queries

  return (/* form UI */);
}
```

## Best Practices

### 1. Always Use Temporary IDs

```typescript
// ✅ GOOD: Unique temporary ID with clear prefix
generateOptimisticItem: (data) => ({
  ...data,
  id: `temp-${Date.now()}`,
  isPending: true,
})

// ❌ BAD: No temporary ID
generateOptimisticItem: (data) => data
```

### 2. Always Flag Pending Items

```typescript
// ✅ GOOD: isPending flag for visual feedback
{
  id: 'temp-123',
  name: 'New Item',
  isPending: true,  // Used for UI feedback
}

// Then in UI:
<TableRow className={item.isPending ? 'opacity-60' : ''}>
  <TableCell>{item.name}</TableCell>
  <TableCell>
    <PendingBadge isPending={item.isPending} />
  </TableCell>
</TableRow>
```

### 3. Disable UI During Mutations

```typescript
// ✅ GOOD: Disable button while creating
<Button 
  onClick={() => mutation.mutate(data)}
  disabled={mutation.isPending}
>
  {mutation.isPending ? 'Creating...' : 'Create'}
</Button>

// ❌ BAD: No disabled state
<Button onClick={() => mutation.mutate(data)}>
  Create
</Button>
```

### 4. Provide User-Friendly Messages

```typescript
// ✅ GOOD: Clear, user-friendly messages
successMessage: 'Invoice created successfully'
errorMessage: 'Unable to create invoice. Please try again.'

// ❌ BAD: Technical jargon
successMessage: 'POST /api/invoices 201'
errorMessage: 'Error 500'
```

### 5. Handle Edge Cases

```typescript
const createInvoice = useOptimisticCreate({
  endpoint: '/api/invoices',
  queryKey: ['/api/invoices'],
  generateOptimisticItem: (data) => ({
    ...data,
    id: `temp-${Date.now()}`,
    isPending: true,
    // Provide sensible defaults
    status: data.status || 'draft',
    amount: data.amount || 0,
    createdAt: new Date().toISOString(),
  }),
  successMessage: 'Invoice created',
  // Custom error handling
  errorMessage: 'Failed to create invoice. Please check your connection.',
});
```

## Error Handling

The system automatically handles errors with:

1. **Automatic Rollback**: Previous state restored from snapshot
2. **Error Toast**: User-friendly notification shown
3. **Cache Invalidation**: Fresh data fetched from server
4. **Pending State Reset**: `isPending` flags cleared

### Custom Error Handling

```typescript
const mutation = useOptimisticCreate({
  endpoint: '/api/invoices',
  queryKey: ['/api/invoices'],
  generateOptimisticItem: (data) => ({
    ...data,
    id: `temp-${Date.now()}`,
    isPending: true,
  }),
});

// Use mutation with custom error handler
mutation.mutate(formData, {
  onError: (error) => {
    // Custom error handling logic
    console.error('Failed to create invoice:', error);
    // Show custom UI feedback
  },
  onSuccess: () => {
    // Custom success logic
    console.log('Invoice created successfully');
    // Navigate or update UI
  },
});
```

## Testing Considerations

### Unit Testing Hooks

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useOptimisticCreate } from '@/hooks/useOptimisticCreate';

test('creates item optimistically', async () => {
  const { result } = renderHook(() =>
    useOptimisticCreate({
      endpoint: '/api/items',
      queryKey: ['/api/items'],
      generateOptimisticItem: (data) => ({
        ...data,
        id: `temp-${Date.now()}`,
        isPending: true,
      }),
    })
  );

  // Trigger mutation
  result.current.mutate({ name: 'Test Item' });

  // Verify optimistic update
  await waitFor(() => {
    expect(result.current.isPending).toBe(true);
  });
});
```

### Integration Testing

Test the full flow:
1. ✅ UI updates immediately
2. ✅ Pending badge appears
3. ✅ Server request completes
4. ✅ Success toast appears
5. ✅ Fresh data loaded from server
6. ✅ Temporary ID replaced with real ID

## Performance Considerations

### Cache Efficiency

- Only updates specific query keys (tenant-scoped)
- Minimal re-renders due to optimistic updates
- Automatic cleanup of stale data

### Network Optimization

- Single invalidation after mutation
- Debounced refetches prevent request spam
- Parallel mutations supported

## Migration Guide

### Converting Existing Mutations

**Before (traditional mutation)**:
```typescript
const mutation = useMutation({
  mutationFn: (data) => apiRequest('/api/invoices', 'POST', data),
  onSuccess: () => {
    queryClient.invalidateQueries(['/api/invoices']);
    toast({ title: 'Success', description: 'Invoice created' });
  },
  onError: (error) => {
    toast({ 
      title: 'Error', 
      description: error.message,
      variant: 'destructive'
    });
  },
});
```

**After (optimistic mutation)**:
```typescript
const mutation = useOptimisticCreate({
  endpoint: '/api/invoices',
  queryKey: ['/api/invoices'],
  generateOptimisticItem: (data) => ({
    ...data,
    id: `temp-${Date.now()}`,
    isPending: true,
  }),
  successMessage: 'Invoice created successfully',
});
```

## Support & Troubleshooting

### Common Issues

**Issue**: Temporary IDs not being replaced
**Solution**: Ensure `onSettled` invalidates the correct query key

**Issue**: Optimistic update not visible
**Solution**: Check that `generateOptimisticItem` returns correct structure

**Issue**: Multiple toasts appearing
**Solution**: Disable success message if custom onSuccess handler shows toast

**Issue**: TypeScript errors with TData
**Solution**: Explicitly type the hook: `useOptimisticCreate<Invoice[], Invoice, InvoiceFormData>`

## Future Enhancements

Potential improvements for future iterations:

1. **Undo/Redo**: Toast with undo button for delete operations
2. **Batch Operations**: Support for optimistic batch mutations
3. **Conflict Resolution**: Handle concurrent updates
4. **Offline Queue**: Queue mutations when offline
5. **Optimistic Relationships**: Update related queries automatically

## E2E Testing with Playwright

### Tenant Context Bootstrap for Tests

The application requires tenant/workspace context before accessing any pages. For E2E testing, a test-only hook is exposed to set tenant context programmatically.

**Test Hook**: `window.__setTenantForTesting(tenant)`

**Location**: Exposed by `TenantProvider` in `client/src/shared/contexts/TenantContext.tsx`

**Availability**: Only in development/test mode (`import.meta.env.MODE === 'development' || 'test'`)

### Usage in Playwright Tests

**Step 1: Login and Fetch Tenant**

```typescript
// 1. Configure OIDC auto-login
await page.evaluate(() => {
  window.__setOIDCClaims({
    sub: "test-user-optimistic",
    email: "optimistic@test.com",
    first_name: "Test",
    last_name: "User"
  });
});

// 2. Navigate to login
await page.goto('/login');

// 3. Click login button (auto-login with OIDC claims)
await page.click('[data-testid*="login"]');

// 4. Wait for redirect to dashboard
await page.waitForURL('/dashboard');

// 5. Fetch tenants from API
const response = await page.request.get('/api/tenants');
const tenants = await response.json();
const testTenant = tenants[0]; // Use first tenant
```

**Step 2: Set Tenant Context Using Test Hook**

```typescript
// Set tenant context programmatically
await page.evaluate((tenant) => {
  (window as any).__setTenantForTesting(tenant);
}, testTenant);

// Wait for tenant context to be ready
await page.waitForTimeout(500); // Allow tenant session to propagate
```

**Step 3: Navigate to Feature Pages**

```typescript
// Now you can navigate to any tenant-protected page
await page.goto('/invoices');

// Page will render with tenant context
await page.waitForSelector('[data-testid="table-invoices"]');
```

### Complete E2E Test Example: Optimistic Invoice Creation

```typescript
test('optimistic UI - concurrent invoice creates', async ({ page }) => {
  // SETUP: Login and set tenant context
  await page.evaluate(() => {
    (window as any).__setOIDCClaims({
      sub: "test-user-concurrent",
      email: "concurrent@test.com",
      first_name: "Test",
      last_name: "User"
    });
  });
  
  await page.goto('/login');
  await page.click('[data-testid*="login"]');
  await page.waitForURL('/dashboard');
  
  const response = await page.request.get('/api/tenants');
  const tenants = await response.json();
  
  await page.evaluate((tenant) => {
    (window as any).__setTenantForTesting(tenant);
  }, tenants[0]);
  
  await page.waitForTimeout(500);
  
  // TEST: Navigate to invoices page
  await page.goto('/invoices');
  await page.waitForSelector('[data-testid="button-create-invoice"]');
  
  // TEST: Create first invoice (optimistic)
  await page.click('[data-testid="button-create-invoice"]');
  await page.fill('[data-testid="input-customer"]', 'Customer A');
  await page.fill('[data-testid="input-amount"]', '100');
  await page.click('[data-testid="button-submit"]');
  
  // VERIFY: Optimistic item appears immediately with pending badge
  await expect(page.locator('[data-testid*="invoice"][data-testid*="pending"]'))
    .toBeVisible({ timeout: 500 });
  
  // TEST: Create second invoice concurrently
  await page.click('[data-testid="button-create-invoice"]');
  await page.fill('[data-testid="input-customer"]', 'Customer B');
  await page.fill('[data-testid="input-amount"]', '200');
  await page.click('[data-testid="button-submit"]');
  
  // VERIFY: Both invoices visible (one or both may be pending)
  const invoices = await page.locator('[data-testid*="invoice"]').count();
  expect(invoices).toBeGreaterThanOrEqual(2);
  
  // VERIFY: Wait for server confirmation - pending badges disappear
  await expect(page.locator('[data-testid*="pending"]'))
    .toHaveCount(0, { timeout: 3000 });
  
  // VERIFY: Both invoices have real IDs (not temp-)
  const firstInvoiceId = await page.locator('[data-testid*="invoice"]').first()
    .getAttribute('data-testid');
  expect(firstInvoiceId).not.toContain('temp-');
});
```

### Test Hook Security

**Important**: The `window.__setTenantForTesting` hook is:
- ✅ Only exposed in development/test mode
- ✅ Automatically cleaned up on component unmount
- ✅ Uses the same `tenantSession.setTenant()` logic as `WorkspaceSwitcher`
- ✅ Properly triggers all tenant context events and updates
- ❌ NOT available in production builds

**Production Safety**: In production builds (`import.meta.env.MODE === 'production'`), the hook is never exposed, ensuring security.

### Troubleshooting E2E Tests

**Issue**: "No workspace selected" error
**Solution**: Ensure you call `window.__setTenantForTesting(tenant)` after login and before navigating to feature pages

**Issue**: Tenant context timeout
**Solution**: Add `await page.waitForTimeout(500)` after setting tenant to allow session propagation

**Issue**: 404 on feature pages
**Solution**: Verify tenant was fetched from `/api/tenants` and passed to test hook correctly

**Issue**: Test hook not found
**Solution**: Check that `import.meta.env.MODE` is 'development' or 'test', not 'production'

## Conclusion

This Optimistic UI system provides:

✅ **Instant Feedback**: UI updates immediately
✅ **Error Safety**: Automatic rollback on failure
✅ **Type Safety**: Full TypeScript support
✅ **Multi-Tenancy**: Works with tenant-scoped queries
✅ **Developer Experience**: Simple, consistent API
✅ **User Experience**: Clear visual feedback at all stages
✅ **E2E Testing**: Test-only hook for Playwright integration

The system is production-ready and can be used throughout the application for all mutation operations.
