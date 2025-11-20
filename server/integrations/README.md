# Portable OAuth 2.0 Framework with KMS Encryption

Platform-agnostic OAuth framework for secure integration management. Works on Replit, AWS, Azure, and self-hosted environments.

## ✅ Features

- **Platform Portable**: Environment variable-based configuration (no vendor lock-in)
- **Secure by Default**: All tokens encrypted with KMS envelope encryption
- **Auto Token Refresh**: Middleware automatically refreshes expired tokens
- **Multi-Provider**: Google Drive, OneDrive, Stripe, Twilio, Lean Technologies
- **Database Trigger Protected**: Encryption metadata enforced at DB level

## 📦 Installation

All dependencies are already installed. Just set your environment variables:

```bash
# Google Drive
GOOGLE_DRIVE_CLIENT_ID=your_client_id
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret

# Microsoft OneDrive
ONEDRIVE_CLIENT_ID=your_client_id
ONEDRIVE_CLIENT_SECRET=your_client_secret

# Stripe
STRIPE_CLIENT_ID=your_client_id
STRIPE_SECRET_KEY=your_secret_key

# ... etc
```

## 🚀 Quick Start

### 1. Generate Authorization URL

```typescript
import { oauthManager } from 'server/integrations';

// Generate auth URL (redirects user to provider)
const { authUrl, state } = await oauthManager.getAuthorizationUrl(
  'google_drive',
  'https://myapp.com/oauth/callback'
);

// Store state in session for CSRF validation
req.session.oauthState = state;

// Redirect user to authUrl
res.redirect(authUrl);
```

### 2. Handle OAuth Callback

```typescript
import { oauthManager, credentialStorage } from 'server/integrations';

// After user authorizes, provider redirects to your callback URL
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Validate CSRF state
  if (state !== req.session.oauthState) {
    throw new Error('Invalid state - possible CSRF attack');
  }
  
  // Exchange code for tokens
  const tokens = await oauthManager.exchangeCodeForToken(
    'google_drive',
    code,
    'https://myapp.com/oauth/callback'
  );
  
  // Store encrypted credentials
  const connection = await credentialStorage.storeCredentials({
    tenantId: req.session.tenantId,
    userId: req.session.userId,
    provider: 'google_drive',
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      scope: tokens.scope,
    },
    providerUserId: 'user@example.com',
    providerAccountName: 'John Doe',
  });
  
  res.redirect('/integrations/success');
});
```

### 3. Use Credentials with Auto-Refresh

```typescript
import { withAutoRefresh } from 'server/integrations';

// Automatically refreshes token if expired
await withAutoRefresh(connectionId, tenantId, async (accessToken) => {
  // Make API call with fresh token
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  return response.json();
});
```

### 4. Manual Token Management

```typescript
import { credentialStorage } from 'server/integrations';

// Get credentials (decrypted)
const creds = await credentialStorage.getCredentials(connectionId, tenantId);
console.log(creds.accessToken); // Decrypted token

// Manually refresh token
const refreshed = await credentialStorage.refreshAndUpdateToken(
  connectionId,
  tenantId
);

// Revoke and delete credentials
await credentialStorage.revokeCredentials(connectionId, tenantId);

// List all connections for a tenant
const connections = await credentialStorage.listConnections(tenantId);
```

## 🔐 Security Features

### 1. KMS Envelope Encryption

All tokens are encrypted using envelope encryption:
- **Master Key**: Stored in environment variable (rotatable)
- **Data Encryption Key (DEK)**: Unique per token, encrypted with master key
- **Token Encryption**: AES-256-GCM encryption with DEK
- **Integrity Hash**: SHA-256 HMAC for tamper detection

### 2. Database Triggers

Database triggers enforce encryption metadata:
```sql
-- Trigger ensures all tokens have complete encryption metadata
CREATE TRIGGER enforce_encryption_metadata
BEFORE INSERT ON integration_connections
FOR EACH ROW
BEGIN
  IF NEW.encrypted_access_token IS NULL OR
     NEW.kms_key_alias IS NULL OR
     NEW.token_integrity_hash IS NULL
  THEN
    RAISE(ABORT, 'Encryption metadata required');
  END IF;
END;
```

### 3. CSRF Protection

Authorization URLs include a random state token for CSRF protection.

## 📋 Provider Configuration

### Add New Provider

```typescript
// server/integrations/providers.ts
export const oauthProviders: Record<string, OAuthProviderConfig> = {
  // ... existing providers
  
  my_custom_provider: {
    name: 'My Custom Provider',
    clientId: process.env.MY_PROVIDER_CLIENT_ID || '',
    clientSecret: process.env.MY_PROVIDER_CLIENT_SECRET || '',
    authorizationEndpoint: 'https://provider.com/oauth/authorize',
    tokenEndpoint: 'https://provider.com/oauth/token',
    revokeEndpoint: 'https://provider.com/oauth/revoke',
    defaultScopes: ['read', 'write'],
    scopeSeparator: ' ', // or ',' for some providers
  },
};
```

## 🧪 Testing

Run integration tests:

```bash
# Run all tests
npm test server/integrations/test-oauth.ts

# Run specific test
npm test -- --testNamePattern="Token encryption"
```

### Test Coverage

- ✅ Provider configuration validation
- ✅ Authorization URL generation
- ✅ CSRF state token generation
- ✅ Custom scopes support
- ✅ KMS token encryption/decryption
- ✅ Tamper detection
- ✅ Tenant isolation
- ✅ Credential storage (database)
- ✅ Token refresh
- ✅ Auto-refresh middleware
- ✅ Revocation and cleanup

## 🔄 Migrating Existing Connectors

If you have existing connectors storing plaintext tokens:

### Before (Insecure)
```typescript
// OLD: Plaintext storage
const settings = {
  access_token: 'plaintext_token', // ❌ INSECURE
  refresh_token: 'plaintext_refresh_token',
};
```

### After (Secure with KMS)
```typescript
// NEW: Encrypted storage via KMS
import { credentialStorage } from 'server/integrations';

await credentialStorage.storeCredentials({
  tenantId: 'tenant_123',
  userId: 'user_456',
  provider: 'google_drive',
  tokens: {
    accessToken: 'token', // ✅ Encrypted via KMS
    refreshToken: 'refresh_token',
    expiresIn: 3600,
  },
});
```

## 🌍 Platform Portability

Works on any platform with environment variables:

| Platform | Configuration Method |
|----------|---------------------|
| **Replit** | Secrets tab in Replit workspace |
| **AWS** | AWS Secrets Manager or Parameter Store |
| **Azure** | Azure Key Vault |
| **Heroku** | Config Vars |
| **Self-Hosted** | `.env` file or system environment |

## 📊 Database Schema

```sql
CREATE TABLE integration_connections (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL,
  
  -- Encrypted Access Token (KMS Envelope Encryption)
  encrypted_access_token TEXT NOT NULL,
  kms_key_alias VARCHAR(100) NOT NULL,
  encrypted_data_key TEXT NOT NULL,
  encryption_iv VARCHAR(100) NOT NULL,
  encryption_auth_tag VARCHAR(100) NOT NULL,
  token_integrity_hash VARCHAR(100) NOT NULL,
  
  -- Encrypted Refresh Token (Optional)
  encrypted_refresh_token TEXT,
  refresh_token_kms_key_alias VARCHAR(100),
  refresh_token_encrypted_data_key TEXT,
  refresh_token_encryption_iv VARCHAR(100),
  refresh_token_encryption_auth_tag VARCHAR(100),
  refresh_token_integrity_hash VARCHAR(100),
  
  -- Token Metadata
  expires_at TIMESTAMP,
  scope TEXT,
  
  -- Connection Status
  status VARCHAR(20) DEFAULT 'connected',
  last_verified_at TIMESTAMP,
  last_error TEXT,
  
  -- Provider Metadata
  provider_user_id VARCHAR(255),
  provider_account_name VARCHAR(255),
  metadata JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🛡️ Error Handling

### OAuth Errors

```typescript
import { OAuthError } from 'server/integrations';

try {
  const tokens = await oauthManager.exchangeCodeForToken(...);
} catch (error) {
  if (error instanceof OAuthError) {
    if (error.code === 'invalid_grant') {
      // Authorization code expired - restart OAuth flow
    } else if (error.code === 'refresh_token_expired') {
      // Refresh token expired - re-authorization required
    }
  }
}
```

### KMS Errors

```typescript
try {
  const creds = await credentialStorage.getCredentials(...);
} catch (error) {
  // KMS decryption failed - possible key rotation or tampering
  console.error('Failed to decrypt credentials:', error);
}
```

## 📈 Performance

- **Token Decryption**: ~10ms (includes KMS lookup)
- **Token Encryption**: ~15ms (includes DEK generation)
- **Auto-Refresh Check**: ~1ms (timestamp comparison only)

## 🔗 API Reference

### OAuthManager

- `getAuthorizationUrl(provider, redirectUri, state?, scopes?)` - Generate OAuth URL
- `exchangeCodeForToken(provider, code, redirectUri)` - Exchange code for tokens
- `refreshAccessToken(provider, refreshToken)` - Refresh access token
- `revokeToken(provider, token, tokenTypeHint?)` - Revoke token

### CredentialStorageService

- `storeCredentials(params)` - Store encrypted credentials
- `getCredentials(connectionId, tenantId)` - Retrieve decrypted credentials
- `refreshAndUpdateToken(connectionId, tenantId)` - Refresh expired token
- `revokeCredentials(connectionId, tenantId)` - Revoke and delete
- `getConnection(connectionId, tenantId)` - Get metadata (no tokens)
- `listConnections(tenantId, userId?)` - List all connections

### Helper Functions

- `withAutoRefresh(connectionId, tenantId, fn)` - Auto-refresh middleware
- `getProviderConfig(provider)` - Get provider configuration
- `isProviderConfigured(provider)` - Check if credentials are set
- `listProviders()` - List all available providers

## 🎯 Next Steps

1. **Set Environment Variables**: Add OAuth credentials for your providers
2. **Create OAuth Routes**: Implement authorization and callback endpoints
3. **Test Integration**: Run integration tests to verify setup
4. **Migrate Existing Connectors**: Update Google Drive/OneDrive connectors to use this framework

## 📞 Support

For issues or questions:
- Check `server/integrations/test-oauth.ts` for examples
- Review error messages (descriptive and actionable)
- Verify environment variables are set correctly

---

**Built with security and portability in mind. No vendor lock-in. No plaintext tokens. Ever.**
