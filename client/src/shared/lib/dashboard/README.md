# Dashboard Metrics WebSocket Client

Real-time dashboard metrics client with auto-reconnect and connection state management.

## Usage

### Basic Usage in a Component

```tsx
import { useDashboardMetrics } from '@/shared/lib/dashboard/dashboard-metrics-client';
import { useTenant } from '@/shared/hooks/useTenant';

function DashboardPage() {
  const { tenantId } = useTenant();
  const { metrics, connectionState, error, refresh, isConnected } = useDashboardMetrics(tenantId);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!metrics) {
    return <div>Loading metrics...</div>;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <div>Connection: {connectionState}</div>
      
      {/* Display metrics */}
      <div>Revenue Today: ${metrics.kpis.totalRevenueToday}</div>
      <div>Expenses Today: ${metrics.kpis.totalExpensesToday}</div>
      <div>Cash Position: ${metrics.kpis.cashPosition}</div>
      
      {/* Manual refresh */}
      <button onClick={refresh} disabled={!isConnected}>
        Refresh Metrics
      </button>
    </div>
  );
}
```

### Return Values

- `metrics`: Dashboard metrics data (null until first update received)
- `connectionState`: Current connection state ('disconnected' | 'connecting' | 'connected' | 'error')
- `error`: Error message if any (null when no error)
- `refresh()`: Function to manually request fresh metrics
- `reconnect()`: Function to force reconnection
- `isConnected`: Boolean indicating if currently connected

### Connection States

- **disconnected**: Not connected to WebSocket
- **connecting**: Attempting to establish connection
- **connected**: Successfully connected and receiving updates
- **error**: Connection error occurred

### Features

- ✅ **Auto-reconnect**: Automatically reconnects with exponential backoff (up to 5 attempts)
- ✅ **Session-based auth**: Uses browser session cookies (no manual token management)
- ✅ **Heartbeat**: Maintains connection health with ping/pong
- ✅ **Real-time updates**: Receives metrics updates as they happen
- ✅ **Manual refresh**: Request fresh metrics on-demand
- ✅ **TypeScript**: Fully typed metrics structure
- ✅ **Cleanup**: Automatically disconnects on unmount

### Metrics Structure

```typescript
interface DashboardMetrics {
  timestamp: string;
  tenantId: string;
  kpis: {
    totalRevenueToday: string;
    totalExpensesToday: string;
    outstandingInvoices: { count: number; total: string };
    overdueInvoices: { count: number; total: string };
    pendingPayments: { count: number; total: string };
    cashPosition: string;
    arAgingSummary: {
      current: string;
      days30: string;
      days60: string;
      days90Plus: string;
    };
    apAgingSummary: {
      current: string;
      days30: string;
      days60: string;
      days90Plus: string;
    };
  };
}
```

### Advanced Usage - Direct Client

If you need more control, use the `DashboardMetricsClient` class directly:

```typescript
import { DashboardMetricsClient } from '@/shared/lib/dashboard/dashboard-metrics-client';

const client = new DashboardMetricsClient();

// Set up callbacks
client.onMetricsUpdate = (metrics) => {
  console.log('New metrics:', metrics);
};

client.onConnectionStateChange = (state) => {
  console.log('Connection state:', state);
};

client.onError = (error) => {
  console.error('Error:', error);
};

// Connect
await client.connect('tenant-id-123');

// Request update
client.requestUpdate();

// Disconnect
client.disconnect();
```

## Backend Integration

This client connects to the WebSocket server at `/ws/dashboard-metrics` which:

- Authenticates via session cookies
- Requires `tenantId` query parameter
- Sends initial metrics on connection
- Broadcasts updates when metrics change
- Supports manual refresh requests

See `server/dashboard/metrics-websocket-server.ts` for backend implementation.
