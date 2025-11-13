import { Router } from 'express';
import { findFolderByName, listFilesInFolder, downloadFile, getFileMetadata, listAllFolders } from './google-drive-service';

const router = Router();

// List all folders
router.get('/api/google-drive/folders', async (req, res) => {
  try {
    const folders = await listAllFolders();
    return res.json({ folders });
  } catch (error: any) {
    console.error('Error listing folders:', error);
    return res.status(500).json({ 
      message: 'Failed to list folders',
      error: error.message 
    });
  }
});

// Get files from a specific folder
router.get('/api/google-drive/folder/:folderName', async (req, res) => {
  try {
    const { folderName } = req.params;
    
    console.log(`Looking for folder: ${folderName}`);
    const folderId = await findFolderByName(folderName);
    
    if (!folderId) {
      return res.status(404).json({ 
        message: `Folder '${folderName}' not found in Google Drive` 
      });
    }

    console.log(`Found folder ID: ${folderId}`);
    const files = await listFilesInFolder(folderId);
    
    return res.json({ 
      folderId,
      folderName,
      files 
    });
  } catch (error: any) {
    console.error('Error accessing Google Drive:', error);
    return res.status(500).json({ 
      message: 'Failed to access Google Drive',
      error: error.message 
    });
  }
});

// Download a specific file
router.get('/api/google-drive/file/:fileId/download', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const metadata = await getFileMetadata(fileId);
    const content = await downloadFile(fileId);
    
    return res.json({
      metadata,
      content
    });
  } catch (error: any) {
    console.error('Error downloading file:', error);
    return res.status(500).json({ 
      message: 'Failed to download file',
      error: error.message 
    });
  }
});

// Get file metadata only
router.get('/api/google-drive/file/:fileId/metadata', async (req, res) => {
  try {
    const { fileId } = req.params;
    const metadata = await getFileMetadata(fileId);
    
    return res.json(metadata);
  } catch (error: any) {
    console.error('Error getting file metadata:', error);
    return res.status(500).json({ 
      message: 'Failed to get file metadata',
      error: error.message 
    });
  }
});

export default router;
