import { createRoot } from "react-dom/client";
import App from "./App";
import "../styles/index.css";

// Add error handling
window.addEventListener('error', (event) => {
  console.error('[Main] Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Main] Unhandled promise rejection:', event.reason);
});

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
  
  console.log('[Main] App component rendered successfully');
} catch (error) {
  console.error('[Main] Failed to mount React app:', error);
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