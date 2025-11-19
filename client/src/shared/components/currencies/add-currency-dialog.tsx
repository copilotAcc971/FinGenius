import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/shared/lib/api/queryClient';
import { z } from 'zod';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { toast } from '@/shared/hooks/use-toast';
import { insertCurrencySchema } from '@shared/schema';

const formSchema = insertCurrencySchema.extend({
  setAsBase: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddCurrencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCurrencyDialog({ open, onOpenChange }: AddCurrencyDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tenantId: '',
      code: '',
      name: '',
      symbol: '',
      decimalPlaces: 2,
      isBaseCurrency: false,
      isActive: true,
      setAsBase: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { setAsBase, ...currencyData } = data;
      
      const response = await apiRequest('/api/currencies', {
        method: 'POST',
        body: JSON.stringify(currencyData),
      });
      
      if (setAsBase) {
        await apiRequest(`/api/currencies/${data.code}/set-base`, {
          method: 'POST',
        });
      }
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/currencies'] });
      toast({
        title: 'Currency added',
        description: 'New currency has been successfully added.',
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add currency',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-add-currency">
        <DialogHeader>
          <DialogTitle>Add Currency</DialogTitle>
          <DialogDescription>
            Add a new currency to enable multi-currency transactions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="USD"
                      maxLength={3}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      data-testid="input-currency-code"
                    />
                  </FormControl>
                  <FormDescription>
                    3-letter ISO 4217 code (e.g., USD, EUR, GBP, AED)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="US Dollar"
                      {...field}
                      data-testid="input-currency-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="$"
                      {...field}
                      data-testid="input-currency-symbol"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="decimalPlaces"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decimal Places</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={4}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                      data-testid="input-currency-decimals"
                    />
                  </FormControl>
                  <FormDescription>
                    Number of decimal places (0-4). Most currencies use 2.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-currency-active"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Activate immediately</FormLabel>
                    <FormDescription>
                      Enable this currency for transactions right away
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="setAsBase"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-set-base"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Set as base currency</FormLabel>
                    <FormDescription>
                      Use this currency for financial reports and summaries
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
                data-testid="button-cancel-currency"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-currency"
              >
                {createMutation.isPending ? 'Adding...' : 'Add Currency'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
