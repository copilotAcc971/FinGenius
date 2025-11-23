/**
 * Balance Sheet Page
 * Displays assets, liabilities, and equity with balance validation
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  AlertCircle 
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import { ReportHeader } from '@/components/reports/report-header';
import { ReportFilters } from '@/components/reports/report-filters';
import { ReportExport } from '@/components/reports/report-export';
import { AccountDrillDown } from '@/components/reports/account-drill-down';
import { apiRequest } from '@/shared/lib/api/queryClient';
import { useTenant } from '@/shared/hooks/useTenant';
import Decimal from 'decimal.js';

interface BalanceSheetReport {
  metadata: {
    reportName: string;
    companyName: string;
    asOfDate: string;
    currency: string;
    generatedAt: string;
  };
  assets: {
    current: {
      name: string;
      items: Array<{
        accountCode: string;
        accountName: string;
        amount: string;
      }>;
      subtotal: string;
    };
    nonCurrent: {
      name: string;
      items: Array<any>;
      subtotal: string;
    };
    totalAssets: string;
  };
  liabilities: {
    current: {
      name: string;
      items: Array<any>;
      subtotal: string;
    };
    nonCurrent: {
      name: string;
      items: Array<any>;
      subtotal: string;
    };
    totalLiabilities: string;
  };
  equity: {
    items: {
      name: string;
      items: Array<any>;
      subtotal: string;
    };
    retainedEarnings: string;
    totalEquity: string;
  };
  validation: {
    isBalanced: boolean;
    totalAssets: string;
    totalLiabilitiesAndEquity: string;
    difference: string;
  };
}

export default function BalanceSheetPage() {
  const { selectedTenant } = useTenant();
  const [filters, setFilters] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['currentAssets', 'currentLiabilities', 'equity'])
  );
  const [drillDownAccount, setDrillDownAccount] = useState<any>(null);

  // Fetch report data
  const { data: report, isLoading, error, refetch } = useQuery<BalanceSheetReport>({
    queryKey: ['/api/reports/balance-sheet', filters],
    queryFn: async () => {
      if (!filters) return null;
      
      const params = new URLSearchParams({
        asOfDate: filters.asOfDate.toISOString()
      });

      return apiRequest('GET', `/api/reports/balance-sheet?${params.toString()}`);
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

    const response = await fetch(`/api/reports/balance-sheet/export?${params.toString()}`, {
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
    a.download = `balance-sheet-${format === 'xlsx' ? 'xlsx' : format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatCurrency = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: report?.metadata.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const renderAccountSection = (section: any, sectionKey: string, level: number = 0) => {
    if (!section) return null;

    const paddingLeft = level * 24;

    return (
      <Collapsible
        open={expandedSections.has(sectionKey)}
        onOpenChange={() => toggleSection(sectionKey)}
      >
        <CollapsibleTrigger asChild>
          <div 
            className="flex items-center justify-between py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            style={{ paddingLeft: `${paddingLeft + 16}px`, paddingRight: '16px' }}
          >
            <div className="flex items-center gap-2">
              {expandedSections.has(sectionKey) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="font-semibold text-gray-900 dark:text-white">
                {section.name}
              </span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(section.subtotal)}
            </span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {section.items.map((item: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              style={{ paddingLeft: `${paddingLeft + 40}px`, paddingRight: '16px' }}
              onClick={() => setDrillDownAccount({
                accountId: item.accountId,
                accountName: item.accountName,
                accountCode: item.accountCode
              })}
              data-testid={`account-${item.accountCode}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                  {item.accountCode}
                </span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {item.accountName}
                </span>
              </div>
              <span className="text-sm text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Balance Sheet
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
            Failed to load balance sheet. Please try again.
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
              <AlertDescription>
                {report.validation.isBalanced ? (
                  <span>
                    Balance sheet is balanced. Total Assets ({formatCurrency(report.validation.totalAssets)}) = 
                    Total Liabilities + Equity ({formatCurrency(report.validation.totalLiabilitiesAndEquity)})
                  </span>
                ) : (
                  <span>
                    Balance sheet is NOT balanced! Difference: {formatCurrency(report.validation.difference)}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Report Header */}
          <ReportHeader
            companyName={report.metadata.companyName}
            reportTitle="Balance Sheet"
            asOfDate={new Date(report.metadata.asOfDate)}
            currency={report.metadata.currency}
          />

          {/* Export Buttons */}
          <div className="flex justify-end">
            <ReportExport
              reportType="balance-sheet"
              reportData={report}
              filters={filters}
              onExport={handleExport}
            />
          </div>

          {/* Report Body */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assets Side */}
            <Card className="print:shadow-none">
              <CardHeader className="bg-gray-50 dark:bg-gray-800">
                <CardTitle className="text-lg">ASSETS</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Current Assets */}
                {renderAccountSection(report.assets.current, 'currentAssets')}
                
                <Separator />
                
                {/* Non-Current Assets */}
                {renderAccountSection(report.assets.nonCurrent, 'nonCurrentAssets')}
                
                <Separator />
                
                {/* Total Assets */}
                <div className="flex items-center justify-between py-3 px-4 bg-primary/5">
                  <span className="font-bold text-gray-900 dark:text-white">
                    TOTAL ASSETS
                  </span>
                  <span className="font-bold text-lg text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(report.assets.totalAssets)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Liabilities & Equity Side */}
            <Card className="print:shadow-none">
              <CardHeader className="bg-gray-50 dark:bg-gray-800">
                <CardTitle className="text-lg">LIABILITIES & EQUITY</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Current Liabilities */}
                {renderAccountSection(report.liabilities.current, 'currentLiabilities')}
                
                <Separator />
                
                {/* Non-Current Liabilities */}
                {renderAccountSection(report.liabilities.nonCurrent, 'nonCurrentLiabilities')}
                
                <Separator />
                
                {/* Total Liabilities */}
                <div className="flex items-center justify-between py-2 px-4 bg-gray-50 dark:bg-gray-800">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Total Liabilities
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(report.liabilities.totalLiabilities)}
                  </span>
                </div>
                
                <Separator />
                
                {/* Equity */}
                {renderAccountSection(report.equity.items, 'equity')}
                
                {/* Retained Earnings */}
                <div className="flex items-center justify-between py-1.5 px-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-2 pl-10">
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      3900
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      Retained Earnings
                    </span>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(report.equity.retainedEarnings)}
                  </span>
                </div>
                
                <Separator />
                
                {/* Total Equity */}
                <div className="flex items-center justify-between py-2 px-4 bg-gray-50 dark:bg-gray-800">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Total Equity
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(report.equity.totalEquity)}
                  </span>
                </div>
                
                <Separator />
                
                {/* Total Liabilities & Equity */}
                <div className="flex items-center justify-between py-3 px-4 bg-primary/5">
                  <span className="font-bold text-gray-900 dark:text-white">
                    TOTAL LIABILITIES & EQUITY
                  </span>
                  <span className="font-bold text-lg text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(report.validation.totalLiabilitiesAndEquity)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Select a date and click "Generate Report" to view the Balance Sheet
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