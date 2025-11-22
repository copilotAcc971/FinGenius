import crypto from 'crypto';
import {
  IOpenBankingPaymentProvider,
  OpenBankingProvider,
  TokenResponse,
  BankAccount,
  Balance,
  Transaction,
  Identity,
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
  PaymentLink,
  PaymentLinkRequest,
  TransactionOptions,
} from './base-provider';

// Retry configuration
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

// Circuit breaker configuration
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

export class LeanProvider implements IOpenBankingPaymentProvider {
  provider: OpenBankingProvider = 'lean';
  
  private appToken: string;
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private sandboxMode: boolean;
  private webhookSecret: string;
  
  // Retry configuration with exponential backoff
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 16000,    // 16 seconds
    backoffMultiplier: 2,
  };
  
  // Circuit breaker state
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed',
  };
  
  // Circuit breaker configuration
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_RESET_TIME = 60000; // 1 minute
  
  // Request timeout (30 seconds)
  private readonly REQUEST_TIMEOUT = 30000;

  constructor() {
    // Load environment variables
    this.appToken = process.env.LEAN_APP_TOKEN || '';
    this.clientId = process.env.LEAN_CLIENT_ID || '';
    this.clientSecret = process.env.LEAN_CLIENT_SECRET || '';
    this.webhookSecret = process.env.LEAN_WEBHOOK_SECRET || '';
    this.sandboxMode = process.env.LEAN_SANDBOX_MODE !== 'false';
    
    // Set base URL based on sandbox mode
    this.baseUrl = this.sandboxMode
      ? 'https://sandbox.leantech.me'
      : 'https://api.leantech.me';

    // Log configuration (without sensitive data)
    console.log('[LeanProvider] Initialized', {
      sandboxMode: this.sandboxMode,
      baseUrl: this.baseUrl,
      hasAppToken: !!this.appToken,
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      hasWebhookSecret: !!this.webhookSecret,
      retryConfig: this.retryConfig,
      requestTimeout: this.REQUEST_TIMEOUT,
    });
  }

  /**
   * Helper: Create a fetch with timeout
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.REQUEST_TIMEOUT}ms`);
      }
      throw error;
    }
  }

  /**
   * Helper: Check circuit breaker state
   */
  private checkCircuitBreaker(): void {
    const now = Date.now();
    
    // Reset circuit breaker if enough time has passed
    if (this.circuitBreaker.state === 'open' && 
        now - this.circuitBreaker.lastFailureTime > this.CIRCUIT_BREAKER_RESET_TIME) {
      console.log('[LeanProvider] Circuit breaker: Resetting to half-open');
      this.circuitBreaker.state = 'half-open';
      this.circuitBreaker.failures = 0;
    }
    
    // Throw error if circuit is open
    if (this.circuitBreaker.state === 'open') {
      throw new Error('Circuit breaker is OPEN: Too many failures. Service is temporarily unavailable.');
    }
  }

  /**
   * Helper: Update circuit breaker on failure
   */
  private updateCircuitBreakerOnFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      console.error('[LeanProvider] Circuit breaker: Opening circuit after', this.circuitBreaker.failures, 'failures');
      this.circuitBreaker.state = 'open';
    }
  }

  /**
   * Helper: Update circuit breaker on success
   */
  private updateCircuitBreakerOnSuccess(): void {
    if (this.circuitBreaker.state === 'half-open') {
      console.log('[LeanProvider] Circuit breaker: Closing circuit after successful request');
      this.circuitBreaker.state = 'closed';
    }
    this.circuitBreaker.failures = 0;
  }

  /**
   * Helper: Sleep for exponential backoff
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Execute request with exponential backoff retry
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    refreshToken?: string
  ): Promise<T> {
    // Check circuit breaker first
    this.checkCircuitBreaker();
    
    let lastError: Error | null = null;
    let delay = this.retryConfig.initialDelay;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[LeanProvider] ${context}: Retry attempt ${attempt} after ${delay}ms delay`);
          await this.sleep(delay);
        }
        
        const result = await operation();
        
        // Success - update circuit breaker
        this.updateCircuitBreakerOnSuccess();
        
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a 401 and we have a refresh token
        if (error.message?.includes('authentication failed') && refreshToken && attempt === 0) {
          console.log('[LeanProvider] Got 401, attempting token refresh...');
          try {
            // Try to refresh the token
            const newTokens = await this.refreshAccessToken(refreshToken);
            console.log('[LeanProvider] Token refreshed successfully');
            // Return the new tokens so the caller can retry with the new access token
            throw new Error(`TOKEN_REFRESHED:${JSON.stringify(newTokens)}`);
          } catch (refreshError: any) {
            console.error('[LeanProvider] Token refresh failed:', refreshError);
            // Continue with the original error
          }
        }
        
        // Check if it's a rate limit error (429)
        const isRateLimit = error.message?.includes('rate limit');
        
        // Check if error is retryable
        const isRetryable = 
          isRateLimit ||
          error.message?.includes('timeout') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('ENOTFOUND') ||
          error.message?.includes('network');
        
        if (!isRetryable || attempt === this.retryConfig.maxRetries) {
          console.error(`[LeanProvider] ${context}: Failed after ${attempt + 1} attempts`, error);
          this.updateCircuitBreakerOnFailure();
          throw error;
        }
        
        // For rate limits, use longer delay
        if (isRateLimit) {
          delay = Math.min(delay * 4, this.retryConfig.maxDelay);
        } else {
          // Regular exponential backoff
          delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelay);
        }
      }
    }
    
    // This should never be reached, but just in case
    this.updateCircuitBreakerOnFailure();
    throw lastError || new Error(`${context}: Operation failed`);
  }

  /**
   * OAuth2: Get authorization URL for user to connect their bank
   * Note: Lean uses Link SDK for connection, this is a placeholder
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      state: state,
      client_id: this.clientId,
      response_type: 'code',
      scope: 'accounts transactions payments identity',
    });

    return `${this.baseUrl}/connect/v2?${params.toString()}`;
  }

  /**
   * OAuth2: Exchange authorization code for access tokens
   * Note: Placeholder implementation - actual Lean flow uses entity_id + customer_id
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'lean-app-token': this.appToken,
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LeanProvider] Token exchange failed', {
          status: response.status,
          error: errorText,
        });
        throw new Error(`Lean token exchange failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 3600,
      };
    }, 'exchangeCodeForTokens');
  }

  /**
   * OAuth2: Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'lean-app-token': this.appToken,
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LeanProvider] Token refresh failed', {
          status: response.status,
          error: errorText,
        });
        
        // Handle rate limiting
        if (response.status === 429) {
          throw new Error('Lean API rate limit exceeded. Please try again later.');
        }
        
        // Handle authentication errors
        if (response.status === 401) {
          throw new Error('Lean authentication failed. Token may be invalid or expired.');
        }
        
        throw new Error(`Lean token refresh failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 3600,
      };
    }, 'refreshAccessToken');
  }

  /**
   * Webhook: Verify webhook signature using HMAC-SHA256
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn('[LeanProvider] Webhook secret not configured');
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('[LeanProvider] Webhook signature verification error', error);
      return false;
    }
  }

  /**
   * Data API: Get all bank accounts for the connected entity
   * With automatic retry, token refresh, and circuit breaker protection
   */
  async getAccounts(accessToken: string, refreshToken?: string): Promise<BankAccount[]> {
    return this.executeWithRetry(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/data/v2/accounts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'lean-app-token': this.appToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LeanProvider] Get accounts failed', {
          status: response.status,
          error: errorText,
        });
        
        if (response.status === 429) {
          throw new Error('Lean API rate limit exceeded. Please try again later.');
        }
        
        if (response.status === 401) {
          throw new Error('Lean authentication failed. Please reconnect your bank account.');
        }
        
        throw new Error(`Lean get accounts failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Map Lean API response to our BankAccount interface
      return (data.accounts || []).map((account: any) => ({
        accountId: account.id || account.account_id,
        accountName: account.name || account.account_name || 'Unknown Account',
        accountType: account.type || 'other',
        currency: account.currency || 'AED',
        balance: account.balance?.current,
        availableBalance: account.balance?.available,
      }));
    }, 'getAccounts', refreshToken);
  }

  /**
   * Data API: Get account balance for a specific account
   */
  async getAccountBalance(accessToken: string, accountId: string, refreshToken?: string): Promise<Balance> {
    return this.executeWithRetry(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/data/v2/accounts/${accountId}/balance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'lean-app-token': this.appToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LeanProvider] Get balance failed', {
          status: response.status,
          accountId,
          error: errorText,
        });
        
        if (response.status === 429) {
          throw new Error('Lean API rate limit exceeded. Please try again later.');
        }
        
        if (response.status === 401) {
          throw new Error('Lean authentication failed. Please reconnect your bank account.');
        }
        
        throw new Error(`Lean get balance failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        currency: data.currency || 'AED',
        amount: data.current || data.balance || 0,
        availableAmount: data.available,
        asOf: data.as_of_date ? new Date(data.as_of_date) : new Date(),
      };
    }, 'getAccountBalance', refreshToken);
  }

  /**
   * Data API: Get transactions for a specific account
   */
  async getTransactions(
    accessToken: string,
    accountId: string,
    options?: TransactionOptions,
    refreshToken?: string
  ): Promise<Transaction[]> {
    return this.executeWithRetry(async () => {
      const params = new URLSearchParams();
      
      if (options?.startDate) {
        params.append('from_date', options.startDate.toISOString().split('T')[0]);
      }
      
      if (options?.endDate) {
        params.append('to_date', options.endDate.toISOString().split('T')[0]);
      }
      
      if (options?.limit) {
        params.append('limit', options.limit.toString());
      }

      const url = `${this.baseUrl}/data/v2/accounts/${accountId}/transactions${params.toString() ? '?' + params.toString() : ''}`;

      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'lean-app-token': this.appToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LeanProvider] Get transactions failed', {
          status: response.status,
          accountId,
          error: errorText,
        });
        
        if (response.status === 429) {
          throw new Error('Lean API rate limit exceeded. Please try again later.');
        }
        
        if (response.status === 401) {
          throw new Error('Lean authentication failed. Please reconnect your bank account.');
        }
        
        throw new Error(`Lean get transactions failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Map Lean API response to our Transaction interface
      return (data.transactions || []).map((txn: any) => ({
        transactionId: txn.id || txn.transaction_id,
        date: new Date(txn.date || txn.transaction_date),
        description: txn.description || txn.narrative || '',
        amount: Math.abs(txn.amount || 0),
        currency: txn.currency || 'AED',
        type: (txn.amount < 0 || txn.type === 'debit') ? 'debit' : 'credit',
        pending: txn.pending || txn.status === 'pending' || false,
      }));
    }, 'getTransactions', refreshToken);
  }

  /**
   * Data API: Get identity/KYC information for the connected account
   */
  async getIdentity(accessToken: string, refreshToken?: string): Promise<Identity> {
    return this.executeWithRetry(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/data/v2/identity`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'lean-app-token': this.appToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LeanProvider] Get identity failed', {
          status: response.status,
          error: errorText,
        });
        
        if (response.status === 429) {
          throw new Error('Lean API rate limit exceeded. Please try again later.');
        }
        
        if (response.status === 401) {
          throw new Error('Lean authentication failed. Please reconnect your bank account.');
        }
        
        throw new Error(`Lean get identity failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        name: data.name || data.full_name || data.legal_name || '',
        email: data.email,
        phone: data.phone || data.phone_number,
        address: data.address ? {
          street: data.address.street,
          city: data.address.city,
          country: data.address.country,
          postalCode: data.address.postal_code || data.address.zip_code,
        } : undefined,
      };
    }, 'getIdentity', refreshToken);
  }

  /**
   * Payment API: Initiate a payment
   */
  async makePayment(accessToken: string, payment: PaymentRequest, refreshToken?: string): Promise<PaymentResult> {
    return this.executeWithRetry(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/payments/v2/initiate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'lean-app-token': this.appToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: payment.accountId,
          amount: payment.amount,
          currency: payment.currency,
          beneficiary_name: payment.beneficiaryName,
          beneficiary_account: payment.beneficiaryAccount,
          reference: payment.reference,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LeanProvider] Make payment failed', {
          status: response.status,
          error: errorText,
        });
        
        if (response.status === 429) {
          throw new Error('Lean API rate limit exceeded. Please try again later.');
        }
        
        if (response.status === 401) {
          throw new Error('Lean authentication failed. Please reconnect your bank account.');
        }
        
        throw new Error(`Lean payment initiation failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        paymentId: data.payment_id || data.id,
        status: data.status || 'pending',
        message: data.message,
      };
    }, 'makePayment', refreshToken);
  }

  /**
   * Payment API: Get payment status
   */
  async getPaymentStatus(accessToken: string, paymentId: string, refreshToken?: string): Promise<PaymentStatus> {
    return this.executeWithRetry(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/payments/v2/${paymentId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'lean-app-token': this.appToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LeanProvider] Get payment status failed', {
          status: response.status,
          paymentId,
          error: errorText,
        });
        
        if (response.status === 429) {
          throw new Error('Lean API rate limit exceeded. Please try again later.');
        }
        
        if (response.status === 401) {
          throw new Error('Lean authentication failed. Please reconnect your bank account.');
        }
        
        throw new Error(`Lean get payment status failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        paymentId: data.payment_id || data.id || paymentId,
        status: this.mapPaymentStatus(data.status),
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        error: data.error || data.failure_reason,
      };
    }, 'getPaymentStatus', refreshToken);
  }

  /**
   * Payment API: Create a payment link for customer-facing payments
   */
  async createPaymentLink(accessToken: string, linkRequest: PaymentLinkRequest, refreshToken?: string): Promise<PaymentLink> {
    return this.executeWithRetry(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/payments/v2/link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'lean-app-token': this.appToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: linkRequest.amount,
          currency: linkRequest.currency,
          description: linkRequest.description,
          reference: linkRequest.reference,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LeanProvider] Create payment link failed', {
          status: response.status,
          error: errorText,
        });
        
        if (response.status === 429) {
          throw new Error('Lean API rate limit exceeded. Please try again later.');
        }
        
        if (response.status === 401) {
          throw new Error('Lean authentication failed. Please reconnect your bank account.');
        }
        
        throw new Error(`Lean payment link creation failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        linkId: data.link_id || data.id,
        url: data.url || data.payment_url,
        expiresAt: data.expires_at ? new Date(data.expires_at) : new Date(Date.now() + 24 * 60 * 60 * 1000), // Default: 24 hours
      };
    }, 'createPaymentLink', refreshToken);
  }

  /**
   * Helper: Map Lean payment status to our standard status
   */
  private mapPaymentStatus(leanStatus: string): PaymentStatus['status'] {
    const statusMap: Record<string, PaymentStatus['status']> = {
      'pending': 'pending',
      'authorized': 'authorized',
      'processing': 'processing',
      'completed': 'completed',
      'success': 'completed',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'canceled': 'cancelled',
    };

    return statusMap[leanStatus?.toLowerCase()] || 'pending';
  }

  /**
   * Health Check: Get health status and metrics for the Lean provider
   */
  async getLeanHealthStatus(): Promise<{
    provider: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    circuitBreaker: {
      state: 'closed' | 'open' | 'half-open';
      failures: number;
      lastFailureTime: number | null;
    };
    retryConfig: RetryConfig;
    lastSuccessTime?: number;
    lastFailureTime?: number;
    totalRequests?: number;
    failedRequests?: number;
    successRate?: number;
    averageResponseTime?: number;
  }> {
    // Test API availability with a simple request
    let apiAvailable = false;
    let responseTime = 0;
    
    try {
      const startTime = Date.now();
      const response = await this.fetchWithTimeout(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'lean-app-token': this.appToken,
        },
      });
      responseTime = Date.now() - startTime;
      apiAvailable = response.ok;
    } catch (error) {
      console.error('[LeanProvider] Health check failed:', error);
      apiAvailable = false;
    }

    // Determine overall status based on circuit breaker and API availability
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (this.circuitBreaker.state === 'open') {
      status = 'unhealthy';
    } else if (this.circuitBreaker.state === 'half-open' || !apiAvailable) {
      status = 'degraded';
    }

    return {
      provider: 'lean',
      status,
      circuitBreaker: {
        state: this.circuitBreaker.state,
        failures: this.circuitBreaker.failures,
        lastFailureTime: this.circuitBreaker.lastFailureTime || null,
      },
      retryConfig: this.retryConfig,
      averageResponseTime: responseTime,
    };
  }
}
