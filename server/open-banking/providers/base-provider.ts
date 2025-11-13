// Base provider interface (all providers implement this)
export interface IOpenBankingBaseProvider {
  provider: OpenBankingProvider; // 'lean' | 'mastercard' | 'nym' | 'marketplace'
  
  // OAuth2 methods (all providers support)
  getAuthorizationUrl(redirectUri: string, state: string): string;
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse>;
  refreshAccessToken(refreshToken: string): Promise<TokenResponse>;
  
  // Webhook verification
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

// Data access capabilities (accounts, transactions, balance)
export interface IOpenBankingDataProvider extends IOpenBankingBaseProvider {
  getAccounts(accessToken: string): Promise<BankAccount[]>;
  getAccountBalance(accessToken: string, accountId: string): Promise<Balance>;
  getTransactions(accessToken: string, accountId: string, options?: TransactionOptions): Promise<Transaction[]>;
  getIdentity(accessToken: string): Promise<Identity>;
}

// Payment capabilities (payment initiation, status, links)
export interface IOpenBankingPaymentProvider extends IOpenBankingDataProvider {
  makePayment(accessToken: string, payment: PaymentRequest): Promise<PaymentResult>;
  getPaymentStatus(accessToken: string, paymentId: string): Promise<PaymentStatus>;
  createPaymentLink(accessToken: string, linkRequest: PaymentLinkRequest): Promise<PaymentLink>;
}

// Capability flags for runtime checks
export interface ProviderCapabilities {
  supportsDataAccess: boolean;
  supportsPayments: boolean;
  supportsIdentityVerification: boolean;
  supportsWebhooks: boolean;
}

// Type definitions
export type OpenBankingProvider = 'lean' | 'mastercard' | 'nym' | 'marketplace';

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface BankAccount {
  accountId: string;
  accountName: string;
  accountType: string;
  currency: string;
  balance?: number;
  availableBalance?: number;
}

export interface Balance {
  currency: string;
  amount: number;
  availableAmount?: number;
  asOf: Date;
}

export interface Transaction {
  transactionId: string;
  date: Date;
  description: string;
  amount: number;
  currency: string;
  type: 'debit' | 'credit';
  pending: boolean;
}

export interface Identity {
  name: string;
  email?: string;
  phone?: string;
  address?: any;
}

export interface PaymentRequest {
  accountId: string;
  amount: number;
  currency: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  reference?: string;
}

export interface PaymentResult {
  paymentId: string;
  status: string;
  message?: string;
}

export interface PaymentStatus {
  paymentId: string;
  status: 'pending' | 'authorized' | 'processing' | 'completed' | 'failed' | 'cancelled';
  completedAt?: Date;
  error?: string;
}

export interface PaymentLinkRequest {
  amount: number;
  currency: string;
  description: string;
  reference: string;
}

export interface PaymentLink {
  linkId: string;
  url: string;
  expiresAt: Date;
}

export interface TransactionOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}
