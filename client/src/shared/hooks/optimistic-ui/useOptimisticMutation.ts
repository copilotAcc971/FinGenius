import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/shared/hooks/use-toast";

/**
 * Configuration options for optimistic mutations
 */
interface UseOptimisticMutationOptions<TData, TVariables, TContext = unknown> {
  /** The actual API call function that performs the mutation */
  mutationFn: (variables: TVariables) => Promise<Response>;
  
  /** The query key(s) to update optimistically - supports tenant-scoped keys */
  queryKey: unknown[];
  
  /** 
   * Function to compute the optimistic data update
   * @param oldData - Current cached data
   * @param variables - Variables passed to the mutation
   * @returns The new optimistic data
   */
  optimisticUpdate?: (oldData: TData | undefined, variables: TVariables) => TData;
  
  /** Success message to display in toast (optional) */
  successMessage?: string;
  
  /** Error message to display in toast (optional, will use error.message as fallback) */
  errorMessage?: string;
  
  /** Custom success handler */
  onSuccess?: (data: unknown, variables: TVariables, context: TContext | undefined) => void;
  
  /** Custom error handler */
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
}

/**
 * Base hook for optimistic mutations with automatic rollback on error
 * 
 * @example
 * ```tsx
 * const mutation = useOptimisticMutation({
 *   mutationFn: (data) => apiRequest('/api/items', 'POST', data),
 *   queryKey: ['/api/items'],
 *   optimisticUpdate: (oldData, newItem) => [...(oldData || []), newItem],
 *   successMessage: 'Item created successfully',
 * });
 * 
 * // Use in component
 * <Button onClick={() => mutation.mutate(formData)}>
 *   {mutation.isPending ? 'Creating...' : 'Create'}
 * </Button>
 * ```
 */
export function useOptimisticMutation<TData = unknown, TVariables = unknown, TContext = unknown>({
  mutationFn,
  queryKey,
  optimisticUpdate,
  successMessage,
  errorMessage,
  onSuccess,
  onError,
}: UseOptimisticMutationOptions<TData, TVariables, TContext>) {
  const queryClient = useQueryClient();

  return useMutation({
    // CRITICAL FIX: Wrap mutationFn to check response.ok and handle 204 responses
    mutationFn: async (variables: TVariables) => {
      const response = await mutationFn(variables);
      
      // Check response status and throw on error
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

    // PHASE 1: Before mutation - Save snapshot and apply optimistic update
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to prevent them from overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update to the new value if update function provided
      if (optimisticUpdate) {
        queryClient.setQueryData<TData>(queryKey, (old) => optimisticUpdate(old, variables));
      }

      // Return context object with snapshot for rollback
      return { previousData } as TContext;
    },

    // PHASE 2: On error - Rollback to snapshot
    onError: (error, variables, context) => {
      // CRITICAL FIX: Always restore previousData, even if it was undefined (empty cache)
      // This removes the optimistic item if the mutation failed
      queryClient.setQueryData(queryKey, (context as any)?.previousData);

      // Show user-friendly error toast
      toast({
        title: "Error",
        description: errorMessage || error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });

      // Call custom error handler if provided
      onError?.(error as Error, variables, context);
    },

    // PHASE 3: On success - Intelligently merge server response into cache
    onSuccess: async (data, variables, context) => {
      // CRITICAL: Handle 204/empty responses - trigger refetch
      if (!data) {
        queryClient.invalidateQueries({ queryKey });
        if (successMessage) {
          toast({
            title: "Success",
            description: successMessage,
          });
        }
        onSuccess?.(data, variables, context);
        return;
      }
      
      // Update cache with server response if data is provided
      if (data) {
        queryClient.setQueryData(queryKey, (old: any) => {
          // If server returned an array, use it as-is
          if (Array.isArray(data)) {
            return data;
          }
          
          // If server returned a single object and cache is an array
          if (Array.isArray(old) && typeof data === 'object') {
            // This is a create/update - find and replace the matching item
            const hasTemp = old.some(item => 
              typeof item === 'object' && 
              item !== null && 
              'id' in item && 
              String(item.id).startsWith('temp-')
            );
            
            if (hasTemp) {
              // Replace first temp item with server response (for creates)
              let replaced = false;
              return old.map(item => {
                if (!replaced && 
                    typeof item === 'object' && 
                    item !== null && 
                    'id' in item && 
                    String(item.id).startsWith('temp-')) {
                  replaced = true;
                  return data;
                }
                return item;
              });
            }
            
            // For updates, try to find by real ID
            if ('id' in data) {
              const updated = old.map(item => {
                if (typeof item === 'object' &&
                    item !== null &&
                    'id' in item &&
                    item.id === data.id) {
                  // CRITICAL: Replace with server data, explicitly clearing isPending
                  return { ...item, ...data, isPending: undefined };
                }
                return item;
              });
              
              // If we found and updated an item, return updated array
              if (updated.some((item, idx) => item !== old[idx])) {
                return updated;
              }
            }
            
            // If we couldn't find a match, don't break the array - just return old
            return old;
          }
          
          // If both are objects, return the new data
          if (typeof data === 'object' && typeof old === 'object' && !Array.isArray(old)) {
            return data;
          }
          
          // Fallback: return data as-is
          return data;
        });
      }
      
      // Show success toast if message provided
      if (successMessage) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }

      // Call custom success handler if provided
      onSuccess?.(data, variables, context);
    },

    // PHASE 4: Always invalidate to get fresh server data
    onSettled: () => {
      // Refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
