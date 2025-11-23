import { createRoot } from "react-dom/client";
import App from "./App";
import "../styles/index.css";
import { errorLogger } from "@/shared/utils/error-logger";

// Initialize error logging
console.log('[Main] Initializing error logger...');

// Add performance monitoring
const startTime = performance.now();

console.log('[Main] Starting React app...');

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  
  console.log('[Main] Root element found, creating React root...');
  const root = createRoot(rootElement);
  
  console.log('[Main] Rendering App component...');
  root.render(<App />);
  
  const loadTime = performance.now() - startTime;
  console.log(`[Main] App component rendered successfully in ${loadTime.toFixed(2)}ms`);
  
  // Log performance metrics
  if (window.performance && window.performance.timing) {
    const timing = window.performance.timing;
    const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
    const connectTime = timing.responseEnd - timing.requestStart;
    const renderTime = timing.domComplete - timing.domLoading;
    
    console.group('📊 Performance Metrics');
    console.log(`Page Load Time: ${pageLoadTime}ms`);
    console.log(`Server Response Time: ${connectTime}ms`);
    console.log(`DOM Render Time: ${renderTime}ms`);
    console.log(`React Mount Time: ${loadTime.toFixed(2)}ms`);
    console.groupEnd();
  }
} catch (error) {
  errorLogger.logError({
    message: `Failed to mount React app: ${error}`,
    stack: error?.stack,
    component: 'main',
  });
  
  // Show error to user
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Inter, system-ui, sans-serif;">
        <div style="text-align: center; max-width: 500px; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
          <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 10px;">Failed to Load Application</h1>
          <p style="color: #666; margin-bottom: 20px;">An error occurred while initializing the application. Please refresh the page to try again.</p>
          <pre style="text-align: left; background: #f4f4f4; padding: 10px; border-radius: 4px; font-size: 12px; overflow: auto;">${error}</pre>
          <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #000; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
            Refresh Page
          </button>
        </div>
      </div>
    `;
  }
}

// Service Worker registration (non-blocking)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('[PWA] Service Worker registered successfully:', registration.scope);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[PWA] Service Worker update found');
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New Service Worker available - page refresh recommended');
            }
          });
        }
      });
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  });
}