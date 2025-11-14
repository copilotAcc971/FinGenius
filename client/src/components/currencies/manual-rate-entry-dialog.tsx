import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import type { Currency } from '@shared/schema';
import { insertExchangeRateSchema } from '@shared/schema';

const formSchema = insertExchangeRateSchema.omit({ 
  tenantId: true,
  fromCurrencyCode: true,
  toCurrencyCode: true,
  createdBy: true,
}).extend({
  fromCurrency: z.string().min(3).max(3),
  toCurrency: z.string().min(3).max(3),
  applyReciprocal: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ManualRateEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currencies: Currency[];
}

export function ManualRateEntryDialog({ 
  open, 
  onOpenChange, 
  currencies 
}: ManualRateEntryDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromCurrency: '',
      toCurrency: '',
      rate: '',
      effectiveDate: new Date(),
      source: 'manual',
      applyReciprocal: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { fromCurrency, toCurrency, applyReciprocal, ...rateData } = data;
      
      return await apiRequest('/api/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({
          ...rateData,
          fromCurrencyCode: fromCurrency,
          toCurrencyCode: toCurrency,
          applyReciprocal,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/exchange-rates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exchange-rates/latest'] });
      toast({
        title: 'Exchange rate added',
        description: 'Manual exchange rate has been successfully recorded.',
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add exchange rate',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (data.fromCurrency === data.toCurrency) {
      toast({
        title: 'Invalid currency pair',
        description: 'From and To currencies must be different',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate(data);
  };

  const activeCurrencies = currencies.filter(c => c.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-manual-rate">
        <DialogHeader>
          <DialogTitle>Add Manual Exchange Rate</DialogTitle>
          <DialogDescription>
            Enter a custom exchange rate for a specific currency pair.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fromCurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-from-manual">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeCurrencies.map(currency => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} - {currency.name}
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
              name="toCurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-to-manual">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeCurrencies.map(currency => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} - {currency.name}
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
              name="rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exchange Rate</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="1.3564"
                      {...field}
                      data-testid="input-rate"
                    />
                  </FormControl>
                  <FormDescription>
                    How many {form.watch('toCurrency') || 'TO'} per 1 {form.watch('fromCurrency') || 'FROM'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="effectiveDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Effective Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value instanceof Date 
                        ? field.value.toISOString().split('T')[0] 
                        : field.value
                      }
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                      data-testid="input-effective-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="applyReciprocal"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-reciprocal"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Create reciprocal rate</FormLabel>
                    <FormDescription>
                      Also create the inverse rate ({form.watch('toCurrency')} to {form.watch('fromCurrency')})
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-rate"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-rate"
              >
                {createMutation.isPending ? 'Adding...' : 'Add Rate'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
