import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Download } from 'lucide-react';
import type { ExchangeRate, Currency } from '@shared/schema';

interface ExchangeRateHistoryTableProps {
  currencies: Currency[];
}

export function ExchangeRateHistoryTable({ currencies }: ExchangeRateHistoryTableProps) {
  const [fromCurrency, setFromCurrency] = useState<string>('ALL');
  const [toCurrency, setToCurrency] = useState<string>('ALL');

  const { data: rates = [], isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ['/api/exchange-rates', { 
      fromCurrency: fromCurrency === 'ALL' ? undefined : fromCurrency,
      toCurrency: toCurrency === 'ALL' ? undefined : toCurrency,
      limit: 50,
    }],
    enabled: currencies.length > 0,
  });

  const exportToCSV = () => {
    if (rates.length === 0) return;

    const headers = ['Date', 'From', 'To', 'Rate', 'Source', 'Manual Override'];
    const rows = rates.map(rate => [
      new Date(rate.effectiveDate).toLocaleDateString(),
      rate.fromCurrencyCode,
      rate.toCurrencyCode,
      rate.rate,
      rate.source || 'api',
      rate.source === 'manual' ? 'Yes' : 'No',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exchange-rates-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <Select value={fromCurrency} onValueChange={setFromCurrency}>
            <SelectTrigger data-testid="select-from-currency">
              <SelectValue placeholder="From Currency (All)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Currencies</SelectItem>
              {currencies.filter(c => c.isActive).map(currency => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.code} - {currency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <Select value={toCurrency} onValueChange={setToCurrency}>
            <SelectTrigger data-testid="select-to-currency">
              <SelectValue placeholder="To Currency (All)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Currencies</SelectItem>
              {currencies.filter(c => c.isActive).map(currency => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.code} - {currency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={exportToCSV}
          variant="outline"
          disabled={rates.length === 0}
          data-testid="button-export-csv"
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading exchange rates...
        </div>
      ) : rates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No exchange rates found. Add currencies and refresh rates to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((rate, index) => (
              <TableRow key={`${rate.fromCurrencyCode}-${rate.toCurrencyCode}-${rate.effectiveDate}-${index}`}>
                <TableCell>
                  {new Date(rate.effectiveDate).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-medium">{rate.fromCurrencyCode}</TableCell>
                <TableCell className="font-medium">{rate.toCurrencyCode}</TableCell>
                <TableCell className="text-right font-mono">
                  {parseFloat(rate.rate).toFixed(6)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {rate.source || 'api'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {rate.source === 'manual' ? (
                    <Badge variant="default">Manual</Badge>
                  ) : (
                    <Badge variant="outline">Auto</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <p className="text-sm text-muted-foreground">
        Showing {rates.length} exchange rate records
      </p>
    </div>
  );
}
