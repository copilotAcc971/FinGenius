import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startFXRatesUpdateJob } from "./jobs/fx-rates-update";
import { initializeScheduledReports, initializeUploadCleanup } from "./cron";
import { initializeTransactionSync } from "./jobs/transaction-sync";
import { initializeAlertEngine } from "./jobs/alert-engine";
import { initializeDailyAlerts } from "./jobs/daily-alerts";
import { initializeWeeklyCreditPassport } from "./jobs/weekly-credit-passport";
import { getBackgroundIndexer } from "./rag/background-indexer";
import { seedPermissions } from './scripts/seed-rbac';
import { initializeRBACForAllTenants } from './scripts/update-owner-permissions';
import { webhookRouter } from './routes-webhook';
import { inboundWebhooksRouter } from './routes-inbound-webhooks';
import { createAICopilotWebSocketServer } from './ai-copilot/websocket-server';
import { createDashboardMetricsWebSocketServer } from './dashboard/metrics-websocket-server';
import { logBypassStatus, RBAC_BYPASS_ENABLED } from './rbac/dev-bypass';
import { ensureVapidKeys } from './services/vapid-generator';

const app = express();

// Enable compression for all responses (30-50% size reduction)
app.use(compression({
  filter: (req, res) => {
    // Compress everything except already-compressed formats
    const type = res.getHeader('Content-Type');
    if (type && typeof type === 'string') {
      return !type.includes('image/') && !type.includes('video/');
    }
    return true;
  },
  level: 6, // Balance between compression ratio and speed
}));

// CRITICAL: Mount webhook routers BEFORE express.json() to preserve raw body for HMAC
app.use('/api/open-banking/webhooks', webhookRouter);
app.use('/api/webhooks', inboundWebhooksRouter);

// Parse JSON for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Initialize AI Copilot WebSocket server
  createAICopilotWebSocketServer(server);

  // Initialize Dashboard Metrics WebSocket server
  createDashboardMetricsWebSocketServer(server);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Log RBAC bypass status
    logBypassStatus();
    
    // Auto-generate VAPID keys if not configured
    try {
      await ensureVapidKeys();
    } catch (error) {
      console.error('[VAPID] Failed to initialize keys:', error);
    }
    
    // Initialize RBAC and scheduled reports
    try {
      // Skip RBAC initialization in bypass mode to speed up development
      if (!RBAC_BYPASS_ENABLED) {
        await seedPermissions();
        await initializeRBACForAllTenants();
      }
      
      // Initialize scheduled reports with proper await
      await initializeScheduledReports();
      
      // Initialize daily transaction sync job
      initializeTransactionSync();
      
      // Initialize AI Copilot upload cleanup job
      initializeUploadCleanup();
    } catch (error) {
      console.error('Error during server initialization:', error);
    }
    
    // Initialize FX rates scheduled job
    startFXRatesUpdateJob();
    
    // Initialize Alert Engine (runs daily at 9 AM UTC)
    initializeAlertEngine();
    
    // Initialize Daily Alerts Job (Task 7-28: runs daily at 9 AM UTC)
    initializeDailyAlerts();
    
    // Initialize Weekly Credit Passport Job (Task 7-29: runs Monday at 8 AM UTC)
    initializeWeeklyCreditPassport();
    
    // Initialize RAG background indexer (runs nightly at 2 AM UTC)
    const backgroundIndexer = getBackgroundIndexer();
    backgroundIndexer.start();
  });
})();
