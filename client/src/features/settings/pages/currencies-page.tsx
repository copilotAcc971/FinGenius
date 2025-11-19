import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/shared/lib/api/queryClient';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { Plus, Star, Trash2, Power, PowerOff, RefreshCw } from 'lucide-react';
import { Separator } from '@/shared/components/ui/separator';
import { toast } from '@/shared/hooks/use-toast';
import { AddCurrencyDialog } from '@/shared/components/currencies/add-currency-dialog';
import { ManualRateEntryDialog } from '@/shared/components/currencies/manual-rate-entry-dialog';
import { ExchangeRateHistoryTable } from '@/shared/components/currencies/exchange-rate-history-table';
import type { Currency, ExchangeRate } from '@shared/schema';
import type { FXConfig } from '@shared/fx-types';

export default function CurrenciesPage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [manualRateDialogOpen, setManualRateDialogOpen] = useState(false);

  const { data: currencies = [], isLoading } = useQuery<Currency[]>({
    queryKey: ['/api/currencies'],
  });

  const { data: fxConfig } = useQuery<FXConfig>({
    queryKey: ['/api/settings/fx-config'],
  });

  const { data: latestRates = [] } = useQuery<ExchangeRate[]>({
    queryKey: ['/api/exchange-rates/latest'],
  });

  const setBaseMutation = useMutation({
    mutationFn: async (code: string) => {
      await apiRequest(`/api/currencies/${code}/set-base`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/currencies'] });
      toast({
        title: 'Base currency updated',
        description: 'The base currency has been successfully changed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set base currency',
        variant: 'destructive',
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ code, isActive }: { code: string; isActive: boolean }) => {
      await apiRequest(`/api/currencies/${code}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/currencies'] });
      toast({
        title: 'Currency updated',
        description: 'Currency status has been updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update currency',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (code: string) => {
      await apiRequest(`/api/currencies/${code}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/currencies'] });
      toast({
        title: 'Currency deleted',
        description: 'Currency has been successfully removed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete currency',
        variant: 'destructive',
      });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: Partial<FXConfig>) => {
      await apiRequest('/api/settings/fx-config', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/fx-config'] });
      toast({
        title: 'Configuration updated',
        description: 'FX rate settings have been saved.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update configuration',
        variant: 'destructive',
      });
    },
  });

  const refreshRatesMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/exchange-rates/refresh', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/exchange-rates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exchange-rates/latest'] });
      toast({
        title: 'Rates refreshed',
        description: 'Exchange rates have been updated from external sources.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to refresh exchange rates',
        variant: 'destructive',
      });
    },
  });

  const baseCurrency = currencies.find(c => c.isBaseCurrency);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-currencies">Currencies</h1>
          <p className="text-muted-foreground">
            Manage currencies and exchange rates for multi-currency transactions
          </p>
        </div>
        <Button
          onClick={() => setAddDialogOpen(true)}
          data-testid="button-add-currency"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Currency
        </Button>
      </div>

      {baseCurrency && (
        <Card>
          <CardHeader>
            <CardTitle>Base Currency</CardTitle>
            <CardDescription>
              All financial reports and summaries use this currency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-semibold" data-testid="text-base-currency">
                {baseCurrency.code}
              </div>
              <Badge variant="secondary">{baseCurrency.symbol}</Badge>
              <span className="text-sm text-muted-foreground">
                {baseCurrency.name}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Currencies</CardTitle>
          <CardDescription>
            {currencies.length} {currencies.length === 1 ? 'currency' : 'currencies'} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading currencies...
            </div>
          ) : currencies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No currencies configured. Add your first currency to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Decimals</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencies.map((currency) => (
                  <TableRow key={currency.code} data-testid={`row-currency-${currency.code}`}>
                    <TableCell className="font-medium">
                      {currency.code}
                      {currency.isBaseCurrency && (
                        <Star className="inline ml-2 h-4 w-4 text-yellow-500" data-testid={`icon-base-${currency.code}`} />
                      )}
                    </TableCell>
                    <TableCell>{currency.name}</TableCell>
                    <TableCell>{currency.symbol}</TableCell>
                    <TableCell>{currency.decimalPlaces}</TableCell>
                    <TableCell>
                      <Badge variant={currency.isActive ? 'default' : 'secondary'} data-testid={`badge-status-${currency.code}`}>
                        {currency.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!currency.isBaseCurrency && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setBaseMutation.mutate(currency.code)}
                            disabled={setBaseMutation.isPending}
                            data-testid={`button-set-base-${currency.code}`}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleActiveMutation.mutate({
                            code: currency.code,
                            isActive: currency.isActive
                          })}
                          disabled={toggleActiveMutation.isPending}
                          data-testid={`button-toggle-${currency.code}`}
                        >
                          {currency.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`Delete currency ${currency.code}?`)) {
                              deleteMutation.mutate(currency.code);
                            }
                          }}
                          disabled={currency.isBaseCurrency || deleteMutation.isPending}
                          data-testid={`button-delete-${currency.code}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Exchange Rate Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle>Exchange Rate Configuration</CardTitle>
          <CardDescription>
            Configure how exchange rates are fetched and managed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-refresh toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-refresh">Automatic Rate Updates</Label>
              <p className="text-sm text-muted-foreground">
                Automatically fetch latest rates daily at 6 AM UTC
              </p>
            </div>
            <Switch
              id="auto-refresh"
              checked={fxConfig?.autoRefreshEnabled ?? true}
              onCheckedChange={(checked) => {
                updateConfigMutation.mutate({ autoRefreshEnabled: checked });
              }}
              data-testid="switch-auto-refresh"
            />
          </div>

          <Separator />

          {/* Rate source strategy */}
          <div className="space-y-2">
            <Label htmlFor="source-strategy">Rate Source Strategy</Label>
            <Select
              value={fxConfig?.sourceStrategy ?? 'api'}
              onValueChange={(value) => {
                updateConfigMutation.mutate({ sourceStrategy: value as any });
              }}
            >
              <SelectTrigger id="source-strategy" data-testid="select-source-strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="api">API Only (Automatic)</SelectItem>
                <SelectItem value="manual">Manual Entry Only</SelectItem>
                <SelectItem value="hybrid">Hybrid (API + Manual Override)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Choose how exchange rates are sourced
            </p>
          </div>

          {/* Regional Central Bank and Provider selectors (only show if sourceStrategy is 'api' or 'hybrid') */}
          {(fxConfig?.sourceStrategy === 'api' || fxConfig?.sourceStrategy === 'hybrid') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="primary-rate-source">Primary Rate Source</Label>
                <Select
                  value={fxConfig?.primaryRateSource ?? 'cbuae'}
                  onValueChange={(value) => {
                    updateConfigMutation.mutate({ primaryRateSource: value as any });
                  }}
                >
                  <SelectTrigger id="primary-rate-source" data-testid="select-primary-rate-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cbuae">CBUAE (UAE Central Bank)</SelectItem>
                    <SelectItem value="ecb">ECB (European Central Bank)</SelectItem>
                    <SelectItem value="sama">SAMA (Saudi Arabian Monetary Authority)</SelectItem>
                    <SelectItem value="boe">BOE (Bank of England)</SelectItem>
                    <SelectItem value="fed">FED (US Federal Reserve)</SelectItem>
                    <SelectItem value="manual">Manual Entry Only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Select the regional central bank for your primary currency
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primary-source-provider">Provider</Label>
                <Select
                  value={fxConfig?.primarySourceProvider ?? 'github'}
                  onValueChange={(value) => {
                    updateConfigMutation.mutate({ primarySourceProvider: value as any });
                  }}
                  disabled={fxConfig?.primaryRateSource === 'manual'}
                >
                  <SelectTrigger id="primary-source-provider" data-testid="select-primary-source-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="github">GitHub Mirror</SelectItem>
                    <SelectItem value="api">Official API</SelectItem>
                    <SelectItem value="fluentax">Fluentax (Commercial)</SelectItem>
                    <SelectItem value="manual">Manual Entry</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {fxConfig?.primaryRateSource === 'cbuae' && 'GitHub mirror recommended for CBUAE (no official API)'}
                  {fxConfig?.primaryRateSource === 'ecb' && 'ECB provides free official API'}
                  {fxConfig?.primaryRateSource === 'fed' && 'FED provides free official data via FRED'}
                  {fxConfig?.primaryRateSource === 'boe' && 'BOE provides official API access'}
                  {fxConfig?.primaryRateSource === 'sama' && 'SAMA integration coming soon'}
                  {fxConfig?.primaryRateSource === 'manual' && 'Manual entry only - no automated fetching'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fallback-rate-source">Fallback Source (Optional)</Label>
                <Select
                  value={fxConfig?.fallbackRateSource ?? 'none'}
                  onValueChange={(value) => {
                    updateConfigMutation.mutate({ fallbackRateSource: value === 'none' ? null : value as any });
                  }}
                >
                  <SelectTrigger id="fallback-rate-source" data-testid="select-fallback-rate-source">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="cbuae">CBUAE (UAE)</SelectItem>
                    <SelectItem value="ecb">ECB (Europe)</SelectItem>
                    <SelectItem value="sama">SAMA (Saudi Arabia)</SelectItem>
                    <SelectItem value="boe">BOE (UK)</SelectItem>
                    <SelectItem value="fed">FED (USA)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Fallback source to use if primary source fails
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* Manual refresh and last updated */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Last Updated</Label>
              <p className="text-sm text-muted-foreground">
                {fxConfig?.lastRefreshAt 
                  ? new Date(fxConfig.lastRefreshAt).toLocaleString()
                  : 'Never'
                }
              </p>
            </div>
            <Button
              onClick={() => refreshRatesMutation.mutate()}
              disabled={refreshRatesMutation.isPending}
              data-testid="button-refresh-rates"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshRatesMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh Now
            </Button>
          </div>

          {/* Current rates count */}
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              {latestRates.length} active exchange rate pairs configured
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Exchange Rate History Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Exchange Rate History</CardTitle>
              <CardDescription>
                View and manage historical exchange rates
              </CardDescription>
            </div>
            <Button
              onClick={() => setManualRateDialogOpen(true)}
              data-testid="button-add-manual-rate"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Manual Rate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ExchangeRateHistoryTable currencies={currencies} />
        </CardContent>
      </Card>

      <AddCurrencyDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <ManualRateEntryDialog
        open={manualRateDialogOpen}
        onOpenChange={setManualRateDialogOpen}
        currencies={currencies}
      />
    </div>
  );
}
