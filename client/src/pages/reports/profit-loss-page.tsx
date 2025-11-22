/**
 * Profit & Loss Statement Page
 * Displays income statement with revenues, expenses, and net income
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { ReportHeader } from '@/components/reports/report-header';
import { ReportFilters } from '@/components/reports/report-filters';
import { ReportExport } from '@/components/reports/report-export';
import { apiRequest } from '@/lib/queryClient';
import { useTenant } from '@/shared/hooks/useTenant';
import { format } from 'date-fns';
import Decimal from 'decimal.js';

interface ProfitLossStatement {
  metadata: {
    reportName: string;
    companyName: string;
    dateRange: {
      startDate: string;
      endDate: string;
    };
    currency: string;
    generatedAt: string;
  };
  revenue: {
    name: string;
    items: Array<{
      accountCode: string;
      accountName: string;
      amount: string;
      previousPeriodAmount?: string;
      variance?: string;
      variancePercentage?: string;
    }>;
    subtotal: string;
  };
  costOfGoodsSold?: {
    name: string;
    items: Array<any>;
    subtotal: string;
  };
  grossProfit?: string;
  operatingExpenses: {
    name: string;
    items: Array<any>;
    subtotal: string;
  };
  operatingIncome: string;
  otherIncome?: {
    name: string;
    items: Array<any>;
    subtotal: string;
  };
  otherExpenses?: {
    name: string;
    items: Array<any>;
    subtotal: string;
  };
  incomeBeforeTax: string;
  taxExpense?: string;
  netIncome: string;
  previousPeriod?: any;
  variance?: any;
}

export default function ProfitLossPage() {
  const { selectedTenant } = useTenant();
  const [filters, setFilters] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['revenue', 'expenses'])
  );

  // Fetch report data
  const { data: report, isLoading, error, refetch } = useQuery<ProfitLossStatement>({
    queryKey: ['/api/reports/profit-loss', filters],
    queryFn: async () => {
      if (!filters) return null;
      
      const params = new URLSearchParams({
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString(),
        ...(filters.compareWith && { compareWith: filters.compareWith })
      });

      return apiRequest('GET', `/api/reports/profit-loss?${params.toString()}`);
    },
    enabled: !!filters && !!selectedTenant
  });

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'json' | 'pdf') => {
    if (!filters) return;
    
    const params = new URLSearchParams({
      startDate: filters.startDate.toISOString(),
      endDate: filters.endDate.toISOString(),
      ...(filters.compareWith && { compareWith: filters.compareWith }),
      format
    });

    const response = await fetch(`/api/reports/profit-loss/export?${params.toString()}`, {
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
    a.download = `profit-loss-${format === 'xlsx' ? 'xlsx' : format}`;
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

  const renderVariance = (variance?: string, percentage?: string) => {
    if (!variance || !percentage) return null;
    
    const value = parseFloat(variance);
    const isPositive = value >= 0;
    
    return (
      <div className="flex items-center gap-1">
        {isPositive ? (
          <TrendingUp className="h-3 w-3 text-green-600" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-600" />
        )}
        <span className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {percentage}%
        </span>
      </div>
    );
  };

  const renderSection = (section: any, sectionKey: string) => {
    if (!section) return null;

    return (
      <Collapsible
        open={expandedSections.has(sectionKey)}
        onOpenChange={() => toggleSection(sectionKey)}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between py-2 px-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
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
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(section.subtotal)}
            </span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pl-6">
            {section.items.map((item: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between py-1.5 px-4 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {item.accountCode}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {item.accountName}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {renderVariance(item.variance, item.variancePercentage)}
                  <span className="text-sm text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Profit & Loss Statement
        </h1>
      </div>

      {/* Filters */}
      <ReportFilters
        filterType="dateRange"
        onFiltersChange={handleFiltersChange}
        onRefresh={() => refetch()}
        isLoading={isLoading}
        showComparison={true}
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
            Failed to load profit & loss statement. Please try again.
          </AlertDescription>
        </Alert>
      ) : report ? (
        <>
          {/* Report Header */}
          <ReportHeader
            companyName={report.metadata.companyName}
            reportTitle="Profit & Loss Statement"
            dateRange={{
              startDate: new Date(report.metadata.dateRange.startDate),
              endDate: new Date(report.metadata.dateRange.endDate)
            }}
            currency={report.metadata.currency}
          />

          {/* Export Buttons */}
          <div className="flex justify-end">
            <ReportExport
              reportType="profit-loss"
              reportData={report}
              filters={filters}
              onExport={handleExport}
            />
          </div>

          {/* Report Body */}
          <Card className="print:shadow-none">
            <CardContent className="p-0">
              {/* Revenue Section */}
              {renderSection(report.revenue, 'revenue')}

              {/* COGS Section */}
              {report.costOfGoodsSold && (
                <>
                  <Separator />
                  {renderSection(report.costOfGoodsSold, 'cogs')}
                </>
              )}

              {/* Gross Profit */}
              {report.grossProfit && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between py-2 px-4 bg-gray-50 dark:bg-gray-800">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Gross Profit
                    </span>
                    <span className="font-bold text-lg text-gray-900 dark:text-white">
                      {formatCurrency(report.grossProfit)}
                    </span>
                  </div>
                </>
              )}

              {/* Operating Expenses */}
              <Separator />
              {renderSection(report.operatingExpenses, 'expenses')}

              {/* Operating Income */}
              <Separator />
              <div className="flex items-center justify-between py-2 px-4 bg-gray-50 dark:bg-gray-800">
                <span className="font-semibold text-gray-900 dark:text-white">
                  Operating Income
                </span>
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  {formatCurrency(report.operatingIncome)}
                </span>
              </div>

              {/* Other Income */}
              {report.otherIncome && (
                <>
                  <Separator />
                  {renderSection(report.otherIncome, 'otherIncome')}
                </>
              )}

              {/* Other Expenses */}
              {report.otherExpenses && (
                <>
                  <Separator />
                  {renderSection(report.otherExpenses, 'otherExpenses')}
                </>
              )}

              {/* Income Before Tax */}
              <Separator />
              <div className="flex items-center justify-between py-2 px-4">
                <span className="font-semibold text-gray-900 dark:text-white">
                  Income Before Tax
                </span>
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  {formatCurrency(report.incomeBeforeTax)}
                </span>
              </div>

              {/* Tax Expense */}
              {report.taxExpense && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between py-2 px-4">
                    <span className="text-gray-900 dark:text-white">Tax Expense</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency(report.taxExpense)}
                    </span>
                  </div>
                </>
              )}

              {/* Net Income */}
              <Separator />
              <div className="flex items-center justify-between py-3 px-4 bg-primary/5">
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  Net Income
                </span>
                <div className="flex items-center gap-4">
                  {report.variance?.netIncomeVariance && (
                    <Badge
                      variant={
                        parseFloat(report.netIncome) >= 0 ? 'default' : 'destructive'
                      }
                    >
                      {report.variance.netIncomeVariancePercentage}% vs last period
                    </Badge>
                  )}
                  <span className="font-bold text-xl text-gray-900 dark:text-white">
                    {formatCurrency(report.netIncome)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Select date range and click "Generate Report" to view the Profit & Loss Statement
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}