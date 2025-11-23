import { createRoot } from "react-dom/client";
import App from "./App";
import "../styles/index.css";

// Simple console logging
console.log('[Main] Starting React app initialization...');

// Main app mounting
try {
  const rootElement = document.getElementById("root");
  console.log('[Main] Looking for root element...');
  
  if (!rootElement) {
    console.error('[Main] Root element not found!');
    throw new Error("Root element not found");
  }
  
  console.log('[Main] Root element found, creating React root...');
  const root = createRoot(rootElement);
  
  console.log('[Main] Rendering App component...');
  root.render(<App />);
  
  console.log('[Main] App component rendered successfully!');
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
          <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #000; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
            Refresh Page
          </button>
        </div>
      </div>
    `;
  }
}

console.log('[Main] Main.tsx module fully loaded');