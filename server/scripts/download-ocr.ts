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
  console.log('Searching for Python OCR files in Google Drive...');
  
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  // Search for Python OCR files specifically
  const response = await drive.files.list({
    q: "(name contains 'ocr' or name contains 'OCR') and (mimeType='text/x-python' or name contains '.py')",
    fields: 'files(id, name, mimeType, modifiedTime, size)',
    spaces: 'drive',
    orderBy: 'modifiedTime desc',
  });
  
  const files = response.data.files;
  
  if (!files || files.length === 0) {
    console.error('No Python OCR files found in Google Drive');
    console.log('Searching for all files with names containing ocr...');
    
    // Fallback: search for any OCR files
    const fallbackResponse = await drive.files.list({
      q: "name contains 'ocr' or name contains 'OCR'",
      fields: 'files(id, name, mimeType, modifiedTime, size)',
      spaces: 'drive',
      orderBy: 'modifiedTime desc',
    });
    
    if (!fallbackResponse.data.files || fallbackResponse.data.files.length === 0) {
      console.error('No OCR files found at all. Check Google Drive permissions.');
      return;
    }
    
    console.log('\nFound non-Python OCR files:');
    fallbackResponse.data.files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name} (${file.mimeType})`);
    });
    console.log('\nPlease ensure Python OCR files (.py) are uploaded to Google Drive.');
    return;
  }
  
  console.log(`\nFound ${files.length} Python OCR files:`);
  files.forEach((file, index) => {
    console.log(`${index + 1}. ${file.name} (${file.mimeType}) - ${file.size} bytes - Modified: ${file.modifiedTime}`);
  });
  
  // Create ocr directory if it doesn't exist
  const ocrDir = path.join(__dirname, '../ocr/');
  if (!fs.existsSync(ocrDir)) {
    fs.mkdirSync(ocrDir, { recursive: true });
    console.log(`\n✓ Created directory: ${ocrDir}`);
  }
  
  // Download ALL Python files
  console.log('\nDownloading Python OCR files...');
  for (const file of files) {
    try {
      console.log(`\nDownloading: ${file.name} (${file.id})`);
      
      const fileResponse = await drive.files.get({
        fileId: file.id!,
        alt: 'media',
      }, {
        responseType: 'text'
      });
      
      const content = fileResponse.data as string;
      const outputPath = path.join(ocrDir, file.name!);
      
      fs.writeFileSync(outputPath, content, 'utf-8');
      console.log(`✓ Saved ${file.name} to: ${outputPath}`);
      console.log(`  Size: ${content.length} characters`);
    } catch (error) {
      console.error(`✗ Failed to download ${file.name}:`, error);
    }
  }
  
  console.log(`\n✓ Download complete! ${files.length} Python OCR files saved to ${ocrDir}`);
  
  // Download src directory contents
  console.log('\nSearching for src directory and related Python modules...');
  
  const srcResponse = await drive.files.list({
    q: "(name contains 'src' or name contains 'core' or name contains 'pipeline' or name contains 'advanced_ocr') and (mimeType='text/x-python' or name contains '.py')",
    fields: 'files(id, name, mimeType, parents, modifiedTime, size)',
    spaces: 'drive',
  });
  
  const srcFiles = srcResponse.data.files;
  console.log(`Found ${srcFiles?.length || 0} potential src/module files`);
  
  if (srcFiles && srcFiles.length > 0) {
    // Create src directory
    const srcDir = path.join(ocrDir, 'src/');
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
      console.log(`✓ Created directory: ${srcDir}`);
    }
    
    // Download Python source files from src directory
    console.log('\nDownloading src directory Python modules...');
    for (const file of srcFiles) {
      if (file.mimeType !== 'application/vnd.google-apps.folder' && file.name) {
        try {
          console.log(`\nDownloading: ${file.name} (${file.id})`);
          
          const fileResponse = await drive.files.get({
            fileId: file.id!,
            alt: 'media',
          }, { responseType: 'text' });
          
          const content = fileResponse.data as string;
          const outputPath = path.join(srcDir, file.name);
          
          fs.writeFileSync(outputPath, content, 'utf-8');
          console.log(`✓ Saved ${file.name} to src/`);
          console.log(`  Size: ${content.length} characters`);
        } catch (error) {
          console.error(`✗ Failed to download ${file.name}:`, error);
        }
      }
    }
    
    console.log(`\n✓ Downloaded ${srcFiles.length} Python modules to src/`);
  } else {
    console.log('No src directory files found - will use fallback OCR');
  }
}

main().catch(console.error);
