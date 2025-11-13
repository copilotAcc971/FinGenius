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

export class LeanProvider implements IOpenBankingPaymentProvider {
  provider: OpenBankingProvider = 'lean';
  
  private appToken: string;
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private sandboxMode: boolean;
  private webhookSecret: string;

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
    });
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
    try {
      const response = await fetch(`${this.baseUrl}/oauth2/token`, {
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
    } catch (error) {
      console.error('[LeanProvider] Error exchanging auth code', error);
      throw error;
    }
  }

  /**
   * OAuth2: Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/oauth2/token`, {
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
    } catch (error) {
      console.error('[LeanProvider] Error refreshing access token', error);
      throw error;
    }
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
   */
  async getAccounts(accessToken: string): Promise<BankAccount[]> {
    try {
      const response = await fetch(`${this.baseUrl}/data/v2/accounts`, {
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
    } catch (error) {
      console.error('[LeanProvider] Error getting accounts', error);
      throw error;
    }
  }

  /**
   * Data API: Get account balance for a specific account
   */
  async getAccountBalance(accessToken: string, accountId: string): Promise<Balance> {
    try {
      const response = await fetch(`${this.baseUrl}/data/v2/accounts/${accountId}/balance`, {
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
    } catch (error) {
      console.error('[LeanProvider] Error getting account balance', error);
      throw error;
    }
  }

  /**
   * Data API: Get transactions for a specific account
   */
  async getTransactions(
    accessToken: string,
    accountId: string,
    options?: TransactionOptions
  ): Promise<Transaction[]> {
    try {
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

      const response = await fetch(url, {
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
    } catch (error) {
      console.error('[LeanProvider] Error getting transactions', error);
      throw error;
    }
  }

  /**
   * Data API: Get identity/KYC information for the connected account
   */
  async getIdentity(accessToken: string): Promise<Identity> {
    try {
      const response = await fetch(`${this.baseUrl}/data/v2/identity`, {
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
    } catch (error) {
      console.error('[LeanProvider] Error getting identity', error);
      throw error;
    }
  }

  /**
   * Payment API: Initiate a payment
   */
  async makePayment(accessToken: string, payment: PaymentRequest): Promise<PaymentResult> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/v2/initiate`, {
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
    } catch (error) {
      console.error('[LeanProvider] Error making payment', error);
      throw error;
    }
  }

  /**
   * Payment API: Get payment status
   */
  async getPaymentStatus(accessToken: string, paymentId: string): Promise<PaymentStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/v2/${paymentId}/status`, {
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
    } catch (error) {
      console.error('[LeanProvider] Error getting payment status', error);
      throw error;
    }
  }

  /**
   * Payment API: Create a payment link for customer-facing payments
   */
  async createPaymentLink(accessToken: string, linkRequest: PaymentLinkRequest): Promise<PaymentLink> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/v2/link`, {
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
    } catch (error) {
      console.error('[LeanProvider] Error creating payment link', error);
      throw error;
    }
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
}
