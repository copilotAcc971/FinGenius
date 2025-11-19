import { apiRequest } from "@/lib/queryClient";
import { useOptimisticMutation } from "./useOptimisticMutation";

/**
 * Configuration options for optimistic delete operations
 */
interface UseOptimisticDeleteOptions<TData, TItem> {
  /** API endpoint base (e.g., '/api/invoices') - ID will be appended */
  endpoint: string;
  
  /** Query key to update optimistically - supports tenant-scoped keys */
  queryKey: unknown[];
  
  /** Key to identify items (default: 'id') */
  idKey?: string;
  
  /** Name of item for user-friendly messages (e.g., 'Invoice', 'Customer') */
  itemName?: string;
  
  /** Error message for toast notification */
  errorMessage?: string;
}

/**
 * Hook for optimistic delete operations
 * Immediately removes item from UI, then syncs with server response
 * Automatically rolls back if deletion fails
 * 
 * @example
 * ```tsx
 * const deleteInvoice = useOptimisticDelete({
 *   endpoint: '/api/invoices',
 *   queryKey: ['/api/invoices'],
 *   itemName: 'Invoice',
 * });
 * 
 * // In component
 * const handleDelete = (invoiceId) => {
 *   if (confirm('Are you sure you want to delete this invoice?')) {
 *     deleteInvoice.mutate(invoiceId);
 *   }
 * };
 * 
 * // In table row
 * <Button
 *   variant="destructive"
 *   size="sm"
 *   onClick={() => handleDelete(invoice.id)}
 *   disabled={deleteInvoice.isPending}
 * >
 *   {deleteInvoice.isPending ? 'Deleting...' : 'Delete'}
 * </Button>
 * ```
 * 
 * @example With AlertDialog confirmation
 * ```tsx
 * const [deleteId, setDeleteId] = useState<string | null>(null);
 * 
 * <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
 *   <AlertDialogContent>
 *     <AlertDialogHeader>
 *       <AlertDialogTitle>Are you sure?</AlertDialogTitle>
 *       <AlertDialogDescription>
 *         This action cannot be undone.
 *       </AlertDialogDescription>
 *     </AlertDialogHeader>
 *     <AlertDialogFooter>
 *       <AlertDialogCancel>Cancel</AlertDialogCancel>
 *       <AlertDialogAction
 *         onClick={() => {
 *           deleteInvoice.mutate(deleteId!);
 *           setDeleteId(null);
 *         }}
 *       >
 *         Delete
 *       </AlertDialogAction>
 *     </AlertDialogFooter>
 *   </AlertDialogContent>
 * </AlertDialog>
 * ```
 */
export function useOptimisticDelete<TData extends TItem[] = any[], TItem extends Record<string, any> = any>({
  endpoint,
  queryKey,
  idKey = "id",
  itemName = "item",
  errorMessage,
}: UseOptimisticDeleteOptions<TData, TItem>) {
  return useOptimisticMutation<TData, string | number>({
    mutationFn: async (id) => {
      return apiRequest(`${endpoint}/${id}`, "DELETE");
    },
    queryKey,
    optimisticUpdate: (oldData, id) => {
      if (!oldData) return [] as unknown as TData;
      
      // Filter out the deleted item
      return oldData.filter((item) => item[idKey] !== id) as TData;
    },
    successMessage: `${itemName} deleted successfully`,
    errorMessage,
  });
}
