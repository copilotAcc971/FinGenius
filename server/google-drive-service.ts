import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function findFolderByName(folderName: string): Promise<string | null> {
  const drive = await getUncachableGoogleDriveClient();
  
  // Search case-insensitively
  const response = await drive.files.list({
    q: `name contains '${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive'
  });

  const folders = response.data.files;
  if (!folders || folders.length === 0) {
    return null;
  }

  // Prefer exact match, then case-insensitive match
  const exactMatch = folders.find(f => f.name === folderName);
  if (exactMatch?.id) {
    return exactMatch.id;
  }

  return folders[0].id || null;
}

export async function listAllFolders() {
  const drive = await getUncachableGoogleDriveClient();
  
  const response = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, modifiedTime)',
    spaces: 'drive',
    orderBy: 'name',
    pageSize: 100
  });

  return response.data.files || [];
}

export async function listFilesInFolder(folderId: string) {
  const drive = await getUncachableGoogleDriveClient();
  
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType, modifiedTime, size)',
    spaces: 'drive',
    orderBy: 'name'
  });

  return response.data.files || [];
}

export async function downloadFile(fileId: string): Promise<string> {
  const drive = await getUncachableGoogleDriveClient();
  
  const response = await drive.files.get({
    fileId: fileId,
    alt: 'media'
  }, {
    responseType: 'text'
  });

  return response.data as string;
}

export async function getFileMetadata(fileId: string) {
  const drive = await getUncachableGoogleDriveClient();
  
  const response = await drive.files.get({
    fileId: fileId,
    fields: 'id, name, mimeType, modifiedTime, size, webViewLink'
  });

  return response.data;
}
