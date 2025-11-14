// Centralized Error Handling Service for Accounting Operations
// All accounting operations use these typed errors for consistent error handling

import type { Response } from 'express';

// Base class for all accounting errors
export class AccountingBaseError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public context?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      ...(process.env.NODE_ENV === 'development' && { context: this.context }),
    };
  }
}

// Validation errors (400) - Invalid input data
export class ValidationError extends AccountingBaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 400, true, context);
  }
}

// Authorization errors (403) - User lacks required permissions
export class AuthorizationError extends AccountingBaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 403, true, context);
  }
}

// Accounting errors (422) - Business rule violations (e.g., debits != credits)
export class AccountingError extends AccountingBaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 422, true, context);
  }
}

// Concurrency errors (409) - Optimistic locking failures, race conditions
export class ConcurrencyError extends AccountingBaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 409, true, context);
  }
}

// Data integrity errors (409) - Constraint violations, referential integrity
export class IntegrityError extends AccountingBaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 409, true, context);
  }
}

// AI extraction errors (422) - AI failed to extract data, low confidence
export class AIExtractionError extends AccountingBaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 422, true, context);
  }
}

// Not found errors (404)
export class NotFoundError extends AccountingBaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 404, true, context);
  }
}

// Configuration errors (500) - System misconfiguration
export class ConfigurationError extends AccountingBaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 500, false, context);
  }
}

// Service unavailable errors (503) - External service failures
export class ServiceUnavailableError extends AccountingBaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 503, true, context);
  }
}

// Error logger - logs errors with context
export function logError(error: Error, additionalContext?: Record<string, any>) {
  const timestamp = new Date().toISOString();
  
  if (error instanceof AccountingBaseError) {
    console.error(`[${timestamp}] ${error.name}: ${error.message}`, {
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      context: error.context,
      additionalContext,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } else {
    console.error(`[${timestamp}] UnhandledError: ${error.message}`, {
      additionalContext,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

// Error response handler - sanitizes error messages for client
export function sendErrorResponse(res: Response, error: Error, additionalContext?: Record<string, any>) {
  logError(error, additionalContext);

  if (error instanceof AccountingBaseError) {
    return res.status(error.statusCode).json({
      error: error.name,
      message: sanitizeErrorMessage(error.message),
      ...(process.env.NODE_ENV === 'development' && { 
        context: error.context,
        stack: error.stack 
      }),
    });
  }

  // Unknown errors - return generic 500
  return res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred. Please try again later.',
    ...(process.env.NODE_ENV === 'development' && { 
      originalMessage: error.message,
      stack: error.stack 
    }),
  });
}

// Sanitize error messages - remove sensitive information
export function sanitizeErrorMessage(message: string): string {
  // Remove potential sensitive data patterns
  let sanitized = message
    .replace(/password[=:]\s*["']?[^"'\s]+["']?/gi, 'password=***')
    .replace(/api[_-]?key[=:]\s*["']?[^"'\s]+["']?/gi, 'api_key=***')
    .replace(/token[=:]\s*["']?[^"'\s]+["']?/gi, 'token=***')
    .replace(/secret[=:]\s*["']?[^"'\s]+["']?/gi, 'secret=***')
    .replace(/authorization[=:]\s*["']?[^"'\s]+["']?/gi, 'authorization=***');

  return sanitized;
}

// Async error handler wrapper - wraps async route handlers
export function asyncHandler(
  fn: (req: any, res: Response, next: any) => Promise<any>
) {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      sendErrorResponse(res, error, {
        route: req.route?.path,
        method: req.method,
        tenantId: req.user?.tenantId,
        userId: req.user?.id,
      });
    });
  };
}

// Retry logic for transient failures ONLY
// CRITICAL: Do NOT retry deterministic errors (ValidationError, AccountingError, IntegrityError, etc.)
// These are business rule violations that will never succeed on retry.
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Immediately rethrow ALL deterministic errors - these will never succeed on retry
      if (error instanceof ValidationError ||
          error instanceof AccountingError ||
          error instanceof IntegrityError ||
          error instanceof ConcurrencyError ||
          error instanceof AuthorizationError ||
          error instanceof NotFoundError ||
          error instanceof AIExtractionError) {
        throw error;
      }
      
      // Also rethrow non-operational errors (programming errors, config issues)
      if (error instanceof AccountingBaseError && !error.isOperational) {
        throw error;
      }
      
      // Only retry transient failures (ServiceUnavailableError, network errors, timeouts)
      // Log retry attempt
      if (attempt < maxAttempts) {
        const err = error as Error;
        console.warn(`Operation failed (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms...`, {
          error: err.message,
          errorType: err.constructor.name,
        });
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= backoffMultiplier;
      }
    }
  }
  
  throw new ServiceUnavailableError(
    `Operation failed after ${maxAttempts} attempts`,
    { lastError: lastError?.message }
  );
}

// Validate journal entry balance (debits = credits)
export function validateJournalBalance(
  debits: number,
  credits: number,
  tolerance: number = 0.01
): void {
  const difference = Math.abs(debits - credits);
  
  if (difference > tolerance) {
    throw new AccountingError(
      'Journal entry is out of balance: debits must equal credits',
      {
        debits: debits.toFixed(2),
        credits: credits.toFixed(2),
        difference: difference.toFixed(2),
        tolerance,
      }
    );
  }
}

// Validate amount precision (must be 2 decimal places max)
export function validateAmountPrecision(amount: number, fieldName: string = 'amount'): void {
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  
  if (decimalPlaces > 2) {
    throw new ValidationError(
      `${fieldName} must have at most 2 decimal places`,
      { amount, decimalPlaces }
    );
  }
}

// Validate positive amount
export function validatePositiveAmount(amount: number, fieldName: string = 'amount'): void {
  if (amount <= 0) {
    throw new ValidationError(
      `${fieldName} must be positive`,
      { amount }
    );
  }
}

// Validate date range
export function validateDateRange(
  startDate: Date | string,
  endDate: Date | string,
  fieldNames: { start: string; end: string } = { start: 'startDate', end: 'endDate' }
): void {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    throw new ValidationError(
      `${fieldNames.start} cannot be after ${fieldNames.end}`,
      { startDate: start.toISOString(), endDate: end.toISOString() }
    );
  }
}
