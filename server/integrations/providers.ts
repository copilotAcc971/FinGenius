/**
 * OAuth Provider Configurations
 * Platform-agnostic OAuth 2.0 provider settings
 * Works on Replit, AWS, Azure, self-hosted (via environment variables)
 */

/**
 * OAuth Provider Configuration Interface
 * All credentials come from environment variables for portability
 */
export interface OAuthProviderConfig {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revokeEndpoint?: string;
  defaultScopes: string[];
  scopeSeparator?: string; // Default: ' '
  pkceEnabled?: boolean; // PKCE for mobile/SPA flows
}

/**
 * Get OAuth provider configuration
 * Throws error if provider not configured or credentials missing
 */
export function getProviderConfig(provider: string): OAuthProviderConfig {
  const config = oauthProviders[provider];
  
  if (!config) {
    throw new Error(`OAuth provider '${provider}' not configured`);
  }

  // Validate credentials exist
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      `OAuth credentials missing for '${provider}'. ` +
      `Please set ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET environment variables.`
    );
  }

  return config;
}

/**
 * List all available OAuth providers
 */
export function listProviders(): string[] {
  return Object.keys(oauthProviders);
}

/**
 * Check if a provider is configured (has credentials)
 */
export function isProviderConfigured(provider: string): boolean {
  const config = oauthProviders[provider];
  return !!config && !!config.clientId && !!config.clientSecret;
}

/**
 * OAuth Provider Registry
 * Add new providers here with environment-based credentials
 */
export const oauthProviders: Record<string, OAuthProviderConfig> = {
  google_drive: {
    name: 'Google Drive',
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revokeEndpoint: 'https://oauth2.googleapis.com/revoke',
    defaultScopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly'
    ],
    scopeSeparator: ' ',
  },

  onedrive: {
    name: 'Microsoft OneDrive',
    clientId: process.env.ONEDRIVE_CLIENT_ID || '',
    clientSecret: process.env.ONEDRIVE_CLIENT_SECRET || '',
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    revokeEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
    defaultScopes: [
      'Files.ReadWrite',
      'offline_access',
      'User.Read'
    ],
    scopeSeparator: ' ',
  },

  stripe: {
    name: 'Stripe',
    clientId: process.env.STRIPE_CLIENT_ID || '',
    clientSecret: process.env.STRIPE_SECRET_KEY || '',
    authorizationEndpoint: 'https://connect.stripe.com/oauth/authorize',
    tokenEndpoint: 'https://connect.stripe.com/oauth/token',
    revokeEndpoint: 'https://connect.stripe.com/oauth/deauthorize',
    defaultScopes: ['read_write'],
    scopeSeparator: ' ',
  },

  twilio: {
    name: 'Twilio',
    clientId: process.env.TWILIO_CLIENT_ID || '',
    clientSecret: process.env.TWILIO_CLIENT_SECRET || '',
    authorizationEndpoint: 'https://www.twilio.com/authorize',
    tokenEndpoint: 'https://api.twilio.com/oauth/token',
    defaultScopes: ['messaging', 'voice'],
    scopeSeparator: ' ',
  },

  lean_technologies: {
    name: 'Lean Technologies (Open Banking)',
    clientId: process.env.LEAN_CLIENT_ID || '',
    clientSecret: process.env.LEAN_CLIENT_SECRET || '',
    authorizationEndpoint: 'https://api.leantech.me/link/v2/authorize',
    tokenEndpoint: 'https://api.leantech.me/link/v2/token',
    defaultScopes: ['accounts', 'transactions', 'identity'],
    scopeSeparator: ' ',
  },
};

/**
 * Environment Variable Reference
 * Document all required environment variables for each provider
 */
export const ENV_VAR_DOCS = {
  google_drive: {
    clientId: 'GOOGLE_DRIVE_CLIENT_ID',
    clientSecret: 'GOOGLE_DRIVE_CLIENT_SECRET',
    setup: 'Create OAuth credentials at https://console.cloud.google.com/apis/credentials',
  },
  onedrive: {
    clientId: 'ONEDRIVE_CLIENT_ID',
    clientSecret: 'ONEDRIVE_CLIENT_SECRET',
    setup: 'Register app at https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps',
  },
  stripe: {
    clientId: 'STRIPE_CLIENT_ID',
    clientSecret: 'STRIPE_SECRET_KEY',
    setup: 'Get credentials from https://dashboard.stripe.com/account/applications/settings',
  },
  twilio: {
    clientId: 'TWILIO_CLIENT_ID',
    clientSecret: 'TWILIO_CLIENT_SECRET',
    setup: 'Create OAuth app at https://www.twilio.com/console',
  },
  lean_technologies: {
    clientId: 'LEAN_CLIENT_ID',
    clientSecret: 'LEAN_CLIENT_SECRET',
    setup: 'Register at https://developer.leantech.me',
  },
};
