/**
 * Cash Flow Statement Page
 * Displays cash flows from operating, investing, and financing activities
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown,
  ChevronRight,
  ChevronDown,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import { Progress } from '@/shared/components/ui/progress';
import { ReportHeader } from '@/components/reports/report-header';
import { ReportFilters } from '@/components/reports/report-filters';
import { ReportExport } from '@/components/reports/report-export';
import { apiRequest } from '@/shared/lib/api/queryClient';
import { useTenant } from '@/shared/hooks/useTenant';
import Decimal from 'decimal.js';

interface CashFlowSection {
  name: string;
  items: Array<{
    description: string;
    amount: string;
    isInflow: boolean;
  }>;
  subtotal: string;
}

interface CashFlowStatement {
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
  operatingActivities: {
    netIncome: string;
    adjustments: CashFlowSection;
    workingCapitalChanges: CashFlowSection;
    netCashFromOperating: string;
  };
  investingActivities: {
    items: CashFlowSection;
    netCashFromInvesting: string;
  };
  financingActivities: {
    items: CashFlowSection;
    netCashFromFinancing: string;
  };
  summary: {
    beginningCash: string;
    netChangeInCash: string;
    endingCash: string;
  };
}

export default function CashFlowPage() {
  const { selectedTenant } = useTenant();
  const [filters, setFilters] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['operating', 'investing', 'financing'])
  );

  // Fetch report data
  const { data: report, isLoading, error, refetch } = useQuery<CashFlowStatement>({
    queryKey: ['/api/reports/cash-flow', filters],
    queryFn: async () => {
      if (!filters) return null;
      
      const params = new URLSearchParams({
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString()
      });

      return apiRequest('GET', `/api/reports/cash-flow?${params.toString()}`);
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
      format
    });

    const response = await fetch(`/api/reports/cash-flow/export?${params.toString()}`, {
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
    a.download = `cash-flow-${format === 'xlsx' ? 'xlsx' : format}`;
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

  const formatCurrency = (amount: string | number, showSign: boolean = false) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: report?.metadata.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(value));
    
    if (showSign && value !== 0) {
      return value > 0 ? `+${formatted}` : `-${formatted}`;
    }
    return formatted;
  };

  const renderCashFlowSection = (section: CashFlowSection) => {
    return (
      <div className="pl-6 space-y-1">
        {section.items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between py-1.5 px-4 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <div className="flex items-center gap-2">
              {item.isInflow ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className="text-sm text-gray-900 dark:text-white">
                {item.description}
              </span>
            </div>
            <span className={`text-sm tabular-nums ${
              item.isInflow ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(item.amount, true)}
            </span>
          </div>
        ))}
        {section.items.length > 0 && (
          <div className="flex items-center justify-between py-1.5 px-4 border-t">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Subtotal
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(section.subtotal)}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Calculate cash flow breakdown percentages
  const getActivityPercentage = (activity: string, total: string) => {
    const activityAmount = Math.abs(parseFloat(activity));
    const totalAmount = Math.abs(parseFloat(total));
    if (totalAmount === 0) return 0;
    return Math.round((activityAmount / totalAmount) * 100);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Cash Flow Statement
        </h1>
      </div>

      {/* Filters */}
      <ReportFilters
        filterType="dateRange"
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
            Failed to load cash flow statement. Please try again.
          </AlertDescription>
        </Alert>
      ) : report ? (
        <>
          {/* Report Header */}
          <ReportHeader
            companyName={report.metadata.companyName}
            reportTitle="Cash Flow Statement"
            dateRange={{
              startDate: new Date(report.metadata.dateRange.startDate),
              endDate: new Date(report.metadata.dateRange.endDate)
            }}
            currency={report.metadata.currency}
          />

          {/* Export Buttons */}
          <div className="flex justify-end">
            <ReportExport
              reportType="cash-flow"
              reportData={report}
              filters={filters}
              onExport={handleExport}
            />
          </div>

          {/* Cash Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Beginning Cash
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(report.summary.beginningCash)}
                  </span>
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Net Change in Cash
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${
                    parseFloat(report.summary.netChangeInCash) >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {formatCurrency(report.summary.netChangeInCash, true)}
                  </span>
                  {parseFloat(report.summary.netChangeInCash) >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Ending Cash
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(report.summary.endingCash)}
                  </span>
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cash Flow Details */}
          <Card className="print:shadow-none">
            <CardContent className="p-0">
              {/* Operating Activities */}
              <Collapsible
                open={expandedSections.has('operating')}
                onOpenChange={() => toggleSection('operating')}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b">
                    <div className="flex items-center gap-2">
                      {expandedSections.has('operating') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Operating Activities
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={parseFloat(report.operatingActivities.netCashFromOperating) >= 0 ? 'default' : 'destructive'}>
                        {parseFloat(report.operatingActivities.netCashFromOperating) >= 0 ? 'Positive' : 'Negative'}
                      </Badge>
                      <span className="font-bold text-lg text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(report.operatingActivities.netCashFromOperating)}
                      </span>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pl-6 py-2">
                    {/* Net Income */}
                    <div className="flex items-center justify-between py-1.5 px-4">
                      <span className="text-sm text-gray-900 dark:text-white">
                        Net Income
                      </span>
                      <span className="text-sm text-gray-900 dark:text-white tabular-nums">
                        {formatCurrency(report.operatingActivities.netIncome)}
                      </span>
                    </div>
                    
                    {/* Adjustments */}
                    {report.operatingActivities.adjustments && (
                      <>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 px-4 py-2">
                          Adjustments to reconcile net income to cash:
                        </div>
                        {renderCashFlowSection(report.operatingActivities.adjustments)}
                      </>
                    )}
                    
                    {/* Working Capital Changes */}
                    {report.operatingActivities.workingCapitalChanges && (
                      <>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 px-4 py-2 mt-2">
                          Changes in working capital:
                        </div>
                        {renderCashFlowSection(report.operatingActivities.workingCapitalChanges)}
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Investing Activities */}
              <Collapsible
                open={expandedSections.has('investing')}
                onOpenChange={() => toggleSection('investing')}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b">
                    <div className="flex items-center gap-2">
                      {expandedSections.has('investing') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Investing Activities
                      </span>
                    </div>
                    <span className="font-bold text-lg text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(report.investingActivities.netCashFromInvesting)}
                    </span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {report.investingActivities.items && 
                    renderCashFlowSection(report.investingActivities.items)}
                </CollapsibleContent>
              </Collapsible>

              {/* Financing Activities */}
              <Collapsible
                open={expandedSections.has('financing')}
                onOpenChange={() => toggleSection('financing')}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b">
                    <div className="flex items-center gap-2">
                      {expandedSections.has('financing') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Financing Activities
                      </span>
                    </div>
                    <span className="font-bold text-lg text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(report.financingActivities.netCashFromFinancing)}
                    </span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {report.financingActivities.items && 
                    renderCashFlowSection(report.financingActivities.items)}
                </CollapsibleContent>
              </Collapsible>

              {/* Total Change in Cash */}
              <div className="flex items-center justify-between py-3 px-4 bg-primary/5">
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  Net Change in Cash
                </span>
                <span className={`font-bold text-xl tabular-nums ${
                  parseFloat(report.summary.netChangeInCash) >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {formatCurrency(report.summary.netChangeInCash, true)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Cash Flow Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cash Flow Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Operating Activities</span>
                  <span className="font-medium">
                    {getActivityPercentage(
                      report.operatingActivities.netCashFromOperating,
                      report.summary.netChangeInCash
                    )}%
                  </span>
                </div>
                <Progress 
                  value={getActivityPercentage(
                    report.operatingActivities.netCashFromOperating,
                    report.summary.netChangeInCash
                  )} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Investing Activities</span>
                  <span className="font-medium">
                    {getActivityPercentage(
                      report.investingActivities.netCashFromInvesting,
                      report.summary.netChangeInCash
                    )}%
                  </span>
                </div>
                <Progress 
                  value={getActivityPercentage(
                    report.investingActivities.netCashFromInvesting,
                    report.summary.netChangeInCash
                  )} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Financing Activities</span>
                  <span className="font-medium">
                    {getActivityPercentage(
                      report.financingActivities.netCashFromFinancing,
                      report.summary.netChangeInCash
                    )}%
                  </span>
                </div>
                <Progress 
                  value={getActivityPercentage(
                    report.financingActivities.netCashFromFinancing,
                    report.summary.netChangeInCash
                  )} 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Select date range and click "Generate Report" to view the Cash Flow Statement
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}