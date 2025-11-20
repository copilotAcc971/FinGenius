import { useState } from 'react';
import { Upload, X, FileIcon, CheckCircle, AlertCircle, Loader2, Eye } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { CopilotAttachment } from './types';
import { cn } from '@/shared/lib/utils/utils';

interface AttachmentDisplayProps {
  attachments: CopilotAttachment[];
  onUpload: (file: File) => void;
  onRemove: (id: string) => void;
  onProcess: (id: string) => void;
  isUploading?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
}

export function AttachmentDisplay({
  attachments,
  onUpload,
  onRemove,
  onProcess,
  isUploading = false,
  maxFiles = 5,
  maxFileSize = 10 * 1024 * 1024, // 10MB
}: AttachmentDisplayProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<CopilotAttachment | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
      e.target.value = ''; // Reset input
    }
  };

  const handleFiles = (files: File[]) => {
    if (attachments.length >= maxFiles) {
      return;
    }

    const file = files[0]; // Take first file only
    if (file && file.size <= maxFileSize) {
      onUpload(file);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusIcon = (status?: CopilotAttachment['extractionStatus']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <FileIcon className="h-4 w-4 text-gray-400 dark:text-gray-600" />;
    }
  };

  const getStatusBadge = (status?: CopilotAttachment['extractionStatus']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="text-xs">Extracted</Badge>;
      case 'processing':
        return <Badge variant="outline" className="text-xs">Processing...</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-xs">Pending</Badge>;
      default:
        return null;
    }
  };

  if (attachments.length === 0 && !isUploading) {
    return (
      <div
        className={cn(
          "border-2 border-dashed rounded-md p-4 text-center transition-colors",
          dragActive 
            ? "border-gray-900 dark:border-white bg-gray-50 dark:bg-neutral-900" 
            : "border-gray-200 dark:border-neutral-800"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        data-testid="dropzone-copilot-upload"
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
          id="copilot-file-upload"
          data-testid="input-copilot-file-upload"
        />
        <label htmlFor="copilot-file-upload" className="cursor-pointer">
          <Upload className="mx-auto h-6 w-6 text-gray-400 dark:text-gray-600" />
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Drop document here or click to upload
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Supports receipts, invoices, bills (max {formatFileSize(maxFileSize)})
          </p>
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* File upload area (compact when attachments exist) */}
      {attachments.length < maxFiles && (
        <div
          className={cn(
            "border border-dashed rounded-md p-2 text-center transition-colors hover-elevate",
            dragActive 
              ? "border-gray-900 dark:border-white bg-gray-50 dark:bg-neutral-900" 
              : "border-gray-200 dark:border-neutral-800"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
            id="copilot-file-upload-compact"
            data-testid="input-copilot-file-upload-compact"
          />
          <label htmlFor="copilot-file-upload-compact" className="cursor-pointer flex items-center justify-center gap-2">
            <Upload className="h-4 w-4 text-gray-400 dark:text-gray-600" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Add document</span>
          </label>
        </div>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 p-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading...
        </div>
      )}

      {/* Attachments list */}
      <ScrollArea className="max-h-64">
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <Card
              key={attachment.id}
              className="p-2 flex items-center gap-2"
              data-testid={`attachment-${attachment.id}`}
            >
              {/* Thumbnail or icon */}
              <div className="flex-shrink-0">
                {attachment.thumbnail ? (
                  <img
                    src={attachment.thumbnail}
                    alt={attachment.fileName}
                    className="h-10 w-10 object-cover rounded"
                  />
                ) : (
                  <div className="h-10 w-10 flex items-center justify-center bg-gray-100 dark:bg-neutral-900 rounded">
                    {getStatusIcon(attachment.extractionStatus)}
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-gray-900 dark:text-white">
                  {attachment.fileName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(attachment.fileSize)}
                  </span>
                  {getStatusBadge(attachment.extractionStatus)}
                </div>
                
                {/* Extracted data preview */}
                {attachment.extractedData && attachment.extractionStatus === 'completed' && (
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {attachment.extractedData.documentType && (
                      <span className="capitalize">{attachment.extractedData.documentType}</span>
                    )}
                    {attachment.extractedData.total !== undefined && (
                      <span> · ${attachment.extractedData.total.toFixed(2)}</span>
                    )}
                    {attachment.extractedData.vendorName && (
                      <span> · {attachment.extractedData.vendorName}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {attachment.extractionStatus === 'completed' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setSelectedAttachment(attachment)}
                    data-testid={`button-view-${attachment.id}`}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                )}
                {!attachment.extractionStatus && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onProcess(attachment.id)}
                    data-testid={`button-process-${attachment.id}`}
                  >
                    Process
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => onRemove(attachment.id)}
                  data-testid={`button-remove-${attachment.id}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Extraction result dialog */}
      <Dialog open={!!selectedAttachment} onOpenChange={() => setSelectedAttachment(null)}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-extraction-result">
          <DialogHeader>
            <DialogTitle>Extracted Document Data</DialogTitle>
          </DialogHeader>
          
          {selectedAttachment?.extractedData && (
            <div className="space-y-3">
              {/* Document info */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {selectedAttachment.extractedData.documentType && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Type:</span>
                    <span className="ml-2 font-medium capitalize text-gray-900 dark:text-white">
                      {selectedAttachment.extractedData.documentType}
                    </span>
                  </div>
                )}
                {selectedAttachment.extractedData.confidence && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Confidence:</span>
                    <Badge variant="outline" className="ml-2">
                      {selectedAttachment.extractedData.confidence}
                    </Badge>
                  </div>
                )}
                {selectedAttachment.extractedData.date && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Date:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {selectedAttachment.extractedData.date}
                    </span>
                  </div>
                )}
                {selectedAttachment.extractedData.total !== undefined && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Total:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      ${selectedAttachment.extractedData.total.toFixed(2)}
                    </span>
                  </div>
                )}
                {selectedAttachment.extractedData.vendorName && (
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Vendor:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {selectedAttachment.extractedData.vendorName}
                    </span>
                  </div>
                )}
                {selectedAttachment.extractedData.customerName && (
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Customer:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {selectedAttachment.extractedData.customerName}
                    </span>
                  </div>
                )}
              </div>

              {/* Line items */}
              {selectedAttachment.extractedData.lineItems && selectedAttachment.extractedData.lineItems.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Line Items ({selectedAttachment.extractedData.lineItems.length})
                  </p>
                  <ScrollArea className="max-h-40 border rounded-md">
                    <div className="p-2 space-y-1">
                      {selectedAttachment.extractedData.lineItems.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400">{item.description}</span>
                          <span className="font-medium text-gray-900 dark:text-white">${item.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Warnings */}
              {selectedAttachment.extractedData.warnings && selectedAttachment.extractedData.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-md p-2">
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-100 mb-1">Warnings</p>
                  <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
                    {selectedAttachment.extractedData.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
