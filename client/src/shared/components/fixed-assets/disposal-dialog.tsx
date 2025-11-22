import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import type { FixedAsset } from "@shared/schema";
import { useToast } from "@/shared/hooks/use-toast";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Loader2, AlertTriangle, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";

interface DisposalDialogProps {
  asset: FixedAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DisposalDialog({ asset, open, onOpenChange, onSuccess }: DisposalDialogProps) {
  const { toast } = useToast();
  const [disposalDate, setDisposalDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [disposalAmount, setDisposalAmount] = useState("");
  const [gainLoss, setGainLoss] = useState<number | null>(null);

  const disposalMutation = useMutation({
    mutationFn: (data: { disposalDate: string; disposalAmount: string }) =>
      apiRequest(`/api/fixed-assets/${asset?.id}/dispose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      toast({
        title: "Asset disposed successfully",
        description: `Journal entry created with ${data.gainLoss > 0 ? 'gain' : 'loss'} of ${formatCurrency(Math.abs(data.gainLoss))}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets", asset?.id] });
      onOpenChange(false);
      onSuccess?.();
      // Reset form
      setDisposalAmount("");
      setGainLoss(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error disposing asset",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return "$0.00";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const calculateGainLoss = () => {
    if (!asset || !disposalAmount) return;
    
    const disposal = parseFloat(disposalAmount);
    const bookValue = parseFloat(asset.currentBookValue || '0');
    const calculated = disposal - bookValue;
    setGainLoss(calculated);
  };

  const handleDisposal = () => {
    if (!disposalDate || !disposalAmount) {
      toast({
        title: "Missing information",
        description: "Please enter disposal date and amount",
        variant: "destructive",
      });
      return;
    }

    disposalMutation.mutate({
      disposalDate,
      disposalAmount,
    });
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dispose Fixed Asset</DialogTitle>
          <DialogDescription>
            Record the disposal of {asset.name} ({asset.assetCode})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Asset Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Asset Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Acquisition Date:</span>
                  <p className="font-medium">
                    {asset.acquisitionDate ? 
                      format(new Date(asset.acquisitionDate), "MMM dd, yyyy") : 
                      "-"
                    }
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Acquisition Cost:</span>
                  <p className="font-medium">{formatCurrency(asset.acquisitionCost)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Accumulated Depreciation:</span>
                  <p className="font-medium">
                    {formatCurrency(
                      parseFloat(asset.acquisitionCost || '0') - parseFloat(asset.currentBookValue || '0')
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Book Value:</span>
                  <p className="font-medium">{formatCurrency(asset.currentBookValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Disposal Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="disposal-date">Disposal Date</Label>
                <Input
                  id="disposal-date"
                  type="date"
                  value={disposalDate}
                  onChange={(e) => setDisposalDate(e.target.value)}
                  max={format(new Date(), "yyyy-MM-dd")}
                  data-testid="input-disposal-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="disposal-amount">Disposal Amount</Label>
                <Input
                  id="disposal-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={disposalAmount}
                  onChange={(e) => {
                    setDisposalAmount(e.target.value);
                    setGainLoss(null);
                  }}
                  onBlur={calculateGainLoss}
                  data-testid="input-disposal-amount"
                />
              </div>
            </div>

            {/* Gain/Loss Preview */}
            {gainLoss !== null && (
              <Card className={gainLoss >= 0 ? "border-green-500" : "border-red-500"}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {gainLoss >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium">
                        {gainLoss >= 0 ? "Gain on Disposal" : "Loss on Disposal"}
                      </span>
                    </div>
                    <span className={`text-lg font-bold ${gainLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatCurrency(Math.abs(gainLoss))}
                    </span>
                  </div>
                  <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Disposal Amount:</span>
                      <span>{formatCurrency(disposalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Book Value:</span>
                      <span>{formatCurrency(asset.currentBookValue)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-medium">
                      <span>{gainLoss >= 0 ? "Gain" : "Loss"}:</span>
                      <span>{formatCurrency(Math.abs(gainLoss))}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Disposing this asset will:
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>Create a journal entry for the disposal transaction</li>
                  <li>Record any gain or loss on disposal</li>
                  <li>Update the asset status to "Disposed"</li>
                  <li>This action cannot be undone</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disposalMutation.isPending}
            data-testid="button-cancel-disposal"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDisposal}
            disabled={!disposalDate || !disposalAmount || disposalMutation.isPending}
            data-testid="button-confirm-disposal"
          >
            {disposalMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Confirm Disposal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}