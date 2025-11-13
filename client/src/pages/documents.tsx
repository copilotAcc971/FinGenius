import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Document } from "@shared/schema";

export default function Documents() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      processing: "secondary",
      completed: "default",
      failed: "destructive",
    };
    const labels: Record<string, string> = {
      pending: "Pending",
      processing: "AI Analyzing",
      completed: "Extracted",
      failed: "Failed",
    };
    return (
      <Badge variant={variants[status] || "secondary"} data-testid={`badge-status-${status}`}>
        {status === "processing" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
        {labels[status] || status}
      </Badge>
    );
  };

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Workspace Selected</h2>
          <p className="text-muted-foreground">Please select or create a workspace to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Documents</h1>
          <p className="text-muted-foreground">Upload and manage documents with AI extraction</p>
        </div>
        <Button data-testid="button-upload-document">
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      <div className="border-2 border-dashed rounded-lg p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">Upload Documents</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Drag and drop files here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Supports: PDF, JPG, PNG (Max 10MB)
            </p>
          </div>
          <Button data-testid="button-browse-files">
            <FileText className="mr-2 h-4 w-4" />
            Browse Files
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 border rounded-lg">
          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Linked To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                  <TableCell className="font-medium">{doc.fileName}</TableCell>
                  <TableCell className="capitalize">{doc.type}</TableCell>
                  <TableCell>{new Date(doc.createdAt!).toLocaleDateString()}</TableCell>
                  <TableCell>{getStatusBadge(doc.extractionStatus || "pending")}</TableCell>
                  <TableCell>
                    {doc.linkedEntityType ? (
                      <span className="text-sm">
                        {doc.linkedEntityType.charAt(0).toUpperCase() + doc.linkedEntityType.slice(1)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
