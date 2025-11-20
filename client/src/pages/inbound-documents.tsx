import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Mail, MessageSquare, Smartphone, Code, Download, Eye, Check, X, Edit, MoreVertical, Upload } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import type { InboundDocument } from "@shared/schema";
import { format } from "date-fns";

const sourceIcons: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageSquare,
  sms: Smartphone,
  api: Code,
};

const sourceColors: Record<string, string> = {
  email: "bg-blue-600 dark:bg-blue-600",
  whatsapp: "bg-green-600 dark:bg-green-600",
  sms: "bg-purple-600 dark:bg-purple-600",
  api: "bg-gray-600 dark:bg-gray-600",
};

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  processing: "default",
  extracted: "outline",
  approved: "default",
  rejected: "destructive",
  failed: "destructive",
};

export default function InboundDocumentsPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<string>("pending");
  const [selectedDoc, setSelectedDoc] = useState<InboundDocument | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | null>(null);

  const { data: documents, isLoading } = useQuery<InboundDocument[]>({
    queryKey: ["/api/inbound-documents", currentTenant?.id, selectedStatus],
    enabled: !!currentTenant,
  });

  const handleViewDetails = (doc: InboundDocument) => {
    setSelectedDoc(doc);
    setShowDetailDialog(true);
  };

  const handleStartApproval = (action: "approve" | "reject") => {
    setApprovalAction(action);
    setShowApprovalDialog(true);
  };

  const handleConfirmApproval = async () => {
    if (!selectedDoc || !approvalAction) return;

    try {
      await apiRequest(`/api/inbound-documents/${selectedDoc.id}/${approvalAction}`, {
        method: "PATCH",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-documents"] });
      toast({
        title: `Document ${approvalAction}d`,
        description: `The document has been ${approvalAction}d successfully`,
      });
      setShowApprovalDialog(false);
      setShowDetailDialog(false);
      setApprovalAction(null);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${approvalAction} document`,
        variant: "destructive",
      });
    }
  };

  const handleDownload = (doc: InboundDocument) => {
    if (doc.localPath) {
      window.open(`/api/inbound-documents/${doc.id}/download`, "_blank");
    }
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return "Unknown";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const SourceIcon = ({ source }: { source: string }) => {
    const Icon = sourceIcons[source] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Inbound Documents
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage documents received via email, WhatsApp, SMS, and API
          </p>
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
        <TabsList className="grid w-full grid-cols-6" data-testid="tabs-status">
          <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
          <TabsTrigger value="processing" data-testid="tab-processing">Processing</TabsTrigger>
          <TabsTrigger value="extracted" data-testid="tab-extracted">Extracted</TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Documents List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : documents && documents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover-elevate" data-testid={`card-document-${doc.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`rounded-full p-2 ${sourceColors[doc.source]}`}>
                      <SourceIcon source={doc.source} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-medium text-gray-900 dark:text-white truncate">
                        {doc.fileName}
                      </CardTitle>
                      <CardDescription className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {doc.sourceIdentifier || "Unknown sender"}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" data-testid={`button-actions-${doc.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewDetails(doc)} data-testid={`menu-view-${doc.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(doc)} data-testid={`menu-download-${doc.id}`}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {doc.source}
                  </Badge>
                  <Badge variant={statusVariants[doc.status]} className="capitalize" data-testid={`badge-status-${doc.status}`}>
                    {doc.status}
                  </Badge>
                  {doc.draftEntryType && (
                    <Badge variant="outline" className="capitalize">
                      {doc.draftEntryType}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <div>Size: {formatFileSize(doc.fileSize)}</div>
                  <div>Uploaded: {format(new Date(doc.createdAt!), "MMM d, yyyy 'at' h:mm a")}</div>
                </div>
                {doc.status === "extracted" && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setSelectedDoc(doc);
                        handleStartApproval("approve");
                      }}
                      data-testid={`button-approve-${doc.id}`}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedDoc(doc);
                        handleStartApproval("reject");
                      }}
                      data-testid={`button-reject-${doc.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No documents found
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
              There are no documents with the selected status. Documents will appear here when they're received.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Document Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
              Document Details
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
              {selectedDoc?.fileName}
            </DialogDescription>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              {/* Document Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Source</div>
                  <div className="font-medium text-gray-900 dark:text-white capitalize">{selectedDoc.source}</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Status</div>
                  <div className="font-medium text-gray-900 dark:text-white capitalize">{selectedDoc.status}</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">File Size</div>
                  <div className="font-medium text-gray-900 dark:text-white">{formatFileSize(selectedDoc.fileSize)}</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Uploaded</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {format(new Date(selectedDoc.createdAt!), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                </div>
              </div>

              {/* AI Extraction Results */}
              {selectedDoc.status === "extracted" && selectedDoc.extractedData && (
                <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">AI Extraction Results</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-4 font-mono text-xs">
                    <pre className="whitespace-pre-wrap text-gray-900 dark:text-white">
                      {JSON.stringify(selectedDoc.extractedData, null, 2)}
                    </pre>
                  </div>
                  {selectedDoc.draftEntryType && (
                    <div className="mt-3">
                      <Badge variant="outline" className="capitalize">
                        Draft {selectedDoc.draftEntryType} created
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {selectedDoc.errorMessage && (
                <div className="border border-red-200 dark:border-red-900 rounded-lg p-4 bg-red-50 dark:bg-red-950/20">
                  <h4 className="font-medium text-red-900 dark:text-red-400 mb-2">Error</h4>
                  <p className="text-sm text-red-800 dark:text-red-300">{selectedDoc.errorMessage}</p>
                </div>
              )}

              {/* Action Buttons */}
              {selectedDoc.status === "extracted" && (
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setShowDetailDialog(false)} data-testid="button-close-dialog">
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleStartApproval("reject")}
                    data-testid="button-reject-dialog"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleStartApproval("approve")}
                    data-testid="button-approve-dialog"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Confirmation Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
              Confirm {approvalAction === "approve" ? "Approval" : "Rejection"}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to {approvalAction} this document?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)} data-testid="button-cancel-approval">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmApproval}
              variant={approvalAction === "approve" ? "default" : "destructive"}
              data-testid="button-confirm-approval"
            >
              Confirm {approvalAction === "approve" ? "Approval" : "Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
