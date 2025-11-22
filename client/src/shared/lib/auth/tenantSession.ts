import type { Tenant } from "@shared/schema";

const STORAGE_KEY = "currentTenant";
const STORAGE_EVENT_KEY = "tenant-sync";

type EventName = "ready" | "tenant-changed" | "tenant-lost";
type EventCallback = (tenant: Tenant | null) => void;

class TenantSession {
  private _ready: boolean = false;
  private _tenant: Tenant | null = null;
  private _listeners: Map<EventName, Set<EventCallback>> = new Map();
  private _readyPromise: Promise<void> | null = null;
  private _readyResolve: (() => void) | null = null;

  constructor() {
    this._initReadyPromise();
    this._setupStorageListener();
  }

  private _initReadyPromise() {
    this._readyPromise = new Promise((resolve) => {
      this._readyResolve = resolve;
    });
  }

  private _setupStorageListener() {
    if (typeof window === "undefined") return;

    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY) {
        const newValue = event.newValue;
        
        if (newValue) {
          try {
            const tenant = JSON.parse(newValue) as Tenant;
            console.log("[TenantSession] Cross-tab tenant change detected:", tenant.name);
            this._tenant = tenant;
            this._emit("tenant-changed", tenant);
          } catch (e) {
            console.error("[TenantSession] Failed to parse cross-tab tenant update", e);
          }
        } else {
          console.log("[TenantSession] Cross-tab tenant cleared");
          this._tenant = null;
          this._emit("tenant-lost", null);
        }
      }
    });
  }

  initialize(): void {
    if (this._ready) {
      console.log("[TenantSession] Already initialized");
      return;
    }

    console.log("[TenantSession] Initializing...");
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this._tenant = JSON.parse(stored);
        console.log("[TenantSession] Hydrated tenant from localStorage:", this._tenant?.name);
      } else {
        console.log("[TenantSession] No tenant found in localStorage");
      }
    } catch (e) {
      console.error("[TenantSession] Failed to hydrate from localStorage", e);
      localStorage.removeItem(STORAGE_KEY);
    }

    this._ready = true;
    this._readyResolve?.();
    this._emit("ready", this._tenant);
    
    console.log("[TenantSession] Initialized. Ready:", this._ready, "Tenant:", this._tenant?.name || "none");
  }

  async waitForReady(timeout: number = 5000): Promise<void> {
    if (this._ready) return;
    
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error("TenantSession ready timeout")), timeout);
    });

    await Promise.race([this._readyPromise, timeoutPromise]);
  }

  async waitForTenant(timeout: number = 5000): Promise<Tenant | null> {
    console.log("[TenantSession] waitForTenant called, timeout:", timeout);
    
    await this.waitForReady(timeout);

    if (this._tenant) {
      console.log("[TenantSession] Tenant available:", this._tenant.name);
      return this._tenant;
    }

    // If no tenant is currently set, return null immediately
    // Don't wait for tenant-changed events that may never come
    console.log("[TenantSession] No tenant set, returning null");
    return null;
  }

  setTenant(tenant: Tenant | null): void {
    console.log("[TenantSession] setTenant called:", tenant?.name || "null");
    
    const hadTenant = !!this._tenant;
    const hasNewTenant = !!tenant;
    
    this._tenant = tenant;

    try {
      if (tenant) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tenant));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error("[TenantSession] Failed to update localStorage", e);
    }

    if (tenant) {
      this._emit("tenant-changed", tenant);
    } else if (hadTenant && !hasNewTenant) {
      this._emit("tenant-lost", null);
    }
  }

  getTenant(): Tenant | null {
    return this._tenant;
  }

  isReady(): boolean {
    return this._ready;
  }

  on(event: EventName, callback: EventCallback): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(callback);
  }

  off(event: EventName, callback: EventCallback): void {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private _emit(event: EventName, tenant: Tenant | null): void {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(tenant);
        } catch (e) {
          console.error(`[TenantSession] Error in ${event} listener:`, e);
        }
      });
    }
  }
}

export const tenantSession = new TenantSession();
