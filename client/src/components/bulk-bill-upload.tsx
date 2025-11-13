import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, XCircle, Loader2, Download, Sparkles, Tag, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ExtractedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  suggestedCategory?: string;
  suggestedAccountType?: string;
}

interface ExtractedBillData {
  vendorName: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  lineItems: ExtractedLineItem[];
  notes?: string;
  suggestedCategories?: string[];
  primaryCategory?: string;
}

interface ExtractionResult {
  success: boolean;
  index: number;
  data?: ExtractedBillData;
  error?: string;
  fileName: string;
}

interface BulkBillUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
}

export function BulkBillUpload({ open, onOpenChange, tenantId }: BulkBillUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [extractionResults, setExtractionResults] = useState<ExtractionResult[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length > 20) {
      toast({
        title: "Too many files",
        description: "Maximum 20 documents per batch",
        variant: "destructive",
      });
      return;
    }
    setFiles(selectedFiles);
    setExtractionResults([]);
  };

  const handleExtract = async () => {
    if (files.length === 0) return;

    setIsExtracting(true);
    try {
      const images = await Promise.all(
        files.map(async (file) => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = (reader.result as string).split(",")[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      const response = await apiRequest(`/api/bills/extract-bulk?tenantId=${tenantId}`, {
        method: "POST",
        body: JSON.stringify({ images }),
      });

      const data = await response.json();
      
      const resultsWithFileNames = data.results.map((result: ExtractionResult, index: number) => ({
        ...result,
        fileName: files[index]?.name || `Document ${index + 1}`,
      }));

      setExtractionResults(resultsWithFileNames);

      toast({
        title: "Extraction Complete",
        description: `${data.summary.successful} of ${data.summary.total} documents extracted successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Extraction Failed",
        description: error.message || "Failed to extract bill data",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveAll = async () => {
    if (!tenantId) {
      toast({
        title: "No workspace selected",
        description: "Please select a workspace before saving bills",
        variant: "destructive",
      });
      return;
    }

    const successfulExtractions = extractionResults.filter((r) => r.success && r.data);
    
    if (successfulExtractions.length === 0) {
      toast({
        title: "No bills to save",
        description: "No successfully extracted bills to save",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    let savedCount = 0;
    let errorCount = 0;

    try {
      for (const result of successfulExtractions) {
        if (!result.data) continue;

        try {
          const billPayload = {
            bill: {
              vendorName: result.data.vendorName,
              billNumber: result.data.billNumber,
              billDate: result.data.billDate,
              dueDate: result.data.dueDate,
              subtotal: result.data.subtotal.toString(),
              taxAmount: result.data.taxAmount.toString(),
              total: result.data.total.toString(),
              status: "draft" as const,
              notes: result.data.notes || "",
            },
            lineItems: result.data.lineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice.toString(),
              amount: item.amount.toString(),
              category: item.suggestedCategory || "Other Operating Expenses",
            })),
          };

          await apiRequest(`/api/bills?tenantId=${tenantId}`, {
            method: "POST",
            body: JSON.stringify(billPayload),
          });

          savedCount++;
        } catch (error) {
          console.error(`Failed to save bill for ${result.fileName}:`, error);
          errorCount++;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/bills", tenantId] });

      toast({
        title: "Bills Saved",
        description: `${savedCount} bills saved successfully${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
      });

      if (errorCount === 0) {
        onOpenChange(false);
        setFiles([]);
        setExtractionResults([]);
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save bills",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setExtractionResults([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Bulk Upload Bills</DialogTitle>
          <DialogDescription>
            Upload multiple bill documents for AI extraction and batch creation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {extractionResults.length === 0 ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <Label htmlFor="bulk-file-upload" className="cursor-pointer">
                  <div className="text-sm font-medium mb-2">
                    Click to upload or drag and drop
                  </div>
                  <div className="text-xs text-muted-foreground">
                    PDF, PNG, JPG up to 10MB each (max 20 files)
                  </div>
                </Label>
                <Input
                  id="bulk-file-upload"
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-bulk-file-upload"
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      {files.length} file{files.length > 1 ? "s" : ""} selected
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      data-testid="button-reset-files"
                    >
                      Clear
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-32 border rounded-md p-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 py-1">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </ScrollArea>

                  <Button
                    onClick={handleExtract}
                    disabled={isExtracting}
                    className="w-full"
                    data-testid="button-extract-all"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Extracting {files.length} document{files.length > 1 ? "s" : ""}...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Extract All with AI
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    Extraction Results ({extractionResults.filter((r) => r.success).length} of{" "}
                    {extractionResults.length} successful)
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Review extracted data before saving
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    data-testid="button-start-over"
                  >
                    Start Over
                  </Button>
                  <Button
                    onClick={handleSaveAll}
                    disabled={isSaving || extractionResults.filter((r) => r.success).length === 0}
                    data-testid="button-save-all"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Save All Bills
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[500px] border rounded-md">
                <div className="p-4 space-y-4">
                  {extractionResults.map((result, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 space-y-3"
                      data-testid={`extraction-result-${index}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <div>
                            <div className="font-medium">{result.fileName}</div>
                            {result.success && result.data && (
                              <div className="text-sm text-muted-foreground">
                                {result.data.vendorName} • Bill #{result.data.billNumber}
                              </div>
                            )}
                          </div>
                        </div>
                        {result.success && result.data ? (
                          <Badge variant="outline" className="text-lg font-semibold">
                            ${result.data.total.toFixed(2)}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                      </div>

                      {result.success && result.data ? (
                        <>
                          {result.data.primaryCategory && (
                            <Alert>
                              <Sparkles className="h-4 w-4" />
                              <AlertDescription>
                                Primary Category: <strong>{result.data.primaryCategory}</strong>
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Bill Date:</span>{" "}
                              <span className="font-medium">{result.data.billDate}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Due Date:</span>{" "}
                              <span className="font-medium">{result.data.dueDate}</span>
                            </div>
                          </div>

                          {result.data.lineItems.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Line Items:</div>
                              <div className="space-y-2">
                                {result.data.lineItems.map((item, itemIndex) => (
                                  <div
                                    key={itemIndex}
                                    className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium">{item.description}</div>
                                      {item.suggestedCategory && (
                                        <div className="flex items-center gap-1 mt-1">
                                          <Tag className="h-3 w-3 text-muted-foreground" />
                                          <Badge variant="secondary" className="text-xs">
                                            {item.suggestedCategory}
                                          </Badge>
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="font-medium">${item.amount.toFixed(2)}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {item.quantity} × ${item.unitPrice.toFixed(2)}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{result.error || "Extraction failed"}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
