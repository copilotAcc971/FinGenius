// Comprehensive error logging utility
export class ErrorLogger {
  private static instance: ErrorLogger;
  private errors: Array<{
    timestamp: Date;
    message: string;
    stack?: string;
    component?: string;
    userId?: string;
  }> = [];

  private constructor() {
    this.setupGlobalHandlers();
  }

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  private setupGlobalHandlers() {
    // Handle unhandled errors
    window.addEventListener('error', (event) => {
      this.logError({
        message: event.message,
        stack: event.error?.stack,
        component: 'global',
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        component: 'promise',
      });
    });

    // Handle React errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('React')) {
        this.logError({
          message,
          component: 'react',
        });
      }
      originalConsoleError.apply(console, args);
    };
  }

  logError(error: {
    message: string;
    stack?: string;
    component?: string;
    userId?: string;
  }) {
    const errorEntry = {
      timestamp: new Date(),
      ...error,
    };
    
    this.errors.push(errorEntry);
    
    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.group(`🔴 Error in ${error.component || 'unknown'}`);
      console.log('Message:', error.message);
      if (error.stack) {
        console.log('Stack:', error.stack);
      }
      console.log('Time:', errorEntry.timestamp.toISOString());
      console.groupEnd();
    }

    // Send to server in production (if needed)
    if (!import.meta.env.DEV) {
      this.sendToServer(errorEntry);
    }
  }

  private sendToServer(error: any) {
    // Send error to server for monitoring
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(error),
    }).catch(() => {
      // Silently fail if error reporting fails
    });
  }

  getErrors() {
    return this.errors;
  }

  clearErrors() {
    this.errors = [];
  }
}

// Initialize error logger
export const errorLogger = ErrorLogger.getInstance();