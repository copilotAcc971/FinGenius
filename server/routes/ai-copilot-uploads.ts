import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { randomBytes } from 'crypto';
import { db } from '../db';
import { aiCopilotUploads } from '@shared/schema';
import { isAuthenticated } from '../replitAuth';
import { eq, and, lt } from 'drizzle-orm';

const router = Router();

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
];

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.xlsx'];
const UPLOAD_BASE_DIR = 'attached_assets/ai-copilot-uploads';
const FILE_EXPIRY_HOURS = 24;

// File filter for multer
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check file extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }
  
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`Invalid MIME type. File type not allowed.`));
  }
  
  cb(null, true);
};

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req: any, file, cb) => {
    try {
      const tenantId = req.headers['x-tenant-id'] || req.body.tenantId || req.query.tenantId;
      
      if (!tenantId) {
        return cb(new Error('Tenant ID is required'), '');
      }
      
      const uploadDir = path.join(UPLOAD_BASE_DIR, tenantId);
      
      // Ensure directory exists
      await fs.mkdir(uploadDir, { recursive: true });
      
      cb(null, uploadDir);
    } catch (error: any) {
      cb(error, '');
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename: uploadId-originalname
    const uploadId = randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${uploadId}-${sanitizedBaseName}${ext}`;
    
    // Store uploadId in request for later use
    req.uploadId = uploadId;
    
    cb(null, filename);
  },
});

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// Middleware to verify tenant access
async function verifyTenantAccess(req: any, res: any, next: any) {
  try {
    const userId = req.user.claims.sub;
    const tenantId = req.headers['x-tenant-id'] || req.body.tenantId || req.query.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    // For now, we'll just attach the tenantId to the request
    // In a production app, you'd verify the user has access to this tenant
    req.tenantId = tenantId;
    req.userId = userId;
    next();
  } catch (error) {
    console.error("Error verifying tenant access:", error);
    res.status(500).json({ message: "Failed to verify tenant access" });
  }
}

// Virus scanning placeholder
async function virusScan(filePath: string): Promise<{ status: string; details?: string }> {
  // TODO: Integrate with a virus scanning service (e.g., ClamAV, VirusTotal API)
  // For now, return a placeholder result
  console.log(`[Virus Scan Placeholder] Scanning file: ${filePath}`);
  
  // Simulate async scan
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    status: 'clean',
    details: 'Virus scan placeholder - no actual scanning performed',
  };
}

// POST /api/ai-copilot/upload - Upload a document
router.post('/upload', isAuthenticated, verifyTenantAccess, upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { tenantId, userId, uploadId } = req;
    const file = req.file;

    // Calculate expiry time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + FILE_EXPIRY_HOURS);

    // Perform virus scan (placeholder)
    const scanResult = await virusScan(file.path);

    // Store upload record in database
    const [uploadRecord] = await db.insert(aiCopilotUploads).values({
      tenantId,
      userId,
      filename: file.filename,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      filePath: file.path,
      virusScanStatus: scanResult.status,
      virusScanDetails: scanResult.details,
      expiresAt,
    }).returning();

    // Return file metadata
    res.status(201).json({
      uploadId: uploadRecord.id,
      filename: uploadRecord.filename,
      originalFilename: uploadRecord.originalFilename,
      mimeType: uploadRecord.mimeType,
      size: uploadRecord.fileSize,
      uploadedAt: uploadRecord.uploadedAt,
      expiresAt: uploadRecord.expiresAt,
      virusScanStatus: uploadRecord.virusScanStatus,
    });

  } catch (error: any) {
    console.error('Error uploading file:', error);
    
    // Clean up file if it was uploaded but DB insert failed
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file after failed upload:', unlinkError);
      }
    }

    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
        });
      }
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ 
      message: error.message || 'Failed to upload file' 
    });
  }
});

// GET /api/ai-copilot/uploads - Get all uploads for current user/tenant
router.get('/uploads', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
  try {
    const { tenantId, userId } = req;

    const uploads = await db
      .select()
      .from(aiCopilotUploads)
      .where(
        and(
          eq(aiCopilotUploads.tenantId, tenantId),
          eq(aiCopilotUploads.userId, userId)
        )
      )
      .orderBy(aiCopilotUploads.uploadedAt);

    res.json(uploads);
  } catch (error: any) {
    console.error('Error fetching uploads:', error);
    res.status(500).json({ message: 'Failed to fetch uploads' });
  }
});

// GET /api/ai-copilot/uploads/:id - Get specific upload
router.get('/uploads/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { tenantId, userId } = req;

    const [upload] = await db
      .select()
      .from(aiCopilotUploads)
      .where(
        and(
          eq(aiCopilotUploads.id, id),
          eq(aiCopilotUploads.tenantId, tenantId),
          eq(aiCopilotUploads.userId, userId)
        )
      );

    if (!upload) {
      return res.status(404).json({ message: 'Upload not found' });
    }

    res.json(upload);
  } catch (error: any) {
    console.error('Error fetching upload:', error);
    res.status(500).json({ message: 'Failed to fetch upload' });
  }
});

// DELETE /api/ai-copilot/uploads/:id - Delete an upload
router.delete('/uploads/:id', isAuthenticated, verifyTenantAccess, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { tenantId, userId } = req;

    // Get the upload record
    const [upload] = await db
      .select()
      .from(aiCopilotUploads)
      .where(
        and(
          eq(aiCopilotUploads.id, id),
          eq(aiCopilotUploads.tenantId, tenantId),
          eq(aiCopilotUploads.userId, userId)
        )
      );

    if (!upload) {
      return res.status(404).json({ message: 'Upload not found' });
    }

    // Delete the file from disk
    try {
      await fs.unlink(upload.filePath);
    } catch (fileError) {
      console.error('Error deleting file from disk:', fileError);
      // Continue even if file deletion fails (file might already be deleted)
    }

    // Soft delete: update deletedAt timestamp
    await db
      .update(aiCopilotUploads)
      .set({ deletedAt: new Date() })
      .where(eq(aiCopilotUploads.id, id));

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting upload:', error);
    res.status(500).json({ message: 'Failed to delete upload' });
  }
});

// Cleanup function to delete expired files
export async function cleanupExpiredUploads() {
  try {
    console.log('[AI Copilot Uploads] Running cleanup for expired files...');

    // Find all expired uploads that haven't been deleted
    const expiredUploads = await db
      .select()
      .from(aiCopilotUploads)
      .where(
        and(
          lt(aiCopilotUploads.expiresAt, new Date()),
          eq(aiCopilotUploads.deletedAt, null as any)
        )
      );

    console.log(`[AI Copilot Uploads] Found ${expiredUploads.length} expired files to delete`);

    for (const upload of expiredUploads) {
      try {
        // Delete file from disk
        await fs.unlink(upload.filePath);
        console.log(`[AI Copilot Uploads] Deleted file: ${upload.filePath}`);
      } catch (fileError) {
        console.error(`[AI Copilot Uploads] Error deleting file ${upload.filePath}:`, fileError);
        // Continue even if file deletion fails
      }

      // Soft delete: update deletedAt
      await db
        .update(aiCopilotUploads)
        .set({ deletedAt: new Date() })
        .where(eq(aiCopilotUploads.id, upload.id));
    }

    console.log('[AI Copilot Uploads] Cleanup completed');
  } catch (error) {
    console.error('[AI Copilot Uploads] Error during cleanup:', error);
  }
}

export default router;
