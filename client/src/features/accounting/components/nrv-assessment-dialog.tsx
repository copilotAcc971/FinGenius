import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertNrvAssessmentSchema, type Item } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { useTenant } from "@/shared/hooks/useTenant";
import { Calendar } from "@/shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/shared/lib/utils/utils";

const formSchema = insertNrvAssessmentSchema;

interface NrvAssessmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item;
}

export function NrvAssessmentDialog({ open, onOpenChange, item }: NrvAssessmentDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && !item,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemId: "",
      assessmentDate: new Date(),
      costValue: "0",
      nrvValue: "0",
      writeDownAmount: "0",
      status: "pending",
      notes: "",
    },
  });

  useEffect(() => {
    if (item) {
      const cost = parseFloat(item.purchasePrice || "0");
      const nrv = item.nrvValue ? parseFloat(item.nrvValue) : parseFloat(item.rate || "0") * 0.95;
      const writeDown = Math.max(0, cost - nrv);

      form.reset({
        itemId: item.id,
        assessmentDate: new Date(),
        costValue: cost.toFixed(2),
        nrvValue: nrv.toFixed(2),
        writeDownAmount: writeDown.toFixed(2),
        status: "pending",
        notes: "",
      });
    } else {
      form.reset({
        itemId: "",
        assessmentDate: new Date(),
        costValue: "0",
        nrvValue: "0",
        writeDownAmount: "0",
        status: "pending",
        notes: "",
      });
    }
  }, [item, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      return await apiRequest("/api/nrv-assessments", "POST", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nrv-assessments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: "NRV Assessment created",
        description: "NRV assessment has been created successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create NRV assessment.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    saveMutation.mutate(values);
  };

  const selectedItemId = form.watch("itemId");
  const selectedItem = items.find(i => i.id === selectedItemId);
  const costValue = form.watch("costValue");
  const nrvValue = form.watch("nrvValue");

  useEffect(() => {
    if (selectedItem && !item) {
      const cost = parseFloat(selectedItem.purchasePrice || "0");
      const nrv = selectedItem.nrvValue 
        ? parseFloat(selectedItem.nrvValue) 
        : parseFloat(selectedItem.rate || "0") * 0.95;
      const writeDown = Math.max(0, cost - nrv);

      form.setValue("costValue", cost.toFixed(2));
      form.setValue("nrvValue", nrv.toFixed(2));
      form.setValue("writeDownAmount", writeDown.toFixed(2));
    }
  }, [selectedItem, form, item]);

  useEffect(() => {
    const cost = parseFloat(costValue || "0");
    const nrv = parseFloat(nrvValue || "0");
    const writeDown = Math.max(0, cost - nrv);
    form.setValue("writeDownAmount", writeDown.toFixed(2));
  }, [costValue, nrvValue, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-nrv-assessment">
        <DialogHeader>
          <DialogTitle>Create NRV Assessment (IAS 2)</DialogTitle>
          <DialogDescription>
            Assess Net Realizable Value for inventory items to comply with IAS 2 requirements.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!item && (
              <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      data-testid="select-item"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {items.map((item) => (
                          <SelectItem key={item.id} value={item.id} data-testid={`option-item-${item.id}`}>
                            {item.name} (SKU: {item.sku || "N/A"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="assessmentDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Assessment Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="button-assessment-date"
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="costValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-cost-value"
                      />
                    </FormControl>
                    <FormDescription>Item cost/purchase price</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nrvValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NRV Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-nrv-value"
                      />
                    </FormControl>
                    <FormDescription>Net realizable value</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="writeDownAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Write-Down Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      disabled
                      data-testid="input-writedown-amount"
                      className="bg-muted"
                    />
                  </FormControl>
                  <FormDescription>Auto-calculated: Cost - NRV (if positive)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Assessment notes and justification..."
                      {...field}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                data-testid="button-create-assessment"
              >
                {saveMutation.isPending ? "Creating..." : "Create Assessment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
