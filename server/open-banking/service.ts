import { db } from '@db';
import { eq, and } from 'drizzle-orm';
import { 
  openBankingConnections, 
  bankAccounts, 
  bankTransactions,
  type OpenBankingConnection,
  type InsertOpenBankingConnection
} from '@shared/schema';
import { openBankingProviderFactory } from './providers';
import { 
  type IOpenBankingBaseProvider,
  type OpenBankingProvider,
  type TokenResponse,
  type BankAccount as ProviderBankAccount,
  type Balance,
  type Transaction,
  type Identity,
  type PaymentRequest,
  type PaymentResult,
  type PaymentStatus,
  type PaymentLinkRequest,
  type PaymentLink,
  type TransactionOptions,
  type ProviderCapabilities
} from './providers/base-provider';
import { tokenEncryption } from './encryption';

export class CapabilityNotSupportedError extends Error {
  constructor(
    public providerId: string,
    public capability: string,
    public userMessage: string
  ) {
    super(`Provider ${providerId} does not support ${capability}`);
    this.name = 'CapabilityNotSupportedError';
  }
}

export class OpenBankingService {
  constructor(private tenantId: string) {}

  async initiateConnection(
    provider: OpenBankingProvider,
    entityId: string,
    customerId: string,
    accessToken: string,
    refreshToken: string,
    tokenExpiresIn: number,
    bankIdentifier?: string,
    bankName?: string,
    accountType?: string,
    accountMask?: string,
    permissions?: string[]
  ): Promise<OpenBankingConnection> {
    try {
      console.log(`[OpenBankingService] Initiating connection for tenant ${this.tenantId}, provider: ${provider}`);

      const encryptedAccessToken = await tokenEncryption.encrypt(accessToken);
      const encryptedRefreshToken = await tokenEncryption.encrypt(refreshToken);

      const tokenExpiresAt = new Date(Date.now() + tokenExpiresIn * 1000);

      const connectionData: InsertOpenBankingConnection = {
        tenantId: this.tenantId,
        provider,
        entityId,
        customerId,
        accessToken: encryptedAccessToken.ciphertext,
        refreshToken: encryptedRefreshToken.ciphertext,
        tokenExpiresAt,
        encryptionIV: encryptedAccessToken.iv,
        encryptionAuthTag: encryptedAccessToken.authTag,
        encryptionKeyVersion: encryptedAccessToken.keyVersion,
        bankIdentifier,
        bankName,
        accountType,
        accountMask,
        permissions: permissions || [],
        status: 'active',
      };

      const [connection] = await db
        .insert(openBankingConnections)
        .values(connectionData)
        .returning();

      console.log(`[OpenBankingService] Connection created successfully: ${connection.id}`);

      return connection;
    } catch (error) {
      console.error('[OpenBankingService] Failed to initiate connection:', error);
      throw new Error(
        `Failed to create Open Banking connection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async disconnectConnection(connectionId: string): Promise<void> {
    try {
      console.log(`[OpenBankingService] Disconnecting connection ${connectionId} for tenant ${this.tenantId}`);

      const connection = await this.getConnection(connectionId);

      await db
        .update(openBankingConnections)
        .set({
          status: 'disconnected',
          disconnectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(openBankingConnections.id, connectionId),
            eq(openBankingConnections.tenantId, this.tenantId)
          )
        );

      console.log(`[OpenBankingService] Connection ${connectionId} disconnected successfully`);
    } catch (error) {
      console.error('[OpenBankingService] Failed to disconnect connection:', error);
      throw new Error(
        `Failed to disconnect Open Banking connection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async refreshConnection(connectionId: string): Promise<void> {
    let connection: OpenBankingConnection | undefined;
    
    try {
      console.log(`[OpenBankingService] Refreshing connection ${connectionId} for tenant ${this.tenantId}`);

      connection = await this.getConnection(connectionId);

      if (!connection.refreshToken) {
        throw new Error('No refresh token available for this connection');
      }

      const decryptedRefreshToken = await tokenEncryption.decrypt(
        connection.refreshToken,
        connection.encryptionIV!,
        connection.encryptionAuthTag!,
        connection.encryptionKeyVersion!
      );

      const provider = openBankingProviderFactory.createProvider(connection.provider as OpenBankingProvider);
      const newTokens = await provider.refreshAccessToken(decryptedRefreshToken);

      await this.updateTokens(connectionId, newTokens);

      console.log(`[OpenBankingService] Connection ${connectionId} refreshed successfully`);
    } catch (error) {
      console.error('[OpenBankingService] Failed to refresh connection:', error);

      await db
        .update(openBankingConnections)
        .set({
          syncErrors: (connection?.syncErrors || 0) + 1,
          lastSyncError: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(openBankingConnections.id, connectionId),
            eq(openBankingConnections.tenantId, this.tenantId)
          )
        );

      throw new Error(
        `Failed to refresh Open Banking connection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getAccounts(connectionId: string): Promise<ProviderBankAccount[]> {
    try {
      console.log(`[OpenBankingService] Fetching accounts for connection ${connectionId}`);

      const connection = await this.getConnection(connectionId);
      const provider = openBankingProviderFactory.createProvider(connection.provider as OpenBankingProvider);

      if (!openBankingProviderFactory.supportsDataAccess(provider)) {
        throw new CapabilityNotSupportedError(
          connection.provider,
          'data_access',
          `Provider ${connection.provider} does not support account data access`
        );
      }

      const accessToken = await this.ensureValidToken(connection);
      const accounts = await provider.getAccounts(accessToken);

      console.log(`[OpenBankingService] Retrieved ${accounts.length} accounts for connection ${connectionId}`);

      return accounts;
    } catch (error) {
      console.error('[OpenBankingService] Failed to fetch accounts:', error);

      if (error instanceof CapabilityNotSupportedError) {
        throw error;
      }

      throw new Error(
        `Failed to fetch accounts: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getAccountBalance(connectionId: string, accountId: string): Promise<Balance> {
    try {
      console.log(`[OpenBankingService] Fetching balance for account ${accountId}`);

      const connection = await this.getConnection(connectionId);
      const provider = openBankingProviderFactory.createProvider(connection.provider as OpenBankingProvider);

      if (!openBankingProviderFactory.supportsDataAccess(provider)) {
        throw new CapabilityNotSupportedError(
          connection.provider,
          'data_access',
          `Provider ${connection.provider} does not support balance retrieval`
        );
      }

      const accessToken = await this.ensureValidToken(connection);
      const balance = await provider.getAccountBalance(accessToken, accountId);

      console.log(`[OpenBankingService] Retrieved balance for account ${accountId}: ${balance.amount} ${balance.currency}`);

      return balance;
    } catch (error) {
      console.error('[OpenBankingService] Failed to fetch account balance:', error);

      if (error instanceof CapabilityNotSupportedError) {
        throw error;
      }

      throw new Error(
        `Failed to fetch account balance: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getTransactions(
    connectionId: string,
    accountId: string,
    options?: TransactionOptions
  ): Promise<Transaction[]> {
    try {
      console.log(`[OpenBankingService] Fetching transactions for account ${accountId}`);

      const connection = await this.getConnection(connectionId);
      const provider = openBankingProviderFactory.createProvider(connection.provider as OpenBankingProvider);

      if (!openBankingProviderFactory.supportsDataAccess(provider)) {
        throw new CapabilityNotSupportedError(
          connection.provider,
          'data_access',
          `Provider ${connection.provider} does not support transaction retrieval`
        );
      }

      const accessToken = await this.ensureValidToken(connection);
      const transactions = await provider.getTransactions(accessToken, accountId, options);

      await db
        .update(openBankingConnections)
        .set({
          lastSyncAt: new Date(),
          lastSuccessfulSyncAt: new Date(),
          syncErrors: 0,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(openBankingConnections.id, connectionId),
            eq(openBankingConnections.tenantId, this.tenantId)
          )
        );

      console.log(`[OpenBankingService] Retrieved ${transactions.length} transactions for account ${accountId}`);

      return transactions;
    } catch (error) {
      console.error('[OpenBankingService] Failed to fetch transactions:', error);

      await db
        .update(openBankingConnections)
        .set({
          lastSyncAt: new Date(),
          syncErrors: ((await this.getConnection(connectionId))?.syncErrors || 0) + 1,
          lastSyncError: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(openBankingConnections.id, connectionId),
            eq(openBankingConnections.tenantId, this.tenantId)
          )
        );

      if (error instanceof CapabilityNotSupportedError) {
        throw error;
      }

      throw new Error(
        `Failed to fetch transactions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getIdentity(connectionId: string): Promise<Identity> {
    try {
      console.log(`[OpenBankingService] Fetching identity for connection ${connectionId}`);

      const connection = await this.getConnection(connectionId);
      const provider = openBankingProviderFactory.createProvider(connection.provider as OpenBankingProvider);

      if (!openBankingProviderFactory.supportsIdentityVerification(provider)) {
        throw new CapabilityNotSupportedError(
          connection.provider,
          'identity_verification',
          `Provider ${connection.provider} does not support identity verification`
        );
      }

      const accessToken = await this.ensureValidToken(connection);
      const identity = await provider.getIdentity(accessToken);

      console.log(`[OpenBankingService] Retrieved identity for connection ${connectionId}`);

      return identity;
    } catch (error) {
      console.error('[OpenBankingService] Failed to fetch identity:', error);

      if (error instanceof CapabilityNotSupportedError) {
        throw error;
      }

      throw new Error(
        `Failed to fetch identity: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async initiatePayment(connectionId: string, payment: PaymentRequest): Promise<PaymentResult> {
    try {
      console.log(`[OpenBankingService] Initiating payment for connection ${connectionId}`);

      const connection = await this.getConnection(connectionId);
      const provider = openBankingProviderFactory.createProvider(connection.provider as OpenBankingProvider);

      if (!openBankingProviderFactory.supportsPayments(provider)) {
        throw new CapabilityNotSupportedError(
          connection.provider,
          'payments',
          `Payment functionality is not available for ${connection.bankName || connection.provider}. ` +
            `This connection only supports viewing transactions and balances.`
        );
      }

      const accessToken = await this.ensureValidToken(connection);
      const result = await provider.makePayment(accessToken, payment);

      console.log(
        `[OpenBankingService] Payment initiated successfully: ${result.paymentId} (status: ${result.status})`
      );

      return result;
    } catch (error) {
      console.error('[OpenBankingService] Failed to initiate payment:', error);

      if (error instanceof CapabilityNotSupportedError) {
        throw error;
      }

      throw new Error(
        `Failed to initiate payment: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getPaymentStatus(connectionId: string, paymentId: string): Promise<PaymentStatus> {
    try {
      console.log(`[OpenBankingService] Fetching payment status for payment ${paymentId}`);

      const connection = await this.getConnection(connectionId);
      const provider = openBankingProviderFactory.createProvider(connection.provider as OpenBankingProvider);

      if (!openBankingProviderFactory.supportsPayments(provider)) {
        throw new CapabilityNotSupportedError(
          connection.provider,
          'payments',
          `Cannot check payment status: ${connection.provider} does not support payments`
        );
      }

      const accessToken = await this.ensureValidToken(connection);
      const status = await provider.getPaymentStatus(accessToken, paymentId);

      console.log(`[OpenBankingService] Payment status retrieved: ${status.status}`);

      return status;
    } catch (error) {
      console.error('[OpenBankingService] Failed to fetch payment status:', error);

      if (error instanceof CapabilityNotSupportedError) {
        throw error;
      }

      throw new Error(
        `Failed to fetch payment status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async createPaymentLink(connectionId: string, linkRequest: PaymentLinkRequest): Promise<PaymentLink> {
    try {
      console.log(`[OpenBankingService] Creating payment link for connection ${connectionId}`);

      const connection = await this.getConnection(connectionId);
      const provider = openBankingProviderFactory.createProvider(connection.provider as OpenBankingProvider);

      if (!openBankingProviderFactory.supportsPayments(provider)) {
        throw new CapabilityNotSupportedError(
          connection.provider,
          'payments',
          `Payment link creation is not available for ${connection.bankName || connection.provider}`
        );
      }

      const accessToken = await this.ensureValidToken(connection);
      const link = await provider.createPaymentLink(accessToken, linkRequest);

      console.log(`[OpenBankingService] Payment link created: ${link.linkId}`);

      return link;
    } catch (error) {
      console.error('[OpenBankingService] Failed to create payment link:', error);

      if (error instanceof CapabilityNotSupportedError) {
        throw error;
      }

      throw new Error(
        `Failed to create payment link: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getConnectionCapabilities(connectionId: string): Promise<ProviderCapabilities> {
    try {
      const connection = await this.getConnection(connectionId);
      const provider = openBankingProviderFactory.createProvider(connection.provider as OpenBankingProvider);

      return openBankingProviderFactory.getProviderCapabilities(provider);
    } catch (error) {
      console.error('[OpenBankingService] Failed to get connection capabilities:', error);
      throw new Error(
        `Failed to get connection capabilities: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async processWebhook(provider: OpenBankingProvider, payload: any, signature: string): Promise<void> {
    try {
      console.log(`[OpenBankingService] Processing webhook from provider: ${provider}`);

      const providerInstance = openBankingProviderFactory.createProvider(provider);
      const isValid = providerInstance.verifyWebhookSignature(JSON.stringify(payload), signature);

      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      console.log('[OpenBankingService] Webhook signature verified successfully');
      console.log('[OpenBankingService] Webhook payload:', payload);
    } catch (error) {
      console.error('[OpenBankingService] Failed to process webhook:', error);
      throw new Error(
        `Failed to process webhook: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async ensureValidToken(connection: OpenBankingConnection): Promise<string> {
    try {
      if (!connection.accessToken || !connection.encryptionIV || !connection.encryptionAuthTag || !connection.encryptionKeyVersion) {
        throw new Error('Connection missing encrypted token data');
      }

      const now = new Date();
      const tokenExpiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : null;

      if (tokenExpiresAt && now >= tokenExpiresAt) {
        console.log(`[OpenBankingService] Access token expired for connection ${connection.id}, refreshing...`);
        await this.refreshConnection(connection.id);

        const updatedConnection = await this.getConnection(connection.id);

        if (!updatedConnection.accessToken || !updatedConnection.encryptionIV || !updatedConnection.encryptionAuthTag || !updatedConnection.encryptionKeyVersion) {
          throw new Error('Failed to refresh token: missing encryption data');
        }

        return await tokenEncryption.decrypt(
          updatedConnection.accessToken,
          updatedConnection.encryptionIV,
          updatedConnection.encryptionAuthTag,
          updatedConnection.encryptionKeyVersion
        );
      }

      return await tokenEncryption.decrypt(
        connection.accessToken,
        connection.encryptionIV,
        connection.encryptionAuthTag,
        connection.encryptionKeyVersion
      );
    } catch (error) {
      console.error('[OpenBankingService] Failed to ensure valid token:', error);
      throw new Error(
        `Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async getConnection(connectionId: string): Promise<OpenBankingConnection> {
    try {
      const [connection] = await db
        .select()
        .from(openBankingConnections)
        .where(
          and(
            eq(openBankingConnections.id, connectionId),
            eq(openBankingConnections.tenantId, this.tenantId)
          )
        )
        .limit(1);

      if (!connection) {
        throw new Error('Connection not found or access denied');
      }

      if (connection.status === 'disconnected') {
        throw new Error('Connection has been disconnected');
      }

      return connection;
    } catch (error) {
      console.error('[OpenBankingService] Failed to retrieve connection:', error);
      throw new Error(
        `Failed to retrieve connection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async updateTokens(connectionId: string, tokens: TokenResponse): Promise<void> {
    try {
      const encryptedAccessToken = await tokenEncryption.encrypt(tokens.accessToken);
      const encryptedRefreshToken = await tokenEncryption.encrypt(tokens.refreshToken);

      const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

      await db
        .update(openBankingConnections)
        .set({
          accessToken: encryptedAccessToken.ciphertext,
          refreshToken: encryptedRefreshToken.ciphertext,
          tokenExpiresAt,
          encryptionIV: encryptedAccessToken.iv,
          encryptionAuthTag: encryptedAccessToken.authTag,
          encryptionKeyVersion: encryptedAccessToken.keyVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(openBankingConnections.id, connectionId),
            eq(openBankingConnections.tenantId, this.tenantId)
          )
        );

      console.log(`[OpenBankingService] Tokens updated successfully for connection ${connectionId}`);
    } catch (error) {
      console.error('[OpenBankingService] Failed to update tokens:', error);
      throw new Error(
        `Failed to update tokens: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
