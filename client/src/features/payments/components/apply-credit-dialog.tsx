import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/shared/hooks/use-toast";
import { useTenant } from "@/shared/hooks/useTenant";
import { queryClient, apiRequest } from "@/shared/lib/api/queryClient";
import { type CreditNote, type Invoice } from "@shared/schema";
import { useEffect, useState } from "react";

const applyCreditSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Amount must be greater than 0"),
});

interface ApplyCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNote: CreditNote | null;
}

export function ApplyCreditDialog({ open, onOpenChange, creditNote }: ApplyCreditDialogProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const form = useForm<z.infer<typeof applyCreditSchema>>({
    resolver: zodResolver(applyCreditSchema),
    defaultValues: {
      invoiceId: "",
      amount: "0",
    },
  });

  useEffect(() => {
    if (creditNote && open) {
      form.reset({
        invoiceId: creditNote.invoiceId || "",
        amount: parseFloat(creditNote.balanceRemaining).toFixed(2),
      });
    } else {
      form.reset({
        invoiceId: "",
        amount: "0",
      });
    }
  }, [creditNote, open, form]);

  const maxAmount = creditNote ? parseFloat(creditNote.balanceRemaining) : 0;

  const onSubmit = async (data: z.infer<typeof applyCreditSchema>) => {
    if (!currentTenant?.id || !creditNote) return;

    const amountToApply = parseFloat(data.amount);
    
    if (amountToApply > maxAmount) {
      toast({
        title: "Invalid Amount",
        description: `Amount cannot exceed ${maxAmount.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(
        `/api/credit-notes/${creditNote.id}/apply-to-invoice?tenantId=${currentTenant.id}`,
        "POST",
        {
          invoiceId: data.invoiceId,
          amount: data.amount,
        }
      );

      await queryClient.invalidateQueries({ queryKey: ["/api/credit-notes", { tenantId: currentTenant.id }] });
      await queryClient.invalidateQueries({ queryKey: ["/api/invoices", { tenantId: currentTenant.id }] });
      
      toast({ 
        title: "Credit applied successfully",
        description: `Applied $${parseFloat(data.amount).toFixed(2)} to invoice`
      });
      
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error applying credit",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Apply Credit to Invoice</DialogTitle>
        </DialogHeader>

        {creditNote && (
          <div className="p-4 bg-muted rounded-lg mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Credit Note:</span>
              <span className="text-sm" data-testid="text-credit-note-number">{creditNote.creditNoteNumber}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Total:</span>
              <span className="text-sm">${parseFloat(creditNote.total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Available Balance:</span>
              <span className="text-sm font-semibold" data-testid="text-balance-remaining">
                ${parseFloat(creditNote.balanceRemaining).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="invoiceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-invoice">
                        <SelectValue placeholder="Select invoice to apply credit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper">
                      {invoices?.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id} data-testid={`option-invoice-${invoice.id}`}>
                          {invoice.invoiceNumber} - ${parseFloat(invoice.total).toFixed(2)} ({invoice.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount to Apply *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      max={maxAmount}
                      {...field} 
                      data-testid="input-amount" 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Maximum: ${maxAmount.toFixed(2)}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
                {isSubmitting ? "Applying..." : "Apply Credit"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
