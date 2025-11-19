import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { tenantSession } from "../auth/tenantSession";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function getTenantIdFromSession(timeout: number = 5000): Promise<string> {
  try {
    console.log("[queryClient] Waiting for tenant context...");
    const tenant = await tenantSession.waitForTenant(timeout);
    
    if (!tenant) {
      console.error("[queryClient] Tenant context unavailable after timeout");
      throw new Error(
        "No workspace selected. Please select a workspace to continue."
      );
    }
    
    // Double-check tenant hasn't been lost between await and fetch
    const currentTenant = tenantSession.getTenant();
    if (!currentTenant) {
      console.error("[queryClient] Tenant lost between wait and fetch");
      throw new Error(
        "Workspace disconnected. Please select a workspace to continue."
      );
    }
    
    console.log("[queryClient] Tenant context obtained:", currentTenant.name);
    return currentTenant.id;
  } catch (error) {
    console.error("[queryClient] Failed to get tenant context:", error);
    throw error instanceof Error ? error : new Error("Failed to load workspace context. Please select a workspace and try again.");
  }
}

export async function apiRequest(
  url: string,
  method: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  // Wait for tenant context before making API request
  // This will throw if tenant is unavailable
  const tenantId = await getTenantIdFromSession();
  headers["x-tenant-id"] = tenantId;
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Separate path segments from query params object
    const stringSegments: string[] = [];
    let queryParams: Record<string, string> = {};
    
    for (const segment of queryKey) {
      if (typeof segment === 'string') {
        stringSegments.push(segment);
      } else if (typeof segment === 'object' && segment !== null) {
        // Last object in queryKey is treated as query parameters
        queryParams = segment as Record<string, string>;
      }
    }
    
    // Build URL with query string if params exist
    let url = stringSegments.join("/");
    if (Object.keys(queryParams).length > 0) {
      const searchParams = new URLSearchParams(queryParams);
      url += `?${searchParams.toString()}`;
    }
    
    // Wait for tenant context before making API request
    // This will throw if tenant is unavailable
    const headers: Record<string, string> = {};
    const tenantId = await getTenantIdFromSession();
    headers["x-tenant-id"] = tenantId;
    
    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const defaultQueryFn = getQueryFn({ on401: "throw" });

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
