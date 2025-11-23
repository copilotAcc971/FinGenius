/**
 * Trial Balance Page
 * Displays all accounts with debit/credit balances and balance validation
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/shared/components/ui/table';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Search,
  ExternalLink,
  AlertCircle 
} from 'lucide-react';
import { ReportHeader } from '@/components/reports/report-header';
import { ReportFilters } from '@/components/reports/report-filters';
import { ReportExport } from '@/components/reports/report-export';
import { AccountDrillDown } from '@/components/reports/account-drill-down';
import { apiRequest } from '@/shared/lib/api/queryClient';
import { useTenant } from '@/shared/hooks/useTenant';
import Decimal from 'decimal.js';

interface TrialBalanceAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  openingBalance: {
    debit: string | null;
    credit: string | null;
  };
  periodActivity: {
    debit: string | null;
    credit: string | null;
  };
  closingBalance: {
    debit: string | null;
    credit: string | null;
  };
}

interface TrialBalanceReport {
  metadata: {
    reportName: string;
    companyName: string;
    asOfDate: string;
    currency: string;
    generatedAt: string;
  };
  accounts: TrialBalanceAccount[];
  totals: {
    openingBalance: {
      debit: string;
      credit: string;
    };
    periodActivity: {
      debit: string;
      credit: string;
    };
    closingBalance: {
      debit: string;
      credit: string;
    };
  };
  validation: {
    isBalanced: boolean;
    debitTotal: string;
    creditTotal: string;
    difference: string;
  };
}

export default function TrialBalancePage() {
  const { selectedTenant } = useTenant();
  const [filters, setFilters] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [drillDownAccount, setDrillDownAccount] = useState<any>(null);

  // Fetch report data
  const { data: report, isLoading, error, refetch } = useQuery<TrialBalanceReport>({
    queryKey: ['/api/reports/trial-balance', filters],
    queryFn: async () => {
      if (!filters) return null;
      
      const params = new URLSearchParams({
        asOfDate: filters.asOfDate.toISOString()
      });

      return apiRequest('GET', `/api/reports/trial-balance?${params.toString()}`);
    },
    enabled: !!filters && !!selectedTenant
  });

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'json' | 'pdf') => {
    if (!filters) return;
    
    const params = new URLSearchParams({
      asOfDate: filters.asOfDate.toISOString(),
      format
    });

    const response = await fetch(`/api/reports/trial-balance/export?${params.toString()}`, {
      headers: {
        'x-tenant-id': selectedTenant?.id || ''
      }
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trial-balance-${format === 'xlsx' ? 'xlsx' : format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return '-';
    const value = parseFloat(amount);
    if (value === 0) return '-';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: report?.metadata.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(value));
  };

  // Filter accounts based on search
  const filteredAccounts = report?.accounts.filter(account => 
    account.accountCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.accountName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleAccountClick = (account: TrialBalanceAccount) => {
    setDrillDownAccount({
      accountId: account.accountId,
      accountName: account.accountName,
      accountCode: account.accountCode
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Trial Balance
        </h1>
      </div>

      {/* Filters */}
      <ReportFilters
        filterType="asOfDate"
        onFiltersChange={handleFiltersChange}
        onRefresh={() => refetch()}
        isLoading={isLoading}
      />

      {/* Report Content */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load trial balance. Please try again.
          </AlertDescription>
        </Alert>
      ) : report ? (
        <>
          {/* Balance Validation Alert */}
          {report.validation && (
            <Alert variant={report.validation.isBalanced ? 'default' : 'destructive'}>
              {report.validation.isBalanced ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription className="flex items-center justify-between">
                <div>
                  {report.validation.isBalanced ? (
                    <span>
                      Trial Balance is balanced. Total Debits = Total Credits = {formatCurrency(report.validation.debitTotal)}
                    </span>
                  ) : (
                    <span className="font-semibold">
                      Trial Balance is NOT balanced! Difference: {formatCurrency(report.validation.difference)}
                    </span>
                  )}
                </div>
                {!report.validation.isBalanced && (
                  <Badge variant="destructive">
                    IMBALANCED
                  </Badge>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Report Header */}
          <ReportHeader
            companyName={report.metadata.companyName}
            reportTitle="Trial Balance"
            asOfDate={new Date(report.metadata.asOfDate)}
            currency={report.metadata.currency}
          />

          {/* Actions Bar */}
          <div className="flex justify-between items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <Input
                type="text"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-accounts"
              />
            </div>

            {/* Export Buttons */}
            <ReportExport
              reportType="trial-balance"
              reportData={report}
              filters={filters}
              onExport={handleExport}
            />
          </div>

          {/* Trial Balance Table */}
          <Card className="print:shadow-none">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                      <TableHead rowSpan={2} className="text-left sticky left-0 bg-gray-50 dark:bg-gray-800 z-10">
                        Account Code
                      </TableHead>
                      <TableHead rowSpan={2} className="text-left">
                        Account Name
                      </TableHead>
                      <TableHead colSpan={2} className="text-center border-l">
                        Opening Balance
                      </TableHead>
                      <TableHead colSpan={2} className="text-center border-l">
                        Period Activity
                      </TableHead>
                      <TableHead colSpan={2} className="text-center border-l">
                        Closing Balance
                      </TableHead>
                      <TableHead rowSpan={2} className="w-[50px]"></TableHead>
                    </TableRow>
                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                      <TableHead className="text-right border-l">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right border-l">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right border-l">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500 dark:text-gray-400">
                          {searchTerm ? 'No accounts match your search' : 'No accounts found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {filteredAccounts.map((account) => (
                          <TableRow 
                            key={account.accountId}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <TableCell className="font-mono text-sm sticky left-0 bg-white dark:bg-gray-900 z-10">
                              {account.accountCode}
                            </TableCell>
                            <TableCell className="text-sm">
                              {account.accountName}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm border-l">
                              {formatCurrency(account.openingBalance.debit)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(account.openingBalance.credit)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm border-l">
                              {formatCurrency(account.periodActivity.debit)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(account.periodActivity.credit)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm border-l font-semibold">
                              {formatCurrency(account.closingBalance.debit)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold">
                              {formatCurrency(account.closingBalance.credit)}
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={() => handleAccountClick(account)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                data-testid={`button-drill-down-${account.accountCode}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}

                        {/* Totals Row */}
                        <TableRow className="font-bold border-t-2 bg-gray-50 dark:bg-gray-800">
                          <TableCell colSpan={2} className="sticky left-0 bg-gray-50 dark:bg-gray-800 z-10">
                            TOTAL
                          </TableCell>
                          <TableCell className="text-right font-mono border-l">
                            {formatCurrency(report.totals.openingBalance.debit)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(report.totals.openingBalance.credit)}
                          </TableCell>
                          <TableCell className="text-right font-mono border-l">
                            {formatCurrency(report.totals.periodActivity.debit)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(report.totals.periodActivity.credit)}
                          </TableCell>
                          <TableCell className="text-right font-mono border-l bg-primary/5">
                            {formatCurrency(report.totals.closingBalance.debit)}
                          </TableCell>
                          <TableCell className="text-right font-mono bg-primary/5">
                            {formatCurrency(report.totals.closingBalance.credit)}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Select a date and click "Generate Report" to view the Trial Balance
            </p>
          </CardContent>
        </Card>
      )}

      {/* Account Drill-Down Modal */}
      {drillDownAccount && (
        <AccountDrillDown
          isOpen={!!drillDownAccount}
          onClose={() => setDrillDownAccount(null)}
          accountId={drillDownAccount.accountId}
          accountName={drillDownAccount.accountName}
          accountCode={drillDownAccount.accountCode}
          endDate={filters?.asOfDate}
          tenantId={selectedTenant?.id || ''}
        />
      )}
    </div>
  );
}