import { useState, useCallback } from "react";
import { Upload, X, Download, FileIcon, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { useToast } from "@/shared/hooks/use-toast";

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData?: string;
  uploadedBy?: string;
  uploadedAt: string;
}

interface AttachmentManagerProps {
  entityType: string;
  entityId?: string;
  maxFiles?: number;
  maxFileSize?: number;
  disabled?: boolean;
}

export function AttachmentManager({
  entityType,
  entityId,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  disabled = false,
}: AttachmentManagerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch attachments
  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey: ["/api", entityType, entityId, "attachments"],
    enabled: !!entityId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            const response = await apiRequest("POST", "/api/attachments", {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileData: base64Data,
              entityType,
              entityId,
            });
            resolve(response);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api", entityType, entityId, "attachments"] });
      toast({
        title: "Success",
        description: "Attachment uploaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload attachment",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      apiRequest("DELETE", `/api/attachments/${attachmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api", entityType, entityId, "attachments"] });
      toast({
        title: "Success",
        description: "Attachment deleted successfully",
      });
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message || "Failed to delete attachment",
      });
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [disabled]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    if (!entityId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please save the document before uploading attachments",
      });
      return;
    }

    // Check max files limit
    if (attachments.length + files.length > maxFiles) {
      toast({
        variant: "destructive",
        title: "Too many files",
        description: `Maximum ${maxFiles} attachments allowed`,
      });
      return;
    }

    // Validate and upload each file
    files.forEach((file) => {
      if (file.size > maxFileSize) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`,
        });
        return;
      }
      uploadMutation.mutate(file);
    });
  };

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await apiRequest("GET", `/api/attachments/${attachment.id}`);
      
      // Create blob from base64 data
      const base64Data = response.fileData;
      const byteCharacters = atob(base64Data.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachment.fileType });

      // Download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: error.message || "Failed to download attachment",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!entityId) {
    return (
      <Alert data-testid="alert-save-before-attach">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Save the document first to enable attachments
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4" data-testid="attachment-manager">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${
          dragActive ? "border-primary bg-accent" : "border-border"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover-elevate"}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        data-testid="dropzone-upload"
      >
        <input
          type="file"
          multiple
          onChange={handleFileInput}
          disabled={disabled}
          className="hidden"
          id="file-upload"
          data-testid="input-file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-foreground">
            Drag and drop files here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Max {maxFiles} files, 10MB each
          </p>
        </label>
      </div>

      {/* Upload Progress */}
      {uploadMutation.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="upload-progress">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading...
        </div>
      )}

      {/* Attachments List */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="attachments-loading">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading attachments...
        </div>
      ) : attachments.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium" data-testid="text-attachments-count">
            {attachments.length} {attachments.length === 1 ? "Attachment" : "Attachments"}
          </p>
          {attachments.map((attachment) => (
            <Card
              key={attachment.id}
              className="p-3 flex items-center justify-between gap-3"
              data-testid={`attachment-${attachment.id}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileIcon className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" data-testid="text-file-name">
                    {attachment.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="text-file-meta">
                    {formatFileSize(attachment.fileSize)} • {formatDate(attachment.uploadedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => downloadAttachment(attachment)}
                  disabled={disabled}
                  data-testid={`button-download-${attachment.id}`}
                  aria-label={`Download ${attachment.fileName}`}
                  title="Download file"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleteConfirm(attachment.id)}
                  disabled={disabled}
                  data-testid={`button-delete-${attachment.id}`}
                  aria-label={`Delete ${attachment.fileName}`}
                  title="Delete attachment"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="text-no-attachments">
          No attachments
        </p>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this attachment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
