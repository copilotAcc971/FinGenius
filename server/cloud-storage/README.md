# Cloud Storage Integration - Dual Upload System

## Overview

This module provides encrypted OAuth-based cloud storage integrations for **Google Drive** and **OneDrive** with **parallel dual upload** capabilities. All credentials are secured using **KMS envelope encryption** and support automatic token refresh.

## Architecture

### Key Components

1. **Cloud Storage Services**
   - `google-drive.ts` - Google Drive integration via googleapis
   - `onedrive.ts` - OneDrive integration via Microsoft Graph API
   - `index.ts` - Unified exports

2. **OAuth Framework** (from `server/integrations`)
   - `oauth-manager.ts` - Platform-agnostic OAuth 2.0 flow
   - `credential-storage.ts` - Encrypted credential storage with KMS
   - `providers.ts` - OAuth provider configurations

3. **Document Ingestion** (`server/services/document-ingestion.ts`)
   - `storeDocument()` - Parallel dual upload with graceful degradation
   - Local storage (always succeeds)
   - Cloud uploads (best-effort with error logging)

4. **OAuth Routes** (`server/routes/cloud-storage-oauth.ts`)
   - Authorization endpoints
   - OAuth callbacks
   - Connection status/disconnect

## Security Features

### KMS Envelope Encryption
All OAuth tokens are encrypted using **envelope encryption**:

1. **Data Encryption Key (DEK)** - Unique per token, AES-256-GCM
2. **Master Key (MEK)** - Stored in KMS (AWS KMS, Azure Key Vault, or environment)
3. **Encrypted DEK** - Stored alongside encrypted token in database

**Schema (integrationConnections table):**
```sql
encryptedAccessToken      TEXT NOT NULL
accessTokenKmsKeyAlias    VARCHAR(255) NOT NULL
accessTokenEncryptedDek   TEXT NOT NULL
accessTokenIv             VARCHAR(64) NOT NULL
accessTokenAuthTag        VARCHAR(64) NOT NULL
```

### Auto-Refresh Tokens
The `withAutoRefresh()` middleware automatically refreshes expired tokens:
- Checks token expiration before API calls
- Uses refresh token to get new access token
- Updates encrypted storage atomically
- Transparent to calling code

## Usage

### 1. OAuth Setup (User Authorization)

**Initiate Authorization:**
```typescript
// Frontend redirects user to:
GET /api/oauth/google-drive/authorize?tenantId={tenantId}&userId={userId}
GET /api/oauth/onedrive/authorize?tenantId={tenantId}&userId={userId}
```

**OAuth Flow:**
1. User is redirected to provider's authorization page
2. User grants permissions
3. Provider redirects to callback URL with authorization code
4. System exchanges code for tokens
5. Tokens are encrypted and stored in `integrationConnections` table

**Callback (automatic):**
```
GET /api/oauth/google-drive/callback?code={code}&state={state}
GET /api/oauth/onedrive/callback?code={code}&state={state}
```

### 2. Upload Files

**Single Provider Upload:**
```typescript
import { googleDriveService } from 'server/cloud-storage';

const fileId = await googleDriveService.uploadFile(
  tenantId,
  userId,
  fileBuffer,
  'invoice.pdf',
  folderId // optional
);
```

**Parallel Dual Upload (Recommended):**
```typescript
import { storeDocument } from 'server/services/document-ingestion';

const result = await storeDocument(
  tenantId,
  userId,
  fileBuffer,
  'invoice.pdf',
  {
    uploadToGoogleDrive: true,
    uploadToOneDrive: true,
    folderId: 'optional-folder-id',
  }
);

// Result:
// {
//   localPath: 'attached_assets/inbound-documents/tenant_123/abc123-invoice.pdf',
//   googleDriveFileId: 'abc123xyz',
//   oneDriveFileId: 'def456uvw',
//   errors: [] // or [{ provider: 'onedrive', error: 'Upload failed' }]
// }
```

### 3. Download Files

```typescript
import { googleDriveService, oneDriveService } from 'server/cloud-storage';

// From Google Drive
const buffer = await googleDriveService.downloadFile(
  tenantId,
  userId,
  'google-file-id'
);

// From OneDrive
const buffer = await oneDriveService.downloadFile(
  tenantId,
  userId,
  'onedrive-file-id'
);
```

### 4. List Files & Folders

```typescript
// List files
const files = await googleDriveService.listFiles(tenantId, userId, folderId);

// Find folder by name
const folderId = await oneDriveService.findFolderByName(
  tenantId,
  userId,
  'Invoices'
);

// Create folder (OneDrive)
const folderId = await oneDriveService.createFolder(
  tenantId,
  userId,
  'Documents',
  parentFolderId // optional
);
```

### 5. Check Connection Status

```typescript
// Via API
GET /api/oauth/google-drive/status?tenantId={tenantId}&userId={userId}

// Response:
{
  "connected": true,
  "provider": "google_drive",
  "status": "connected",
  "lastVerifiedAt": "2025-01-20T12:00:00Z"
}
```

### 6. Disconnect Provider

```typescript
// Via API
DELETE /api/oauth/google-drive/disconnect
Body: { tenantId, userId }

// This will:
// - Delete encrypted credentials from database
// - Optionally revoke tokens at provider (if supported)
```

## Parallel Upload Strategy

The `storeDocument()` function implements a **resilient dual-upload pattern**:

### Design Principles

1. **Local Storage Always Succeeds**
   - Primary storage is local filesystem
   - Cloud uploads are secondary (redundancy + accessibility)
   - Operation never fails due to cloud provider issues

2. **Parallel Uploads with Promise.allSettled**
   - Both cloud providers upload simultaneously
   - No blocking between providers
   - Faster than sequential uploads

3. **Graceful Degradation**
   - If both cloud uploads fail → Still have local copy ✅
   - If one cloud upload fails → Still have local + 1 cloud ✅
   - If both cloud uploads succeed → Triple redundancy ✅

4. **Error Transparency**
   - All errors are logged to console
   - Errors returned in response object
   - Callers can decide how to handle partial failures

### Implementation

```typescript
export async function storeDocument(
  tenantId: string,
  userId: string,
  buffer: Buffer,
  filename: string,
  options?: {
    uploadToGoogleDrive?: boolean;
    uploadToOneDrive?: boolean;
    folderId?: string;
  }
): Promise<{
  localPath: string;
  googleDriveFileId?: string;
  oneDriveFileId?: string;
  errors?: { provider: string; error: string }[];
}> {
  // Step 1: Local storage (ALWAYS succeeds)
  const localPath = await saveToLocal(tenantId, buffer, filename);
  
  // Step 2: Parallel cloud uploads
  const cloudUploads = [];
  
  if (options?.uploadToGoogleDrive) {
    cloudUploads.push(
      googleDriveService.uploadFile(tenantId, userId, buffer, filename)
        .then(fileId => ({ provider: 'google_drive', fileId }))
    );
  }
  
  if (options?.uploadToOneDrive) {
    cloudUploads.push(
      oneDriveService.uploadFile(tenantId, userId, buffer, filename)
        .then(fileId => ({ provider: 'onedrive', fileId }))
    );
  }
  
  // Step 3: Wait for all (don't fail on partial errors)
  const results = await Promise.allSettled(cloudUploads);
  
  // Step 4: Process results
  const finalResult = { localPath };
  const errors = [];
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const { provider, fileId } = result.value;
      if (provider === 'google_drive') {
        finalResult.googleDriveFileId = fileId;
      } else if (provider === 'onedrive') {
        finalResult.oneDriveFileId = fileId;
      }
    } else {
      errors.push({
        provider: determineProvider(index, options),
        error: result.reason?.message || 'Upload failed',
      });
    }
  });
  
  if (errors.length > 0) {
    finalResult.errors = errors;
  }
  
  return finalResult;
}
```

## Environment Variables

### Required for Google Drive
```bash
GOOGLE_DRIVE_CLIENT_ID=your-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
```

**Setup:** Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

### Required for OneDrive
```bash
ONEDRIVE_CLIENT_ID=your-application-id
ONEDRIVE_CLIENT_SECRET=your-client-secret
```

**Setup:** Register app at [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps)

### Optional: KMS Configuration
```bash
# For AWS KMS
KMS_PROVIDER=aws
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# For environment-based encryption (development)
KMS_PROVIDER=environment
ENCRYPTION_KEY=your-32-byte-hex-key
```

## Database Schema

### integrationConnections Table

```sql
CREATE TABLE integration_connections (
  id VARCHAR PRIMARY KEY,
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  
  -- Provider Information
  provider VARCHAR(50) NOT NULL, -- 'google_drive' | 'onedrive' | ...
  provider_user_id VARCHAR(255),
  provider_account_name VARCHAR(255),
  
  -- Encrypted Access Token (KMS Envelope Encryption)
  encrypted_access_token TEXT NOT NULL,
  access_token_kms_key_alias VARCHAR(255) NOT NULL,
  access_token_encrypted_dek TEXT NOT NULL,
  access_token_iv VARCHAR(64) NOT NULL,
  access_token_auth_tag VARCHAR(64) NOT NULL,
  
  -- Encrypted Refresh Token (optional)
  encrypted_refresh_token TEXT,
  refresh_token_kms_key_alias VARCHAR(255),
  refresh_token_encrypted_dek TEXT,
  refresh_token_iv VARCHAR(64),
  refresh_token_auth_tag VARCHAR(64),
  
  -- Token Metadata
  token_expires_at TIMESTAMP,
  scopes JSONB,
  
  -- Connection Status
  status VARCHAR(20) NOT NULL DEFAULT 'connected',
  last_verified_at TIMESTAMP,
  last_error TEXT,
  
  -- Provider-specific metadata (folder IDs, etc.)
  metadata JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (tenant_id, user_id, provider)
);
```

## Error Handling

### Common Errors

**1. Provider Not Connected**
```typescript
// Error: Google Drive not connected. Please authenticate first.
// Solution: Redirect user to /api/oauth/google-drive/authorize
```

**2. Token Expired (Refresh Failed)**
```typescript
// Error: Refresh token has expired or been revoked. Re-authorization required.
// Solution: User must re-authorize via OAuth flow
```

**3. Upload Failed**
```typescript
// Partial failure example:
{
  localPath: '/path/to/file',
  googleDriveFileId: 'abc123',
  oneDriveFileId: undefined,
  errors: [
    { provider: 'onedrive', error: 'Network timeout' }
  ]
}
// File is still saved locally + Google Drive ✅
```

## Testing

### Manual Testing Flow

1. **Connect Google Drive:**
   ```bash
   # Visit in browser:
   http://localhost:5000/api/oauth/google-drive/authorize?tenantId=tenant_123&userId=user_456
   ```

2. **Connect OneDrive:**
   ```bash
   http://localhost:5000/api/oauth/onedrive/authorize?tenantId=tenant_123&userId=user_456
   ```

3. **Test Dual Upload:**
   ```typescript
   const result = await storeDocument(
     'tenant_123',
     'user_456',
     Buffer.from('test content'),
     'test.txt',
     {
       uploadToGoogleDrive: true,
       uploadToOneDrive: true,
     }
   );
   
   console.log(result);
   // Expected: localPath + 2 cloud file IDs
   ```

4. **Test Partial Failure:**
   ```typescript
   // Disconnect OneDrive via UI/API
   const result = await storeDocument(..., {
     uploadToGoogleDrive: true,
     uploadToOneDrive: true, // Will fail
   });
   
   // Expected: localPath + googleDriveFileId + errors array
   ```

## API Reference

### OAuth Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/oauth/google-drive/authorize` | GET | Initiate Google Drive OAuth |
| `/api/oauth/google-drive/callback` | GET | OAuth callback (automatic) |
| `/api/oauth/onedrive/authorize` | GET | Initiate OneDrive OAuth |
| `/api/oauth/onedrive/callback` | GET | OAuth callback (automatic) |
| `/api/oauth/:provider/status` | GET | Check connection status |
| `/api/oauth/:provider/disconnect` | DELETE | Disconnect provider |

### Service Methods

**GoogleDriveService:**
- `uploadFile(tenantId, userId, buffer, filename, folderId?): Promise<string>`
- `downloadFile(tenantId, userId, fileId): Promise<Buffer>`
- `getFileMetadata(tenantId, userId, fileId): Promise<Metadata>`
- `listFiles(tenantId, userId, folderId?): Promise<File[]>`
- `findFolderByName(tenantId, userId, folderName): Promise<string | null>`

**OneDriveService:**
- `uploadFile(tenantId, userId, buffer, filename, folderId?): Promise<string>`
- `downloadFile(tenantId, userId, fileId): Promise<Buffer>`
- `getFileMetadata(tenantId, userId, fileId): Promise<Metadata>`
- `listFiles(tenantId, userId, folderId?): Promise<File[]>`
- `findFolderByName(tenantId, userId, folderName): Promise<string | null>`
- `createFolder(tenantId, userId, folderName, parentId?): Promise<string>`

## Migration from Legacy

### Old Google Drive Service
```typescript
// OLD (plaintext tokens, no encryption)
import { getUncachableGoogleDriveClient } from './google-drive-service';
const drive = await getUncachableGoogleDriveClient();
```

### New Cloud Storage Framework
```typescript
// NEW (encrypted, auto-refresh, multi-provider)
import { googleDriveService } from './cloud-storage';
const fileId = await googleDriveService.uploadFile(tenantId, userId, buffer, filename);
```

**Migration Steps:**
1. Update OAuth flow to use new `/api/oauth/google-drive/authorize`
2. Replace direct googleapis calls with `googleDriveService` methods
3. Add `userId` parameter to all upload/download calls
4. Remove old OAuth credential management code

## Future Enhancements

- [ ] **Dropbox Integration**
- [ ] **Box Integration**
- [ ] **AWS S3 Integration**
- [ ] **Retry Logic** - Exponential backoff for failed uploads
- [ ] **Upload Progress** - WebSocket notifications for large files
- [ ] **Chunked Uploads** - For files >100MB
- [ ] **Webhook Integration** - File change notifications
- [ ] **Quota Management** - Track storage usage per provider

## Support

For issues or questions:
1. Check logs: `[Google Drive]`, `[OneDrive]`, `[Document Ingestion]`
2. Verify OAuth credentials are set in environment variables
3. Check database for connection status in `integrationConnections` table
4. Review KMS configuration if using custom encryption

## License

Internal use only - Copilot Accountant
