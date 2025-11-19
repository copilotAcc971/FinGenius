import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/shared/lib/api/queryClient";
import { toast } from "@/shared/hooks/use-toast";

/**
 * Configuration options for optimistic update operations
 */
interface UseOptimisticUpdateOptions<TData, TItem> {
  /** API endpoint base (e.g., '/api/invoices') - ID will be appended */
  endpoint: string;
  
  /** Query key to update optimistically - supports tenant-scoped keys */
  queryKey: unknown[];
  
  /** Key to identify items (default: 'id') */
  idKey?: string;
  
  /** Success message for toast notification */
  successMessage?: string;
  
  /** Error message for toast notification */
  errorMessage?: string;
}

/**
 * Variables for update mutation
 */
interface UpdateVariables {
  /** ID of item to update */
  id: string | number;
  /** Partial data to update */
  data: any;
}

/**
 * Hook for optimistic update operations
 * Immediately updates item in UI, then syncs with server response
 * 
 * @example
 * ```tsx
 * const updateInvoice = useOptimisticUpdate({
 *   endpoint: '/api/invoices',
 *   queryKey: ['/api/invoices'],
 *   successMessage: 'Invoice updated successfully',
 * });
 * 
 * // In component
 * const handleStatusChange = (invoiceId, newStatus) => {
 *   updateInvoice.mutate({
 *     id: invoiceId,
 *     data: { status: newStatus }
 *   });
 * };
 * 
 * // Show pending state for specific item
 * <Select
 *   value={invoice.status}
 *   onValueChange={(status) => handleStatusChange(invoice.id, status)}
 *   disabled={updateInvoice.isPending}
 * />
 * ```
 */
export function useOptimisticUpdate<TData extends TItem[] = any[], TItem extends Record<string, any> = any>({
  endpoint,
  queryKey,
  idKey = "id",
  successMessage,
  errorMessage,
}: UseOptimisticUpdateOptions<TData, TItem>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: UpdateVariables) => {
      const response = await apiRequest(`${endpoint}/${id}`, "PATCH", data);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      // CRITICAL FIX: Handle empty responses (204 No Content)
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return null;
      }

      // Parse JSON only if there's a body
      try {
        return await response.json();
      } catch (e) {
        // If JSON parsing fails on success response, return null
        return null;
      }
    },
    onMutate: async ({ id, data }: UpdateVariables) => {
      await queryClient.cancelQueries({ queryKey });
      
      const snapshot = queryClient.getQueryData<TData>(queryKey);
      
      if (snapshot) {
        queryClient.setQueryData<TData>(queryKey, 
          snapshot.map((item) =>
            item[idKey] === id ? { ...item, ...data } : item
          ) as TData
        );
      }
      
      return { snapshot };
    },
    onError: (error: any, variables, context) => {
      // CRITICAL FIX: Always restore snapshot, even if it was undefined (empty cache)
      // This removes the optimistic item if the update failed
      queryClient.setQueryData(queryKey, context?.snapshot);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage || error.message || "An error occurred",
      });
    },
    onSuccess: (data, { id }) => {
      if (data) {
        // CRITICAL: Replace with server data, explicitly clearing isPending
        queryClient.setQueryData<TData>(queryKey, (old) => {
          if (!old) return [data] as TData;
          
          return old.map((item) =>
            item[idKey] === id ? { ...item, ...data, isPending: undefined } : item
          ) as TData;
        });
      } else {
        // CRITICAL: Handle 204/empty responses - trigger refetch
        queryClient.invalidateQueries({ queryKey });
      }
      
      if (successMessage) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
