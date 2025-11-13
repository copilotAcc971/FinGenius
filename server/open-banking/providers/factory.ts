import { IOpenBankingBaseProvider, IOpenBankingDataProvider, IOpenBankingPaymentProvider, OpenBankingProvider, ProviderCapabilities } from './base-provider';
import { LeanProvider } from './lean-provider';

export class OpenBankingProviderFactory {
  createProvider(provider: OpenBankingProvider): IOpenBankingBaseProvider {
    switch (provider) {
      case 'lean':
        return new LeanProvider();
      case 'mastercard':
        throw new Error('Mastercard provider not yet implemented');
      case 'nym':
        throw new Error('Nym provider not yet implemented');
      case 'marketplace':
        throw new Error('Marketplace provider not yet implemented');
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
  
  // Type guard: Check if provider supports data access
  supportsDataAccess(provider: IOpenBankingBaseProvider): provider is IOpenBankingDataProvider {
    return 'getAccounts' in provider && typeof provider.getAccounts === 'function';
  }
  
  // Type guard: Check if provider supports payments
  supportsPayments(provider: IOpenBankingBaseProvider): provider is IOpenBankingPaymentProvider {
    return 'makePayment' in provider && typeof provider.makePayment === 'function';
  }
  
  // Type guard: Check if provider supports identity verification
  supportsIdentityVerification(provider: IOpenBankingBaseProvider): provider is IOpenBankingDataProvider {
    return 'getIdentity' in provider && typeof provider.getIdentity === 'function';
  }
  
  // Get provider capabilities for UI conditional rendering
  getProviderCapabilities(provider: IOpenBankingBaseProvider): ProviderCapabilities {
    return {
      supportsDataAccess: this.supportsDataAccess(provider),
      supportsPayments: this.supportsPayments(provider),
      supportsIdentityVerification: this.supportsIdentityVerification(provider),
      supportsWebhooks: true, // All providers support webhooks (base interface)
    };
  }
}

export const openBankingProviderFactory = new OpenBankingProviderFactory();
