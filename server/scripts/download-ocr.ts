import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  const connectionSettings = await fetch(
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

async function main() {
  console.log('Searching for Advanced OCR processor in Google Drive...');
  
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  // Search for OCR files - prioritize TypeScript files
  let response = await drive.files.list({
    q: "(name contains 'Advanced OCR' or name contains 'OCR processor' or name contains 'ocr') and (name contains '.ts' or mimeType = 'application/typescript')",
    fields: 'files(id, name, mimeType, modifiedTime, size)',
    spaces: 'drive',
    orderBy: 'modifiedTime desc',
  });
  
  // If no TypeScript files found, search for any OCR files
  if (!response.data.files || response.data.files.length === 0) {
    console.log('No TypeScript OCR files found, searching for any OCR files...');
    response = await drive.files.list({
      q: "name contains 'Advanced OCR' or name contains 'OCR processor' or name contains 'ocr'",
      fields: 'files(id, name, mimeType, modifiedTime, size)',
      spaces: 'drive',
      orderBy: 'modifiedTime desc',
    });
  }
  
  const files = response.data.files;
  
  if (!files || files.length === 0) {
    console.error('No OCR files found in Google Drive');
    console.log('Try searching for files with different names or check permissions');
    return;
  }
  
  console.log(`\nFound ${files.length} OCR-related files:`);
  files.forEach((file, index) => {
    console.log(`${index + 1}. ${file.name} (${file.mimeType}) - ${file.size} bytes - Modified: ${file.modifiedTime}`);
  });
  
  // Download the first file (most recently modified)
  const targetFile = files[0];
  console.log(`\nDownloading: ${targetFile.name} (${targetFile.id})`);
  
  const fileResponse = await drive.files.get({
    fileId: targetFile.id!,
    alt: 'media',
  }, {
    responseType: 'text'
  });
  
  const content = fileResponse.data as string;
  console.log(`Downloaded ${content.length} characters`);
  console.log('First 500 characters:');
  console.log(content.substring(0, 500));
  
  // Save to local file
  const outputPath = path.join(__dirname, '../services/advanced-ocr.ts');
  
  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`\n✓ Saved to: ${outputPath}`);
}

main().catch(console.error);
