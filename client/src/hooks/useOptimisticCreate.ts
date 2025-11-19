import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

/**
 * Configuration options for optimistic create operations
 */
interface UseOptimisticCreateOptions<TData, TItem, TVariables> {
  /** API endpoint for creating the item (e.g., '/api/invoices') */
  endpoint: string;
  
  /** Query key to update optimistically - supports tenant-scoped keys */
  queryKey: unknown[];
  
  /** 
   * Function to generate the optimistic item with temporary ID
   * @param variables - Form data or variables passed to mutation
   * @returns Optimistic item with isPending flag and temporary ID
   */
  generateOptimisticItem: (variables: TVariables) => TItem;
  
  /** Success message for toast notification */
  successMessage?: string;
  
  /** Error message for toast notification */
  errorMessage?: string;
}

/**
 * Hook for optimistic create operations
 * Immediately adds item to UI with temporary ID, then replaces with server response
 * 
 * @example
 * ```tsx
 * const createInvoice = useOptimisticCreate({
 *   endpoint: '/api/invoices',
 *   queryKey: ['/api/invoices'],
 *   generateOptimisticItem: (data) => ({
 *     ...data,
 *     id: `temp-${Date.now()}`,
 *     isPending: true,
 *     createdAt: new Date().toISOString(),
 *   }),
 *   successMessage: 'Invoice created successfully',
 * });
 * 
 * // In component
 * const handleSubmit = (formData) => {
 *   createInvoice.mutate(formData);
 * };
 * 
 * // Show pending state
 * <Button disabled={createInvoice.isPending}>
 *   {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
 * </Button>
 * ```
 */
export function useOptimisticCreate<TData extends TItem[] = any[], TItem = any, TVariables = any>({
  endpoint,
  queryKey,
  generateOptimisticItem,
  successMessage,
  errorMessage,
}: UseOptimisticCreateOptions<TData, TItem, TVariables>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const response = await apiRequest(endpoint, "POST", variables);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      // CRITICAL FIX: Check for empty response (204 No Content)
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
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey });
      
      const snapshot = queryClient.getQueryData<TData>(queryKey);
      const optimisticItem = generateOptimisticItem(variables);
      
      // CRITICAL: Store the specific optimistic ID in context
      const optimisticId = String((optimisticItem as any).id);
      
      if (snapshot) {
        queryClient.setQueryData<TData>(queryKey, [...snapshot, optimisticItem] as TData);
      } else {
        queryClient.setQueryData<TData>(queryKey, [optimisticItem] as TData);
      }
      
      return { snapshot, optimisticId };
    },
    onError: (error: any, variables, context) => {
      // CRITICAL FIX: Always restore snapshot, even if it was undefined (empty cache)
      // This removes the optimistic item if the create failed
      queryClient.setQueryData(queryKey, context?.snapshot);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage || error.message || "An error occurred",
      });
    },
    onSuccess: (data, variables, context) => {
      if (data && context?.optimisticId) {
        // CRITICAL FIX: Replace only the specific optimistic item
        queryClient.setQueryData<TData>(queryKey, (old) => {
          if (!old) return [data] as TData;
          
          return old.map((item: any) =>
            String(item.id) === context.optimisticId ? data : item
          ) as TData;
        });
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
