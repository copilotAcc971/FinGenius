import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar as CalendarIcon, TrendingUp, DollarSign, FileBarChart, Activity, Download, ChevronDown, ChevronRight, ArrowUp, ArrowDown, FileSpreadsheet, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { format } from "date-fns";
import { type Currency } from "@shared/schema";
import { formatCurrency } from "@/shared/lib/utils/currency-utils";
import {
  DateRangePreset,
  ComparisonMode,
  dateRangePresetOptions,
  comparisonModeOptions,
  getPeriodComparison
} from "@/shared/lib/utils/date-range-presets";
import { downloadCSV, downloadExcel, formatPercentage } from "@/shared/lib/exports/reportExports";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface ProfitLossResponse {
  revenue: Array<{ accountName: string; amount: number }>;
  expenses: Array<{ accountName: string; amount: number }>;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  baseCurrency: string;
  ifrsComplianceEnabled: boolean;
  fxTranslationStandard: string | null;
  incomeExpenseMethod: string;
  fxTranslationApplied: boolean;
}

interface AccountComparison {
  accountId: string;
  accountCode: string;
  accountName: string;
  currentAmount: number;
  previousAmount: number;
  variance: number;
  percentageChange: number | "Infinity" | "-Infinity";
  isFavorable: boolean;
}

interface ProfitLossComparisonResponse {
  current: {
    startDate: Date;
    endDate: Date;
    revenue: AccountComparison[];
    expenses: AccountComparison[];
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    grossProfitMargin: number;
    netProfitMargin: number;
  };
  previous: {
    startDate: Date;
    endDate: Date;
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    grossProfitMargin: number;
    netProfitMargin: number;
  };
  variances: {
    revenue: { amount: number; percentage: number | "Infinity" | "-Infinity"; isFavorable: boolean };
    expenses: { amount: number; percentage: number | "Infinity" | "-Infinity"; isFavorable: boolean };
    netProfit: { amount: number; percentage: number | "Infinity" | "-Infinity"; isFavorable: boolean };
    grossProfitMargin: number;
    netProfitMargin: number;
  };
  baseCurrency: string;
  ifrsComplianceEnabled: boolean;
  fxTranslationStandard: string | null;
  incomeExpenseMethod: string | null;
  fxTranslationApplied: boolean;
}

interface BalanceSheetResponse {
  assets: Array<{ accountName: string; amount: number }>;
  liabilities: Array<{ accountName: string; amount: number }>;
  equity: Array<{ accountName: string; amount: number }>;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  baseCurrency: string;
  ifrsComplianceEnabled: boolean;
  fxTranslationStandard: string | null;
  translationMethod: string;
  fxTranslationApplied: boolean;
}

interface BalanceSheetAccountLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountCategory: string;
  currentAmount: string;
  comparisonAmount?: string;
  variance?: string;
  variancePercentage?: number | "Infinity" | "-Infinity";
}

interface BalanceSheetCategory {
  category: string;
  accounts: BalanceSheetAccountLine[];
  subtotal: string;
  comparisonSubtotal?: string;
  variance?: string;
  variancePercentage?: number | "Infinity" | "-Infinity";
}

interface EnhancedBalanceSheetResponse {
  tenantId: string;
  asOfDate: string;
  comparisonDate?: string;
  assetCategories: BalanceSheetCategory[];
  liabilityCategories: BalanceSheetCategory[];
  equityCategories: BalanceSheetCategory[];
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  comparisonTotalAssets?: string;
  comparisonTotalLiabilities?: string;
  comparisonTotalEquity?: string;
  assetVariance?: string;
  assetVariancePercentage?: number | "Infinity" | "-Infinity";
  liabilityVariance?: string;
  liabilityVariancePercentage?: number | "Infinity" | "-Infinity";
  equityVariance?: string;
  equityVariancePercentage?: number | "Infinity" | "-Infinity";
  isBalanced: boolean;
  comparisonIsBalanced?: boolean;
  baseCurrency: string;
  ifrsComplianceEnabled: boolean;
  fxTranslationStandard: string | null;
  translationMethod?: string;
  fxTranslationApplied: boolean;
}

interface TrialBalanceReport {
  tenantId: string;
  asOfDate: string;
  comparisonDate?: string;
  accounts: Array<{ 
    accountId: string;
    accountName: string; 
    accountCode: string; 
    accountType: string;
    debit: number; 
    credit: number;
    comparisonDebit?: number;
    comparisonCredit?: number;
    varianceDebit?: number;
    varianceCredit?: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  comparisonTotalDebits?: number;
  comparisonTotalCredits?: number;
  comparisonIsBalanced?: boolean;
  totalDebitsVariance?: number;
  totalCreditsVariance?: number;
  baseCurrency?: string;
  ifrsComplianceEnabled?: boolean;
  fxTranslationStandard?: string | null;
  translationMethod?: string;
  fxTranslationApplied?: boolean;
}

interface EnhancedCashFlowReport {
  tenantId: string;
  startDate: string;
  endDate: string;
  operating: Array<{ activity: string; amount: number }>;
  netOperating: number;
  investing: Array<{ activity: string; amount: number }>;
  netInvesting: number;
  financing: Array<{ activity: string; amount: number }>;
  netFinancing: number;
  netCashFlow: number;
  comparisonStartDate?: string;
  comparisonEndDate?: string;
  comparisonData?: {
    operating: Array<{ activity: string; amount: number }>;
    netOperating: number;
    investing: Array<{ activity: string; amount: number }>;
    netInvesting: number;
    financing: Array<{ activity: string; amount: number }>;
    netFinancing: number;
    netCashFlow: number;
  };
  operatingVariance?: number;
  investingVariance?: number;
  financingVariance?: number;
  netVariance?: number;
  baseCurrency?: string;
  ifrsComplianceEnabled?: boolean;
  fxTranslationStandard?: string | null;
  translationMethod?: string;
  fxTranslationApplied?: boolean;
}

interface EquityComponentLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountCategory: string;
  openingBalance: string;
  netProfitLoss: string;
  dividends: string;
  shareCapitalChanges: string;
  otherComprehensiveIncome: string;
  otherMovements: string;
  closingBalance: string;
  comparisonOpeningBalance?: string;
  comparisonNetProfitLoss?: string;
  comparisonDividends?: string;
  comparisonShareCapitalChanges?: string;
  comparisonOtherComprehensiveIncome?: string;
  comparisonOtherMovements?: string;
  comparisonClosingBalance?: string;
  openingBalanceVariance?: string;
  netProfitLossVariance?: string;
  dividendsVariance?: string;
  shareCapitalChangesVariance?: string;
  otherComprehensiveIncomeVariance?: string;
  otherMovementsVariance?: string;
  closingBalanceVariance?: string;
  closingBalanceVariancePercentage?: number | "Infinity" | "-Infinity";
}

interface EquityStatementCategory {
  category: string;
  components: EquityComponentLine[];
  subtotalOpeningBalance: string;
  subtotalNetProfitLoss: string;
  subtotalDividends: string;
  subtotalShareCapitalChanges: string;
  subtotalOtherComprehensiveIncome: string;
  subtotalOtherMovements: string;
  subtotalClosingBalance: string;
  comparisonSubtotalOpeningBalance?: string;
  comparisonSubtotalNetProfitLoss?: string;
  comparisonSubtotalDividends?: string;
  comparisonSubtotalShareCapitalChanges?: string;
  comparisonSubtotalOtherComprehensiveIncome?: string;
  comparisonSubtotalOtherMovements?: string;
  comparisonSubtotalClosingBalance?: string;
  closingBalanceVariance?: string;
  closingBalanceVariancePercentage?: number | "Infinity" | "-Infinity";
}

interface EquityStatementReport {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  comparisonStartDate?: Date;
  comparisonEndDate?: Date;
  equityCategories: EquityStatementCategory[];
  totalOpeningBalance: string;
  totalNetProfitLoss: string;
  totalDividends: string;
  totalShareCapitalChanges: string;
  totalOtherComprehensiveIncome: string;
  totalOtherMovements: string;
  totalClosingBalance: string;
  comparisonTotalOpeningBalance?: string;
  comparisonTotalNetProfitLoss?: string;
  comparisonTotalDividends?: string;
  comparisonTotalShareCapitalChanges?: string;
  comparisonTotalOtherComprehensiveIncome?: string;
  comparisonTotalOtherMovements?: string;
  comparisonTotalClosingBalance?: string;
  closingBalanceVariance?: string;
  closingBalanceVariancePercentage?: number | "Infinity" | "-Infinity";
  reconcilesWithBalanceSheet: boolean;
  comparisonReconcilesWithBalanceSheet?: boolean;
  baseCurrency: string;
  ifrsComplianceEnabled: boolean;
  fxTranslationStandard: string | null;
  fxTranslationApplied: boolean;
}

function FxDisclosure({ 
  standard, 
  method, 
  baseCurrency, 
  applied 
}: { 
  standard: string; 
  method?: string; 
  baseCurrency: string; 
  applied: boolean;
}) {
  const standardLabel = standard === "full-ifrs" ? "Full IFRS (IAS 21)" : "IFRS for SMEs (Section 30)";
  const methodLabel = method === "average-rate" ? "Average Rate" : "Transaction Date Rate";

  return (
    <div className="text-xs text-muted-foreground space-y-1 mt-2 p-3 bg-muted/50 rounded-md" data-testid="fx-disclosure">
      <p className="font-medium">
        {applied ? "Foreign Currency Translation Applied" : "IFRS Compliance Enabled"}
      </p>
      <p>Standard: {standardLabel}</p>
      {method && <p>Income/Expense Method: {methodLabel}</p>}
      <p>Presentation Currency: {baseCurrency}</p>
      {!applied && (
        <p className="text-xs italic mt-2">
          Note: FX translation is configured but not yet applied. 
          Translation will be active once multi-currency transactions are recorded.
        </p>
      )}
      {applied && (
        <p className="text-xs italic mt-2">
          Note: Exchange difference tracking requires historical balance data. 
          Differences will be displayed once multi-currency transactions are fully integrated.
        </p>
      )}
    </div>
  );
}

function renderVariancePercentage(acc: AccountComparison) {
  if (acc.percentageChange === "Infinity") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span 
              className={`cursor-help ${acc.isFavorable ? 'text-green-600' : 'text-red-600'}`}
              data-testid="variance-infinity"
            >
              ∞%
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Previous period was $0</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (acc.percentageChange === "-Infinity") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span 
              className={`cursor-help ${acc.isFavorable ? 'text-green-600' : 'text-red-600'}`}
              data-testid="variance-negative-infinity"
            >
              −∞%
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Previous period was $0</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (typeof acc.percentageChange === "number") {
    return (
      <span className={acc.isFavorable ? 'text-green-600' : 'text-red-600'}>
        {acc.percentageChange.toFixed(1)}%
      </span>
    );
  }

  return <span className="text-muted-foreground">N/A</span>;
}

function renderBSVariancePercentage(variancePercentage?: number | "Infinity" | "-Infinity") {
  if (variancePercentage === "Infinity") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help text-muted-foreground" data-testid="variance-infinity">
              ∞%
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Previous period was $0</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variancePercentage === "-Infinity") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help text-muted-foreground" data-testid="variance-negative-infinity">
              −∞%
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Previous period was $0</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (typeof variancePercentage === "number") {
    return <span>{variancePercentage.toFixed(1)}%</span>;
  }

  return <span className="text-muted-foreground">N/A</span>;
}

function exportBalanceSheetCSV(
  report: EnhancedBalanceSheetResponse,
  baseCurrency: string,
  hasComparison: boolean
) {
  const rows: string[] = [];
  
  rows.push(hasComparison 
    ? `Balance Sheet Comparison,As of ${report.asOfDate},As of ${report.comparisonDate},Variance,Variance %`
    : `Balance Sheet,As of ${report.asOfDate}`
  );
  rows.push('');

  const formatVariancePercentage = (vp?: number | "Infinity" | "-Infinity") => {
    if (vp === undefined || vp === null) return "";
    if (vp === "Infinity") return "Infinity";
    if (vp === "-Infinity") return "-Infinity";
    return vp.toFixed(1) + "%";
  };

  const processCategories = (categories: BalanceSheetCategory[], sectionName: string) => {
    rows.push(sectionName);
    categories.forEach((category) => {
      if (hasComparison) {
        rows.push(`"${category.category}","${baseCurrency} ${category.subtotal}","${baseCurrency} ${category.comparisonSubtotal || '0.00'}","${baseCurrency} ${category.variance || '0.00'}","${formatVariancePercentage(category.variancePercentage)}"`);
      } else {
        rows.push(`"${category.category}","${baseCurrency} ${category.subtotal}"`);
      }
      
      category.accounts.forEach((account) => {
        if (hasComparison) {
          rows.push(`"  ${account.accountName}","${baseCurrency} ${account.currentAmount}","${baseCurrency} ${account.comparisonAmount || '0.00'}","${baseCurrency} ${account.variance || '0.00'}","${formatVariancePercentage(account.variancePercentage)}"`);
        } else {
          rows.push(`"  ${account.accountName}","${baseCurrency} ${account.currentAmount}"`);
        }
      });
    });
  };

  processCategories(report.assetCategories, 'ASSETS');
  if (hasComparison) {
    rows.push(`"Total Assets","${baseCurrency} ${report.totalAssets}","${baseCurrency} ${report.comparisonTotalAssets || '0.00'}","${baseCurrency} ${report.assetVariance || '0.00'}","${formatVariancePercentage(report.assetVariancePercentage)}"`);
  } else {
    rows.push(`"Total Assets","${baseCurrency} ${report.totalAssets}"`);
  }
  rows.push('');

  processCategories(report.liabilityCategories, 'LIABILITIES');
  if (hasComparison) {
    rows.push(`"Total Liabilities","${baseCurrency} ${report.totalLiabilities}","${baseCurrency} ${report.comparisonTotalLiabilities || '0.00'}","${baseCurrency} ${report.liabilityVariance || '0.00'}","${formatVariancePercentage(report.liabilityVariancePercentage)}"`);
  } else {
    rows.push(`"Total Liabilities","${baseCurrency} ${report.totalLiabilities}"`);
  }
  rows.push('');

  processCategories(report.equityCategories, 'EQUITY');
  if (hasComparison) {
    rows.push(`"Total Equity","${baseCurrency} ${report.totalEquity}","${baseCurrency} ${report.comparisonTotalEquity || '0.00'}","${baseCurrency} ${report.equityVariance || '0.00'}","${formatVariancePercentage(report.equityVariancePercentage)}"`);
  } else {
    rows.push(`"Total Equity","${baseCurrency} ${report.totalEquity}"`);
  }

  const csvContent = rows.join('\n');
  downloadCSV(csvContent, `balance-sheet-${report.asOfDate}.csv`);
}

function exportCashFlowCSV(
  report: EnhancedCashFlowReport,
  baseCurrency: string,
  hasComparison: boolean
) {
  const rows: string[] = [];
  
  if (hasComparison && report.comparisonData) {
    rows.push(`Cash Flow Statement,${report.startDate} to ${report.endDate},Comparison: ${report.comparisonStartDate} to ${report.comparisonEndDate},Variance`);
  } else {
    rows.push(`Cash Flow Statement,${report.startDate} to ${report.endDate}`);
  }
  rows.push('');
  
  rows.push('OPERATING ACTIVITIES');
  report.operating.forEach(activity => {
    if (hasComparison && report.comparisonData) {
      const compActivity = report.comparisonData.operating.find(a => a.activity === activity.activity);
      const variance = activity.amount - (compActivity?.amount || 0);
      rows.push(`"${activity.activity}","${baseCurrency} ${activity.amount.toFixed(2)}","${baseCurrency} ${(compActivity?.amount || 0).toFixed(2)}","${baseCurrency} ${variance.toFixed(2)}"`);
    } else {
      rows.push(`"${activity.activity}","${baseCurrency} ${activity.amount.toFixed(2)}"`);
    }
  });
  if (hasComparison && report.comparisonData) {
    rows.push(`"Net Cash from Operating","${baseCurrency} ${report.netOperating.toFixed(2)}","${baseCurrency} ${report.comparisonData.netOperating.toFixed(2)}","${baseCurrency} ${(report.operatingVariance || 0).toFixed(2)}"`);
  } else {
    rows.push(`"Net Cash from Operating","${baseCurrency} ${report.netOperating.toFixed(2)}"`);
  }
  rows.push('');
  
  rows.push('INVESTING ACTIVITIES');
  report.investing.forEach(activity => {
    if (hasComparison && report.comparisonData) {
      const compActivity = report.comparisonData.investing.find(a => a.activity === activity.activity);
      const variance = activity.amount - (compActivity?.amount || 0);
      rows.push(`"${activity.activity}","${baseCurrency} ${activity.amount.toFixed(2)}","${baseCurrency} ${(compActivity?.amount || 0).toFixed(2)}","${baseCurrency} ${variance.toFixed(2)}"`);
    } else {
      rows.push(`"${activity.activity}","${baseCurrency} ${activity.amount.toFixed(2)}"`);
    }
  });
  if (hasComparison && report.comparisonData) {
    rows.push(`"Net Cash from Investing","${baseCurrency} ${report.netInvesting.toFixed(2)}","${baseCurrency} ${report.comparisonData.netInvesting.toFixed(2)}","${baseCurrency} ${(report.investingVariance || 0).toFixed(2)}"`);
  } else {
    rows.push(`"Net Cash from Investing","${baseCurrency} ${report.netInvesting.toFixed(2)}"`);
  }
  rows.push('');
  
  rows.push('FINANCING ACTIVITIES');
  report.financing.forEach(activity => {
    if (hasComparison && report.comparisonData) {
      const compActivity = report.comparisonData.financing.find(a => a.activity === activity.activity);
      const variance = activity.amount - (compActivity?.amount || 0);
      rows.push(`"${activity.activity}","${baseCurrency} ${activity.amount.toFixed(2)}","${baseCurrency} ${(compActivity?.amount || 0).toFixed(2)}","${baseCurrency} ${variance.toFixed(2)}"`);
    } else {
      rows.push(`"${activity.activity}","${baseCurrency} ${activity.amount.toFixed(2)}"`);
    }
  });
  if (hasComparison && report.comparisonData) {
    rows.push(`"Net Cash from Financing","${baseCurrency} ${report.netFinancing.toFixed(2)}","${baseCurrency} ${report.comparisonData.netFinancing.toFixed(2)}","${baseCurrency} ${(report.financingVariance || 0).toFixed(2)}"`);
  } else {
    rows.push(`"Net Cash from Financing","${baseCurrency} ${report.netFinancing.toFixed(2)}"`);
  }
  rows.push('');
  
  if (hasComparison && report.comparisonData) {
    rows.push(`"NET CHANGE IN CASH","${baseCurrency} ${report.netCashFlow.toFixed(2)}","${baseCurrency} ${report.comparisonData.netCashFlow.toFixed(2)}","${baseCurrency} ${(report.netVariance || 0).toFixed(2)}"`);
  } else {
    rows.push(`"NET CHANGE IN CASH","${baseCurrency} ${report.netCashFlow.toFixed(2)}"`);
  }
  
  downloadCSV(rows.join('\n'), `cash-flow-${report.startDate}-${report.endDate}.csv`);
}

function exportTrialBalanceCSV(
  report: TrialBalanceReport,
  baseCurrency: string,
  asOfDate: string
) {
  const rows: string[] = [];
  const hasComparison = !!report.comparisonDate;
  
  if (hasComparison) {
    rows.push(`Trial Balance Comparison,Current: ${asOfDate},Comparison: ${report.comparisonDate}`);
    rows.push('');
    rows.push('Account Code,Account Name,Current Debit,Current Credit,Comparison Debit,Comparison Credit,Variance Debit,Variance Credit');
    
    report.accounts.forEach(account => {
      rows.push(`"${account.accountCode}","${account.accountName}","${baseCurrency} ${account.debit.toFixed(2)}","${baseCurrency} ${account.credit.toFixed(2)}","${baseCurrency} ${(account.comparisonDebit || 0).toFixed(2)}","${baseCurrency} ${(account.comparisonCredit || 0).toFixed(2)}","${baseCurrency} ${(account.varianceDebit || 0).toFixed(2)}","${baseCurrency} ${(account.varianceCredit || 0).toFixed(2)}"`);
    });
    
    rows.push('');
    rows.push(`"Total","","${baseCurrency} ${report.totalDebits.toFixed(2)}","${baseCurrency} ${report.totalCredits.toFixed(2)}","${baseCurrency} ${(report.comparisonTotalDebits || 0).toFixed(2)}","${baseCurrency} ${(report.comparisonTotalCredits || 0).toFixed(2)}","${baseCurrency} ${(report.totalDebitsVariance || 0).toFixed(2)}","${baseCurrency} ${(report.totalCreditsVariance || 0).toFixed(2)}"`);
  } else {
    rows.push(`Trial Balance,As of ${asOfDate}`);
    rows.push('');
    rows.push('Account Code,Account Name,Debit,Credit');
    
    report.accounts.forEach(account => {
      rows.push(`"${account.accountCode}","${account.accountName}","${baseCurrency} ${account.debit.toFixed(2)}","${baseCurrency} ${account.credit.toFixed(2)}"`);
    });
    
    rows.push('');
    rows.push(`"Total","","${baseCurrency} ${report.totalDebits.toFixed(2)}","${baseCurrency} ${report.totalCredits.toFixed(2)}"`);
  }
  
  rows.push(`"Balanced","${report.isBalanced ? 'Yes' : 'No'}"`);
  
  const filename = hasComparison 
    ? `trial-balance-comparison-${report.comparisonDate}-to-${asOfDate}.csv`
    : `trial-balance-${asOfDate}.csv`;
  
  downloadCSV(rows.join('\n'), filename);
}

function exportPLComparisonExcel(
  report: ProfitLossComparisonResponse,
  baseCurrency: string
) {
  const data: any[][] = [];
  
  data.push(['Profit & Loss Comparison', '', '', '', `Currency: ${baseCurrency}`]);
  data.push([`Current Period: ${new Date(report.current.startDate).toLocaleDateString()} to ${new Date(report.current.endDate).toLocaleDateString()}`]);
  data.push([`Previous Period: ${new Date(report.previous.startDate).toLocaleDateString()} to ${new Date(report.previous.endDate).toLocaleDateString()}`]);
  data.push([]);
  data.push(['Account', 'Current Period', 'Previous Period', '$ Variance', '% Variance']);
  
  data.push(['REVENUE']);
  report.current.revenue.forEach(acc => {
    data.push([
      acc.accountName,
      parseFloat(acc.currentAmount.toFixed(2)),
      parseFloat(acc.previousAmount.toFixed(2)),
      parseFloat(acc.variance.toFixed(2)),
      formatPercentage(acc.percentageChange)
    ]);
  });
  data.push([
    'Total Revenue',
    parseFloat(report.current.totalRevenue.toFixed(2)),
    parseFloat(report.previous.totalRevenue.toFixed(2)),
    parseFloat(report.variances.revenue.amount.toFixed(2)),
    formatPercentage(report.variances.revenue.percentage)
  ]);
  
  data.push([]);
  data.push(['EXPENSES']);
  report.current.expenses.forEach(acc => {
    data.push([
      acc.accountName,
      parseFloat(acc.currentAmount.toFixed(2)),
      parseFloat(acc.previousAmount.toFixed(2)),
      parseFloat(acc.variance.toFixed(2)),
      formatPercentage(acc.percentageChange)
    ]);
  });
  data.push([
    'Total Expenses',
    parseFloat(report.current.totalExpenses.toFixed(2)),
    parseFloat(report.previous.totalExpenses.toFixed(2)),
    parseFloat(report.variances.expenses.amount.toFixed(2)),
    formatPercentage(report.variances.expenses.percentage)
  ]);
  
  data.push([]);
  data.push([
    'NET PROFIT',
    parseFloat(report.current.netProfit.toFixed(2)),
    parseFloat(report.previous.netProfit.toFixed(2)),
    parseFloat(report.variances.netProfit.amount.toFixed(2)),
    formatPercentage(report.variances.netProfit.percentage)
  ]);
  
  downloadExcel(data, `PL-Comparison-${format(new Date(), 'yyyy-MM-dd')}.xlsx`, 'P&L Comparison');
}

function exportBalanceSheetExcel(
  report: EnhancedBalanceSheetResponse,
  baseCurrency: string,
  hasComparison: boolean
) {
  const data: any[][] = [];
  
  if (hasComparison) {
    data.push(['Balance Sheet Comparison', `As of ${report.asOfDate}`, `As of ${report.comparisonDate}`, 'Variance', 'Variance %', `Currency: ${baseCurrency}`]);
  } else {
    data.push(['Balance Sheet', `As of ${report.asOfDate}`, '', '', `Currency: ${baseCurrency}`]);
  }
  data.push([]);
  
  const processCategories = (categories: BalanceSheetCategory[], sectionName: string) => {
    data.push([sectionName]);
    categories.forEach((category) => {
      if (hasComparison) {
        data.push([
          category.category,
          parseFloat(category.subtotal),
          parseFloat(category.comparisonSubtotal || '0'),
          parseFloat(category.variance || '0'),
          formatPercentage(category.variancePercentage)
        ]);
      } else {
        data.push([category.category, parseFloat(category.subtotal)]);
      }
      
      category.accounts.forEach((account) => {
        if (hasComparison) {
          data.push([
            `  ${account.accountName}`,
            parseFloat(account.currentAmount),
            parseFloat(account.comparisonAmount || '0'),
            parseFloat(account.variance || '0'),
            formatPercentage(account.variancePercentage)
          ]);
        } else {
          data.push([`  ${account.accountName}`, parseFloat(account.currentAmount)]);
        }
      });
    });
  };
  
  processCategories(report.assetCategories, 'ASSETS');
  if (hasComparison) {
    data.push([
      'Total Assets',
      parseFloat(report.totalAssets),
      parseFloat(report.comparisonTotalAssets || '0'),
      parseFloat(report.assetVariance || '0'),
      formatPercentage(report.assetVariancePercentage)
    ]);
  } else {
    data.push(['Total Assets', parseFloat(report.totalAssets)]);
  }
  data.push([]);
  
  processCategories(report.liabilityCategories, 'LIABILITIES');
  if (hasComparison) {
    data.push([
      'Total Liabilities',
      parseFloat(report.totalLiabilities),
      parseFloat(report.comparisonTotalLiabilities || '0'),
      parseFloat(report.liabilityVariance || '0'),
      formatPercentage(report.liabilityVariancePercentage)
    ]);
  } else {
    data.push(['Total Liabilities', parseFloat(report.totalLiabilities)]);
  }
  data.push([]);
  
  processCategories(report.equityCategories, 'EQUITY');
  if (hasComparison) {
    data.push([
      'Total Equity',
      parseFloat(report.totalEquity),
      parseFloat(report.comparisonTotalEquity || '0'),
      parseFloat(report.equityVariance || '0'),
      formatPercentage(report.equityVariancePercentage)
    ]);
  } else {
    data.push(['Total Equity', parseFloat(report.totalEquity)]);
  }
  
  downloadExcel(data, `balance-sheet-${report.asOfDate}.xlsx`, 'Balance Sheet');
}

function exportCashFlowExcel(
  report: EnhancedCashFlowReport,
  baseCurrency: string,
  hasComparison: boolean
) {
  const data: any[][] = [];
  
  if (hasComparison && report.comparisonData) {
    data.push(['Cash Flow Statement', `${report.startDate} to ${report.endDate}`, `Comparison: ${report.comparisonStartDate} to ${report.comparisonEndDate}`, 'Variance', `Currency: ${baseCurrency}`]);
  } else {
    data.push(['Cash Flow Statement', `${report.startDate} to ${report.endDate}`, '', '', `Currency: ${baseCurrency}`]);
  }
  data.push([]);
  
  data.push(['OPERATING ACTIVITIES']);
  report.operating.forEach(activity => {
    if (hasComparison && report.comparisonData) {
      const compActivity = report.comparisonData.operating.find(a => a.activity === activity.activity);
      const variance = activity.amount - (compActivity?.amount || 0);
      data.push([activity.activity, parseFloat(activity.amount.toFixed(2)), parseFloat((compActivity?.amount || 0).toFixed(2)), parseFloat(variance.toFixed(2))]);
    } else {
      data.push([activity.activity, parseFloat(activity.amount.toFixed(2))]);
    }
  });
  if (hasComparison && report.comparisonData) {
    data.push(['Net Cash from Operating', parseFloat(report.netOperating.toFixed(2)), parseFloat(report.comparisonData.netOperating.toFixed(2)), parseFloat((report.operatingVariance || 0).toFixed(2))]);
  } else {
    data.push(['Net Cash from Operating', parseFloat(report.netOperating.toFixed(2))]);
  }
  data.push([]);
  
  data.push(['INVESTING ACTIVITIES']);
  report.investing.forEach(activity => {
    if (hasComparison && report.comparisonData) {
      const compActivity = report.comparisonData.investing.find(a => a.activity === activity.activity);
      const variance = activity.amount - (compActivity?.amount || 0);
      data.push([activity.activity, parseFloat(activity.amount.toFixed(2)), parseFloat((compActivity?.amount || 0).toFixed(2)), parseFloat(variance.toFixed(2))]);
    } else {
      data.push([activity.activity, parseFloat(activity.amount.toFixed(2))]);
    }
  });
  if (hasComparison && report.comparisonData) {
    data.push(['Net Cash from Investing', parseFloat(report.netInvesting.toFixed(2)), parseFloat(report.comparisonData.netInvesting.toFixed(2)), parseFloat((report.investingVariance || 0).toFixed(2))]);
  } else {
    data.push(['Net Cash from Investing', parseFloat(report.netInvesting.toFixed(2))]);
  }
  data.push([]);
  
  data.push(['FINANCING ACTIVITIES']);
  report.financing.forEach(activity => {
    if (hasComparison && report.comparisonData) {
      const compActivity = report.comparisonData.financing.find(a => a.activity === activity.activity);
      const variance = activity.amount - (compActivity?.amount || 0);
      data.push([activity.activity, parseFloat(activity.amount.toFixed(2)), parseFloat((compActivity?.amount || 0).toFixed(2)), parseFloat(variance.toFixed(2))]);
    } else {
      data.push([activity.activity, parseFloat(activity.amount.toFixed(2))]);
    }
  });
  if (hasComparison && report.comparisonData) {
    data.push(['Net Cash from Financing', parseFloat(report.netFinancing.toFixed(2)), parseFloat(report.comparisonData.netFinancing.toFixed(2)), parseFloat((report.financingVariance || 0).toFixed(2))]);
  } else {
    data.push(['Net Cash from Financing', parseFloat(report.netFinancing.toFixed(2))]);
  }
  data.push([]);
  
  if (hasComparison && report.comparisonData) {
    data.push(['NET CHANGE IN CASH', parseFloat(report.netCashFlow.toFixed(2)), parseFloat(report.comparisonData.netCashFlow.toFixed(2)), parseFloat((report.netVariance || 0).toFixed(2))]);
  } else {
    data.push(['NET CHANGE IN CASH', parseFloat(report.netCashFlow.toFixed(2))]);
  }
  
  downloadExcel(data, `cash-flow-${report.startDate}-${report.endDate}.xlsx`, 'Cash Flow');
}

function exportTrialBalanceExcel(
  report: TrialBalanceReport,
  baseCurrency: string,
  asOfDate: string
) {
  const data: any[][] = [];
  const hasComparison = !!report.comparisonDate;
  
  if (hasComparison) {
    data.push(['Trial Balance Comparison', `Current: ${asOfDate}`, `Comparison: ${report.comparisonDate}`, '', '', '', '', `Currency: ${baseCurrency}`]);
    data.push([]);
    data.push(['Account Code', 'Account Name', 'Current Debit', 'Current Credit', 'Comparison Debit', 'Comparison Credit', 'Variance Debit', 'Variance Credit']);
    
    report.accounts.forEach(account => {
      data.push([
        account.accountCode,
        account.accountName,
        parseFloat(account.debit.toFixed(2)),
        parseFloat(account.credit.toFixed(2)),
        parseFloat((account.comparisonDebit || 0).toFixed(2)),
        parseFloat((account.comparisonCredit || 0).toFixed(2)),
        parseFloat((account.varianceDebit || 0).toFixed(2)),
        parseFloat((account.varianceCredit || 0).toFixed(2))
      ]);
    });
    
    data.push([]);
    data.push([
      'Total',
      '',
      parseFloat(report.totalDebits.toFixed(2)),
      parseFloat(report.totalCredits.toFixed(2)),
      parseFloat((report.comparisonTotalDebits || 0).toFixed(2)),
      parseFloat((report.comparisonTotalCredits || 0).toFixed(2)),
      parseFloat((report.totalDebitsVariance || 0).toFixed(2)),
      parseFloat((report.totalCreditsVariance || 0).toFixed(2))
    ]);
  } else {
    data.push(['Trial Balance', `As of ${asOfDate}`, '', '', `Currency: ${baseCurrency}`]);
    data.push([]);
    data.push(['Account Code', 'Account Name', 'Debit', 'Credit']);
    
    report.accounts.forEach(account => {
      data.push([
        account.accountCode,
        account.accountName,
        parseFloat(account.debit.toFixed(2)),
        parseFloat(account.credit.toFixed(2))
      ]);
    });
    
    data.push([]);
    data.push(['Total', '', parseFloat(report.totalDebits.toFixed(2)), parseFloat(report.totalCredits.toFixed(2))]);
  }
  
  data.push(['Balanced', report.isBalanced ? 'Yes' : 'No']);
  
  const filename = hasComparison
    ? `trial-balance-comparison-${report.comparisonDate}-to-${asOfDate}.xlsx`
    : `trial-balance-${asOfDate}.xlsx`;
  
  downloadExcel(data, filename, 'Trial Balance');
}

export default function FinancialReports() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  // P&L Comparison states
  const [plPreset, setPlPreset] = useState<DateRangePreset>("this-month");
  const [plComparisonMode, setPlComparisonMode] = useState<ComparisonMode>("previous-period");
  const [plCustomStartDate, setPlCustomStartDate] = useState("");
  const [plCustomEndDate, setPlCustomEndDate] = useState("");
  const [plCustomPrevStartDate, setPlCustomPrevStartDate] = useState("");
  const [plCustomPrevEndDate, setPlCustomPrevEndDate] = useState("");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(true);

  // Date states for other reports
  const [bsAsOfDate, setBsAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bsComparisonDate, setBsComparisonDate] = useState("");
  const [bsShowComparison, setBsShowComparison] = useState(false);
  const [tbAsOfDate, setTbAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tbShowComparison, setTbShowComparison] = useState(false);
  const [tbComparisonDate, setTbComparisonDate] = useState(
    format(new Date(new Date().getFullYear() - 1, new Date().getMonth(), new Date().getDate()), "yyyy-MM-dd")
  );
  const [cfStartDate, setCfStartDate] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd")
  );
  const [cfEndDate, setCfEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cfShowComparison, setCfShowComparison] = useState(false);
  const [cfComparisonStartDate, setCfComparisonStartDate] = useState("");
  const [cfComparisonEndDate, setCfComparisonEndDate] = useState("");
  const [equityStartDate, setEquityStartDate] = useState(
    format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd")
  );
  const [equityEndDate, setEquityEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [equityShowComparison, setEquityShowComparison] = useState(false);
  const [equityComparisonStartDate, setEquityComparisonStartDate] = useState("");
  const [equityComparisonEndDate, setEquityComparisonEndDate] = useState("");
  const [expandedEquityCategories, setExpandedEquityCategories] = useState<Set<string>>(new Set());

  // Control when to fetch reports
  const [fetchPLComparison, setFetchPLComparison] = useState(false);
  const [fetchBS, setFetchBS] = useState(false);
  const [fetchTB, setFetchTB] = useState(false);
  const [fetchCF, setFetchCF] = useState(false);
  const [fetchEquity, setFetchEquity] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  // Calculate date ranges based on preset
  const plPeriods = getPeriodComparison(
    plPreset,
    plComparisonMode,
    plCustomStartDate,
    plCustomEndDate,
    plCustomPrevStartDate,
    plCustomPrevEndDate
  );

  // Profit & Loss Comparison Query
  const { data: plComparisonData, isLoading: plComparisonLoading } = useQuery<ProfitLossComparisonResponse>({
    queryKey: [
      "/api/reports/profit-loss-comparison",
      {
        tenantId: currentTenant?.id,
        startDate: plPeriods.current.startDate,
        endDate: plPeriods.current.endDate,
        prevStartDate: plPeriods.previous.startDate,
        prevEndDate: plPeriods.previous.endDate
      }
    ],
    enabled: !!currentTenant?.id && fetchPLComparison && showComparison,
  });

  // Balance Sheet Query
  const { data: balanceSheetData, isLoading: bsLoading } = useQuery<EnhancedBalanceSheetResponse>({
    queryKey: ["/api/reports/balance-sheet", { 
      tenantId: currentTenant?.id, 
      asOfDate: bsAsOfDate,
      ...(bsShowComparison && bsComparisonDate ? { comparisonDate: bsComparisonDate } : {})
    }],
    enabled: !!currentTenant?.id && fetchBS,
  });

  // Trial Balance Query
  const { data: tbReport, isLoading: tbLoading } = useQuery<TrialBalanceReport>({
    queryKey: ["/api/reports/trial-balance", { 
      tenantId: currentTenant?.id, 
      asOfDate: tbAsOfDate,
      ...(tbShowComparison && tbComparisonDate ? { comparisonDate: tbComparisonDate } : {})
    }],
    enabled: !!currentTenant?.id && fetchTB,
  });

  // Cash Flow Query - Enhanced with Comparison
  const { data: cfReport, isLoading: cfLoading } = useQuery<EnhancedCashFlowReport>({
    queryKey: ["/api/reports/cash-flow", { 
      tenantId: currentTenant?.id, 
      startDate: cfStartDate, 
      endDate: cfEndDate,
      enhanced: 'true',
      ...(cfShowComparison && cfComparisonStartDate && cfComparisonEndDate 
        ? { comparisonStartDate: cfComparisonStartDate, comparisonEndDate: cfComparisonEndDate } 
        : {})
    }],
    enabled: !!currentTenant?.id && fetchCF,
  });

  // Equity Statement Query - IAS 1.106-110 Compliance
  const { data: equityReport, isLoading: equityLoading } = useQuery<EquityStatementReport>({
    queryKey: ["/api/reports/equity-statement", { 
      tenantId: currentTenant?.id, 
      startDate: equityStartDate, 
      endDate: equityEndDate,
      ...(equityShowComparison && equityComparisonStartDate && equityComparisonEndDate 
        ? { comparisonStartDate: equityComparisonStartDate, comparisonEndDate: equityComparisonEndDate } 
        : {})
    }],
    enabled: !!currentTenant?.id && fetchEquity,
  });

  // Currency query for formatting
  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['/api/currencies', { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  // Going concern status query
  const { data: goingConcernStatus } = useQuery<{status: string; assessmentDate: Date | null; reviewedBy: string | null}>({
    queryKey: ['/api/going-concern-status', currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const baseCurrency = currencies.find(c => c.isBaseCurrency);
  const showGoingConcernWarning = goingConcernStatus && 
    goingConcernStatus.status !== 'positive' && 
    goingConcernStatus.status !== null;

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">Please select or create an organization to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Financial Reports</h1>
          <p className="text-muted-foreground">Comprehensive financial insights with visualizations</p>
        </div>
        <div className="flex items-center gap-2">
          {showGoingConcernWarning && (
            <Badge variant="destructive" data-testid={`badge-going-concern-${goingConcernStatus.status}`}>
              <AlertTriangle className="w-3 h-3 mr-1" />
              Going Concern {goingConcernStatus.status === 'uncertainty' ? 'Uncertainty' : 'Doubt'}
            </Badge>
          )}
          <Link href="/reports/financial-statement-notes">
            <Button variant="outline" size="sm" data-testid="button-view-notes">
              <FileText className="w-4 h-4 mr-2" />
              View Notes
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="profit-loss" className="space-y-6" data-testid="tabs-financial-reports">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto" data-testid="tabs-list-reports">
          <TabsTrigger value="profit-loss" data-testid="tab-profit-loss">
            <TrendingUp className="h-4 w-4 mr-2" />
            P&L
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" data-testid="tab-balance-sheet">
            <DollarSign className="h-4 w-4 mr-2" />
            Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="equity-statement" data-testid="tab-equity-statement">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Equity Statement
          </TabsTrigger>
          <TabsTrigger value="trial-balance" data-testid="tab-trial-balance">
            <FileBarChart className="h-4 w-4 mr-2" />
            Trial Balance
          </TabsTrigger>
          <TabsTrigger value="cash-flow" data-testid="tab-cash-flow">
            <Activity className="h-4 w-4 mr-2" />
            Cash Flow
          </TabsTrigger>
        </TabsList>

        {/* Profit & Loss Tab - Enhanced with Period Comparison */}
        <TabsContent value="profit-loss" className="space-y-6" data-testid="content-profit-loss">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Comparative Profit & Loss Statement</CardTitle>
                  <CardDescription>Period-over-period comparison with variance analysis</CardDescription>
                </div>
                {plComparisonData && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const formatPct = (value: number | "Infinity" | "-Infinity") => {
                          if (value === "Infinity") return "Infinity";
                          if (value === "-Infinity") return "-Infinity";
                          if (typeof value === "number") return value.toFixed(1) + "%";
                          return "";
                        };
                        
                        const headers = ["Account", "Current Period", "Previous Period", "$ Variance", "% Variance"];
                        const rows: string[][] = [];
                        
                        rows.push(["REVENUE", "", "", "", ""]);
                        plComparisonData.current.revenue.forEach(acc => {
                          rows.push([
                            acc.accountName,
                            acc.currentAmount.toString(),
                            acc.previousAmount.toString(),
                            acc.variance.toString(),
                            formatPct(acc.percentageChange)
                          ]);
                        });
                        rows.push(["Total Revenue", plComparisonData.current.totalRevenue.toString(), plComparisonData.previous.totalRevenue.toString(), plComparisonData.variances.revenue.amount.toString(), formatPct(plComparisonData.variances.revenue.percentage)]);
                        
                        rows.push(["", "", "", "", ""]);
                        rows.push(["EXPENSES", "", "", "", ""]);
                        plComparisonData.current.expenses.forEach(acc => {
                          rows.push([
                            acc.accountName,
                            acc.currentAmount.toString(),
                            acc.previousAmount.toString(),
                            acc.variance.toString(),
                            formatPct(acc.percentageChange)
                          ]);
                        });
                        rows.push(["Total Expenses", plComparisonData.current.totalExpenses.toString(), plComparisonData.previous.totalExpenses.toString(), plComparisonData.variances.expenses.amount.toString(), formatPct(plComparisonData.variances.expenses.percentage)]);
                        
                        rows.push(["", "", "", "", ""]);
                        rows.push(["NET PROFIT", plComparisonData.current.netProfit.toString(), plComparisonData.previous.netProfit.toString(), plComparisonData.variances.netProfit.amount.toString(), formatPct(plComparisonData.variances.netProfit.percentage)]);
                        
                        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                        downloadCSV(csv, `PL-Comparison-${format(new Date(), "yyyy-MM-dd")}.csv`);
                      }}
                      data-testid="button-export-csv"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportPLComparisonExcel(plComparisonData, baseCurrency?.code || "USD")}
                      data-testid="button-export-excel"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Period</label>
                  <Select value={plPreset} onValueChange={(v) => setPlPreset(v as DateRangePreset)} data-testid="select-pl-preset">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dateRangePresetOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Compare to</label>
                  <Select value={plComparisonMode} onValueChange={(v) => setPlComparisonMode(v as ComparisonMode)} data-testid="select-comparison-mode">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {comparisonModeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 flex items-end">
                  <Button
                    onClick={() => setFetchPLComparison(true)}
                    className="w-full"
                    data-testid="button-generate-pl-comparison"
                  >
                    Generate Comparison Report
                  </Button>
                </div>
              </div>
              
              {plPreset === "custom" && (
                <div className="grid gap-4 md:grid-cols-4 pt-2 border-t">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Current Start</label>
                    <input
                      type="date"
                      value={plCustomStartDate}
                      onChange={(e) => setPlCustomStartDate(e.target.value)}
                      className="w-full h-10 px-3 py-2 border rounded-md"
                      data-testid="input-custom-start"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Current End</label>
                    <input
                      type="date"
                      value={plCustomEndDate}
                      onChange={(e) => setPlCustomEndDate(e.target.value)}
                      className="w-full h-10 px-3 py-2 border rounded-md"
                      data-testid="input-custom-end"
                    />
                  </div>
                  {plComparisonMode === "custom" && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Previous Start</label>
                        <input
                          type="date"
                          value={plCustomPrevStartDate}
                          onChange={(e) => setPlCustomPrevStartDate(e.target.value)}
                          className="w-full h-10 px-3 py-2 border rounded-md"
                          data-testid="input-custom-prev-start"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Previous End</label>
                        <input
                          type="date"
                          value={plCustomPrevEndDate}
                          onChange={(e) => setPlCustomPrevEndDate(e.target.value)}
                          className="w-full h-10 px-3 py-2 border rounded-md"
                          data-testid="input-custom-prev-end"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              
              {fetchPLComparison && (
                <div className="flex items-center justify-between py-2 px-4 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Comparing:</span>
                    <span className="text-muted-foreground">{plPeriods.current.label}</span>
                    <span className="text-muted-foreground">vs</span>
                    <span className="text-muted-foreground">{plPeriods.previous.label}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {plComparisonLoading && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-32 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Skeleton className="h-96 w-full" />
            </div>
          )}

          {!fetchPLComparison && !plComparisonData && !plComparisonLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Report Generated</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Select a period and click "Generate Comparison Report" to view the P&L statement
                </p>
              </CardContent>
            </Card>
          )}

          {plComparisonData && !plComparisonLoading && (
            <>
              {/* Key Metrics Summary Cards */}
              <div className="grid gap-6 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-current-revenue">
                      {formatCurrency(plComparisonData.current.totalRevenue, baseCurrency?.code || "USD", currencies)}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <span className="text-muted-foreground">
                        vs {formatCurrency(plComparisonData.previous.totalRevenue, baseCurrency?.code || "USD", currencies)}
                      </span>
                      {plComparisonData.variances.revenue.percentage === "Infinity" ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`flex items-center gap-1 font-medium cursor-help ${plComparisonData.variances.revenue.isFavorable ? 'text-green-600' : 'text-red-600'}`}>
                                <ArrowUp className="h-3 w-3" />
                                ∞%
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Previous period was $0</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : plComparisonData.variances.revenue.percentage === "-Infinity" ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`flex items-center gap-1 font-medium cursor-help ${plComparisonData.variances.revenue.isFavorable ? 'text-green-600' : 'text-red-600'}`}>
                                <ArrowDown className="h-3 w-3" />
                                −∞%
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Previous period was $0</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : typeof plComparisonData.variances.revenue.percentage === "number" ? (
                        <span className={`flex items-center gap-1 font-medium ${plComparisonData.variances.revenue.isFavorable ? 'text-green-600' : 'text-red-600'}`}>
                          {plComparisonData.variances.revenue.isFavorable ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {Math.abs(plComparisonData.variances.revenue.percentage).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-medium">N/A</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-current-expenses">
                      {formatCurrency(plComparisonData.current.totalExpenses, baseCurrency?.code || "USD", currencies)}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <span className="text-muted-foreground">
                        vs {formatCurrency(plComparisonData.previous.totalExpenses, baseCurrency?.code || "USD", currencies)}
                      </span>
                      {plComparisonData.variances.expenses.percentage === "Infinity" ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`flex items-center gap-1 font-medium cursor-help ${plComparisonData.variances.expenses.isFavorable ? 'text-green-600' : 'text-red-600'}`}>
                                <ArrowUp className="h-3 w-3" />
                                ∞%
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Previous period was $0</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : plComparisonData.variances.expenses.percentage === "-Infinity" ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`flex items-center gap-1 font-medium cursor-help ${plComparisonData.variances.expenses.isFavorable ? 'text-green-600' : 'text-red-600'}`}>
                                <ArrowDown className="h-3 w-3" />
                                −∞%
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Previous period was $0</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : typeof plComparisonData.variances.expenses.percentage === "number" ? (
                        <span className={`flex items-center gap-1 font-medium ${plComparisonData.variances.expenses.isFavorable ? 'text-green-600' : 'text-red-600'}`}>
                          {plComparisonData.variances.expenses.isFavorable ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                          {Math.abs(plComparisonData.variances.expenses.percentage).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-medium">N/A</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Gross Profit Margin</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-current-gpm">
                      {plComparisonData.current.grossProfitMargin.toFixed(1)}%
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <span className="text-muted-foreground">
                        vs {plComparisonData.previous.grossProfitMargin.toFixed(1)}%
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${plComparisonData.variances.grossProfitMargin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {plComparisonData.variances.grossProfitMargin > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(plComparisonData.variances.grossProfitMargin).toFixed(1)}pp
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Net Profit Margin</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-current-npm">
                      {plComparisonData.current.netProfitMargin.toFixed(1)}%
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <span className="text-muted-foreground">
                        vs {plComparisonData.previous.netProfitMargin.toFixed(1)}%
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${plComparisonData.variances.netProfitMargin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {plComparisonData.variances.netProfitMargin > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(plComparisonData.variances.netProfitMargin).toFixed(1)}pp
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Comparative P&L Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Comparative Statement</CardTitle>
                  <CardDescription>Detailed period-over-period comparison with variance analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table data-testid="table-pl-comparison">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Account</TableHead>
                        <TableHead className="text-right">Current Period</TableHead>
                        <TableHead className="text-right">Previous Period</TableHead>
                        <TableHead className="text-right">$ Variance</TableHead>
                        <TableHead className="text-right">% Variance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Revenue Section */}
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={5} className="font-semibold text-sm uppercase tracking-wide">
                          Revenue
                        </TableCell>
                      </TableRow>
                      {plComparisonData.current.revenue.map((acc, idx) => (
                        <TableRow 
                          key={acc.accountId}
                          className="hover-elevate cursor-pointer"
                          data-testid={`row-revenue-${idx}`}
                        >
                          <TableCell className="pl-6">{acc.accountName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(acc.currentAmount, baseCurrency?.code || "USD", currencies)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {formatCurrency(acc.previousAmount, baseCurrency?.code || "USD", currencies)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(acc.variance, baseCurrency?.code || "USD", currencies)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {renderVariancePercentage(acc)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold border-t-2">
                        <TableCell className="pl-6">Total Revenue</TableCell>
                        <TableCell className="text-right font-mono" data-testid="cell-total-current-revenue">
                          {formatCurrency(plComparisonData.current.totalRevenue, baseCurrency?.code || "USD", currencies)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatCurrency(plComparisonData.previous.totalRevenue, baseCurrency?.code || "USD", currencies)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(plComparisonData.variances.revenue.amount, baseCurrency?.code || "USD", currencies)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {plComparisonData.variances.revenue.percentage === "Infinity" ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`cursor-help ${plComparisonData.variances.revenue.isFavorable ? 'text-green-600' : 'text-red-600'}`}>
                                    ∞%
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Previous period was $0</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : plComparisonData.variances.revenue.percentage === "-Infinity" ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`cursor-help ${plComparisonData.variances.revenue.isFavorable ? 'text-green-600' : 'text-red-600'}`}>
                                    −∞%
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Previous period was $0</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : typeof plComparisonData.variances.revenue.percentage === "number" ? (
                            <span className={plComparisonData.variances.revenue.isFavorable ? 'text-green-600' : 'text-red-600'}>
                              {plComparisonData.variances.revenue.percentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expenses Section */}
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={5} className="font-semibold text-sm uppercase tracking-wide">
                          Expenses
                        </TableCell>
                      </TableRow>
                      {plComparisonData.current.expenses.map((acc, idx) => (
                        <TableRow 
                          key={acc.accountId}
                          className="hover-elevate cursor-pointer"
                          data-testid={`row-expense-${idx}`}
                        >
                          <TableCell className="pl-6">{acc.accountName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(acc.currentAmount, baseCurrency?.code || "USD", currencies)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {formatCurrency(acc.previousAmount, baseCurrency?.code || "USD", currencies)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(acc.variance, baseCurrency?.code || "USD", currencies)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {renderVariancePercentage(acc)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold border-t-2">
                        <TableCell className="pl-6">Total Expenses</TableCell>
                        <TableCell className="text-right font-mono" data-testid="cell-total-current-expenses">
                          {formatCurrency(plComparisonData.current.totalExpenses, baseCurrency?.code || "USD", currencies)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatCurrency(plComparisonData.previous.totalExpenses, baseCurrency?.code || "USD", currencies)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(plComparisonData.variances.expenses.amount, baseCurrency?.code || "USD", currencies)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {plComparisonData.variances.expenses.percentage === "Infinity" ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`cursor-help ${plComparisonData.variances.expenses.isFavorable ? 'text-green-600' : 'text-red-600'}`}>
                                    ∞%
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Previous period was $0</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : plComparisonData.variances.expenses.percentage === "-Infinity" ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`cursor-help ${plComparisonData.variances.expenses.isFavorable ? 'text-green-600' : 'text-red-600'}`}>
                                    −∞%
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Previous period was $0</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : typeof plComparisonData.variances.expenses.percentage === "number" ? (
                            <span className={plComparisonData.variances.expenses.isFavorable ? 'text-green-600' : 'text-red-600'}>
                              {plComparisonData.variances.expenses.percentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Net Profit */}
                      <TableRow className="font-bold text-base border-t-4 bg-muted/50">
                        <TableCell>Net Profit</TableCell>
                        <TableCell className="text-right font-mono" data-testid="cell-total-current-net-profit">
                          {formatCurrency(plComparisonData.current.netProfit, baseCurrency?.code || "USD", currencies)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatCurrency(plComparisonData.previous.netProfit, baseCurrency?.code || "USD", currencies)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(plComparisonData.variances.netProfit.amount, baseCurrency?.code || "USD", currencies)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {plComparisonData.variances.netProfit.percentage === "Infinity" ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`cursor-help ${plComparisonData.variances.netProfit.isFavorable ? 'text-green-600' : 'text-red-600'}`}>
                                    ∞%
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Previous period was $0</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : plComparisonData.variances.netProfit.percentage === "-Infinity" ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`cursor-help ${plComparisonData.variances.netProfit.isFavorable ? 'text-green-600' : 'text-red-600'}`}>
                                    −∞%
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Previous period was $0</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : typeof plComparisonData.variances.netProfit.percentage === "number" ? (
                            <span className={plComparisonData.variances.netProfit.isFavorable ? 'text-green-600' : 'text-red-600'}>
                              {plComparisonData.variances.netProfit.percentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Advanced Charts */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Period Comparison Chart</CardTitle>
                    <CardDescription>Current vs Previous Period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart
                        data={[
                          {
                            category: 'Revenue',
                            current: plComparisonData.current.totalRevenue,
                            previous: plComparisonData.previous.totalRevenue
                          },
                          {
                            category: 'Expenses',
                            current: plComparisonData.current.totalExpenses,
                            previous: plComparisonData.previous.totalExpenses
                          },
                          {
                            category: 'Net Profit',
                            current: plComparisonData.current.netProfit,
                            previous: plComparisonData.previous.netProfit
                          }
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="current" fill="hsl(var(--chart-1))" name="Current Period" />
                        <Bar dataKey="previous" fill="hsl(var(--chart-2))" name="Previous Period" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Expense Breakdown</CardTitle>
                    <CardDescription>Current Period Distribution</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={plComparisonData.current.expenses.map((exp) => ({
                            name: exp.accountName,
                            value: exp.currentAmount
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${((entry.value / plComparisonData.current.totalExpenses) * 100).toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {plComparisonData.current.expenses.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => formatCurrency(value, baseCurrency?.code || "USD", currencies)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {plComparisonData.ifrsComplianceEnabled && (
                <FxDisclosure
                  standard={plComparisonData.fxTranslationStandard!}
                  method={plComparisonData.incomeExpenseMethod || ""}
                  baseCurrency={plComparisonData.baseCurrency}
                  applied={plComparisonData.fxTranslationApplied}
                />
              )}
            </>
          )}
        </TabsContent>

        {/* Balance Sheet Tab */}
        <TabsContent value="balance-sheet" className="space-y-6" data-testid="content-balance-sheet">
          <Card>
            <CardHeader>
              <CardTitle>Balance Sheet</CardTitle>
              <CardDescription>Financial position as of a specific date with optional period comparison</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">As of Date</label>
                  <input
                    type="date"
                    value={bsAsOfDate}
                    onChange={(e) => setBsAsOfDate(e.target.value)}
                    className="w-full h-10 px-3 py-2 border rounded-md"
                    data-testid="input-bs-as-of-date"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="checkbox"
                      id="bs-show-comparison"
                      checked={bsShowComparison}
                      onChange={(e) => setBsShowComparison(e.target.checked)}
                      data-testid="checkbox-bs-show-comparison"
                    />
                    <label htmlFor="bs-show-comparison" className="text-sm font-medium">
                      Compare with
                    </label>
                  </div>
                  <input
                    type="date"
                    value={bsComparisonDate}
                    onChange={(e) => setBsComparisonDate(e.target.value)}
                    disabled={!bsShowComparison}
                    className="w-full h-10 px-3 py-2 border rounded-md disabled:opacity-50"
                    data-testid="input-bs-comparison-date"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => setFetchBS(true)}
                    className="w-full"
                    data-testid="button-generate-bs"
                  >
                    Generate Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {bsLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {balanceSheetData && !bsLoading && (
            <>
              <div className="flex justify-end">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportBalanceSheetCSV(balanceSheetData, baseCurrency?.code || "USD", bsShowComparison && !!bsComparisonDate)}
                    data-testid="button-export-bs-csv"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportBalanceSheetExcel(balanceSheetData, baseCurrency?.code || "USD", bsShowComparison && !!bsComparisonDate)}
                    data-testid="button-export-bs-excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Balance Sheet Detail</CardTitle>
                  <CardDescription>As of {balanceSheetData.asOfDate}{bsShowComparison && balanceSheetData.comparisonDate ? ` vs ${balanceSheetData.comparisonDate}` : ''}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40%]">Account</TableHead>
                          <TableHead className="text-right">Current</TableHead>
                          {bsShowComparison && balanceSheetData.comparisonDate && (
                            <>
                              <TableHead className="text-right">Previous</TableHead>
                              <TableHead className="text-right">Variance</TableHead>
                              <TableHead className="text-right">Variance %</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={bsShowComparison && balanceSheetData.comparisonDate ? 5 : 2} className="font-bold">
                            ASSETS
                          </TableCell>
                        </TableRow>
                        {balanceSheetData.assetCategories.map((category, catIdx) => (
                          <>
                            <TableRow key={`asset-cat-${catIdx}`} className="bg-muted/10">
                              <TableCell className="font-semibold pl-4">{category.category}</TableCell>
                              <TableCell className="text-right font-semibold font-mono">
                                {formatCurrency(category.subtotal, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                              {bsShowComparison && balanceSheetData.comparisonDate && (
                                <>
                                  <TableCell className="text-right font-semibold font-mono">
                                    {formatCurrency(category.comparisonSubtotal || 0, baseCurrency?.code || "USD", currencies)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold font-mono">
                                    {formatCurrency(category.variance || 0, baseCurrency?.code || "USD", currencies)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {renderBSVariancePercentage(category.variancePercentage)}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                            {category.accounts.map((account, accIdx) => (
                              <TableRow key={`asset-acc-${catIdx}-${accIdx}`} data-testid={`row-asset-${catIdx}-${accIdx}`}>
                                <TableCell className="pl-8 text-sm">{account.accountName}</TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {formatCurrency(account.currentAmount, baseCurrency?.code || "USD", currencies)}
                                </TableCell>
                                {bsShowComparison && balanceSheetData.comparisonDate && (
                                  <>
                                    <TableCell className="text-right font-mono text-sm">
                                      {formatCurrency(account.comparisonAmount || 0, baseCurrency?.code || "USD", currencies)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {formatCurrency(account.variance || 0, baseCurrency?.code || "USD", currencies)}
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {renderBSVariancePercentage(account.variancePercentage)}
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            ))}
                          </>
                        ))}
                        <TableRow className="font-bold bg-muted/20">
                          <TableCell>Total Assets</TableCell>
                          <TableCell className="text-right font-mono" data-testid="cell-total-assets">
                            {formatCurrency(balanceSheetData.totalAssets, baseCurrency?.code || "USD", currencies)}
                          </TableCell>
                          {bsShowComparison && balanceSheetData.comparisonDate && (
                            <>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(balanceSheetData.comparisonTotalAssets || 0, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(balanceSheetData.assetVariance || 0, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                              <TableCell className="text-right">
                                {renderBSVariancePercentage(balanceSheetData.assetVariancePercentage)}
                              </TableCell>
                            </>
                          )}
                        </TableRow>

                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={bsShowComparison && balanceSheetData.comparisonDate ? 5 : 2} className="font-bold pt-4">
                            LIABILITIES
                          </TableCell>
                        </TableRow>
                        {balanceSheetData.liabilityCategories.map((category, catIdx) => (
                          <>
                            <TableRow key={`liability-cat-${catIdx}`} className="bg-muted/10">
                              <TableCell className="font-semibold pl-4">{category.category}</TableCell>
                              <TableCell className="text-right font-semibold font-mono">
                                {formatCurrency(category.subtotal, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                              {bsShowComparison && balanceSheetData.comparisonDate && (
                                <>
                                  <TableCell className="text-right font-semibold font-mono">
                                    {formatCurrency(category.comparisonSubtotal || 0, baseCurrency?.code || "USD", currencies)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold font-mono">
                                    {formatCurrency(category.variance || 0, baseCurrency?.code || "USD", currencies)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {renderBSVariancePercentage(category.variancePercentage)}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                            {category.accounts.map((account, accIdx) => (
                              <TableRow key={`liability-acc-${catIdx}-${accIdx}`} data-testid={`row-liability-${catIdx}-${accIdx}`}>
                                <TableCell className="pl-8 text-sm">{account.accountName}</TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {formatCurrency(account.currentAmount, baseCurrency?.code || "USD", currencies)}
                                </TableCell>
                                {bsShowComparison && balanceSheetData.comparisonDate && (
                                  <>
                                    <TableCell className="text-right font-mono text-sm">
                                      {formatCurrency(account.comparisonAmount || 0, baseCurrency?.code || "USD", currencies)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {formatCurrency(account.variance || 0, baseCurrency?.code || "USD", currencies)}
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {renderBSVariancePercentage(account.variancePercentage)}
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            ))}
                          </>
                        ))}
                        <TableRow className="font-bold bg-muted/20">
                          <TableCell>Total Liabilities</TableCell>
                          <TableCell className="text-right font-mono" data-testid="cell-total-liabilities">
                            {formatCurrency(balanceSheetData.totalLiabilities, baseCurrency?.code || "USD", currencies)}
                          </TableCell>
                          {bsShowComparison && balanceSheetData.comparisonDate && (
                            <>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(balanceSheetData.comparisonTotalLiabilities || 0, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(balanceSheetData.liabilityVariance || 0, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                              <TableCell className="text-right">
                                {renderBSVariancePercentage(balanceSheetData.liabilityVariancePercentage)}
                              </TableCell>
                            </>
                          )}
                        </TableRow>

                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={bsShowComparison && balanceSheetData.comparisonDate ? 5 : 2} className="font-bold pt-4">
                            EQUITY
                          </TableCell>
                        </TableRow>
                        {balanceSheetData.equityCategories.map((category, catIdx) => (
                          <>
                            <TableRow key={`equity-cat-${catIdx}`} className="bg-muted/10">
                              <TableCell className="font-semibold pl-4">{category.category}</TableCell>
                              <TableCell className="text-right font-semibold font-mono">
                                {formatCurrency(category.subtotal, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                              {bsShowComparison && balanceSheetData.comparisonDate && (
                                <>
                                  <TableCell className="text-right font-semibold font-mono">
                                    {formatCurrency(category.comparisonSubtotal || 0, baseCurrency?.code || "USD", currencies)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold font-mono">
                                    {formatCurrency(category.variance || 0, baseCurrency?.code || "USD", currencies)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {renderBSVariancePercentage(category.variancePercentage)}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                            {category.accounts.map((account, accIdx) => (
                              <TableRow key={`equity-acc-${catIdx}-${accIdx}`} data-testid={`row-equity-${catIdx}-${accIdx}`}>
                                <TableCell className="pl-8 text-sm">{account.accountName}</TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {formatCurrency(account.currentAmount, baseCurrency?.code || "USD", currencies)}
                                </TableCell>
                                {bsShowComparison && balanceSheetData.comparisonDate && (
                                  <>
                                    <TableCell className="text-right font-mono text-sm">
                                      {formatCurrency(account.comparisonAmount || 0, baseCurrency?.code || "USD", currencies)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {formatCurrency(account.variance || 0, baseCurrency?.code || "USD", currencies)}
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {renderBSVariancePercentage(account.variancePercentage)}
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            ))}
                          </>
                        ))}
                        <TableRow className="font-bold bg-muted/20">
                          <TableCell>Total Equity</TableCell>
                          <TableCell className="text-right font-mono" data-testid="cell-total-equity">
                            {formatCurrency(balanceSheetData.totalEquity, baseCurrency?.code || "USD", currencies)}
                          </TableCell>
                          {bsShowComparison && balanceSheetData.comparisonDate && (
                            <>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(balanceSheetData.comparisonTotalEquity || 0, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(balanceSheetData.equityVariance || 0, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                              <TableCell className="text-right">
                                {renderBSVariancePercentage(balanceSheetData.equityVariancePercentage)}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Financial Position Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Assets', value: balanceSheetData.totalAssets },
                            { name: 'Liabilities', value: balanceSheetData.totalLiabilities },
                            { name: 'Equity', value: balanceSheetData.totalEquity },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${formatCurrency(entry.value, baseCurrency?.code || "USD", currencies)}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[0, 1, 2].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {bsShowComparison && balanceSheetData.comparisonDate && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Period Comparison</CardTitle>
                      <CardDescription>Current vs Previous Period</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart
                          data={[
                            {
                              category: 'Assets',
                              current: balanceSheetData.totalAssets,
                              previous: balanceSheetData.comparisonTotalAssets || 0
                            },
                            {
                              category: 'Liabilities',
                              current: balanceSheetData.totalLiabilities,
                              previous: balanceSheetData.comparisonTotalLiabilities || 0
                            },
                            {
                              category: 'Equity',
                              current: balanceSheetData.totalEquity,
                              previous: balanceSheetData.comparisonTotalEquity || 0
                            }
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="category" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Bar dataKey="current" fill="hsl(var(--chart-1))" name="Current Period" />
                          <Bar dataKey="previous" fill="hsl(var(--chart-2))" name="Previous Period" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Balance Check</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Assets:</span>
                      <span className="font-mono">{formatCurrency(balanceSheetData.totalAssets, baseCurrency?.code || "USD", currencies)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Liabilities + Equity:</span>
                      <span className="font-mono">
                        {formatCurrency(balanceSheetData.totalLiabilities + balanceSheetData.totalEquity, baseCurrency?.code || "USD", currencies)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t font-semibold">
                      <span>Balance:</span>
                      <span 
                        className={balanceSheetData.isBalanced
                          ? 'text-green-600' 
                          : 'text-red-600'
                        }
                        data-testid="text-balance-check"
                      >
                        {balanceSheetData.isBalanced 
                          ? 'Balanced ✓' 
                          : 'Not Balanced ✗'
                        }
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {balanceSheetData.ifrsComplianceEnabled ? (
                <FxDisclosure
                  standard={balanceSheetData.fxTranslationStandard!}
                  method={balanceSheetData.translationMethod}
                  baseCurrency={balanceSheetData.baseCurrency}
                  applied={balanceSheetData.fxTranslationApplied}
                />
              ) : null}
            </>
          )}
        </TabsContent>

        {/* Statement of Changes in Equity Tab - IAS 1.106-110 Compliance */}
        <TabsContent value="equity-statement" className="space-y-6" data-testid="content-equity-statement">
          <Card>
            <CardHeader>
              <CardTitle>Statement of Changes in Equity</CardTitle>
              <CardDescription>Reconciliation of equity components per IAS 1.106-110</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Start Date</label>
                  <input
                    type="date"
                    value={equityStartDate}
                    onChange={(e) => setEquityStartDate(e.target.value)}
                    className="w-full h-10 px-3 py-2 border rounded-md"
                    data-testid="input-equity-start-date"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">End Date</label>
                  <input
                    type="date"
                    value={equityEndDate}
                    onChange={(e) => setEquityEndDate(e.target.value)}
                    className="w-full h-10 px-3 py-2 border rounded-md"
                    data-testid="input-equity-end-date"
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="equity-comparison"
                    checked={equityShowComparison}
                    onChange={(e) => setEquityShowComparison(e.target.checked)}
                    className="h-4 w-4"
                    data-testid="checkbox-equity-comparison"
                  />
                  <label htmlFor="equity-comparison" className="text-sm font-medium cursor-pointer">
                    Enable Period Comparison
                  </label>
                </div>

                {equityShowComparison && (
                  <div className="grid gap-4 md:grid-cols-2 pl-6">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Comparison Start Date</label>
                      <input
                        type="date"
                        value={equityComparisonStartDate}
                        onChange={(e) => setEquityComparisonStartDate(e.target.value)}
                        className="w-full h-10 px-3 py-2 border rounded-md"
                        data-testid="input-equity-comparison-start"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Comparison End Date</label>
                      <input
                        type="date"
                        value={equityComparisonEndDate}
                        onChange={(e) => setEquityComparisonEndDate(e.target.value)}
                        className="w-full h-10 px-3 py-2 border rounded-md"
                        data-testid="input-equity-comparison-end"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={() => setFetchEquity(true)}
                className="w-full"
                data-testid="button-generate-equity"
              >
                Generate Report
              </Button>
            </CardContent>
          </Card>

          {equityLoading && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {!equityLoading && equityReport && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Equity Movement Analysis</CardTitle>
                      <CardDescription>
                        Period: {format(new Date(equityReport.startDate), "MMM dd, yyyy")} to {format(new Date(equityReport.endDate), "MMM dd, yyyy")}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const headers = equityShowComparison && equityReport.comparisonStartDate
                            ? ["Component", "Opening Balance", "Net Profit/Loss", "Dividends", "Share Capital Changes", "OCI", "Other Movements", "Closing Balance", "Comparison Closing", "Variance", "Variance %"]
                            : ["Component", "Opening Balance", "Net Profit/Loss", "Dividends", "Share Capital Changes", "OCI", "Other Movements", "Closing Balance"];
                          
                          const rows: string[][] = [];
                          
                          equityReport.equityCategories.forEach(cat => {
                            rows.push([`${cat.category} (Category)`, "", "", "", "", "", "", "", "", "", ""]);
                            cat.components.forEach(comp => {
                              if (equityShowComparison && equityReport.comparisonStartDate) {
                                const varPct = comp.closingBalanceVariancePercentage === "Infinity" ? "∞%" 
                                  : comp.closingBalanceVariancePercentage === "-Infinity" ? "-∞%"
                                  : typeof comp.closingBalanceVariancePercentage === "number" ? `${comp.closingBalanceVariancePercentage.toFixed(1)}%` : "N/A";
                                rows.push([
                                  comp.accountName,
                                  comp.openingBalance,
                                  comp.netProfitLoss,
                                  comp.dividends,
                                  comp.shareCapitalChanges,
                                  comp.otherComprehensiveIncome,
                                  comp.otherMovements,
                                  comp.closingBalance,
                                  comp.comparisonClosingBalance || "",
                                  comp.closingBalanceVariance || "",
                                  varPct
                                ]);
                              } else {
                                rows.push([
                                  comp.accountName,
                                  comp.openingBalance,
                                  comp.netProfitLoss,
                                  comp.dividends,
                                  comp.shareCapitalChanges,
                                  comp.otherComprehensiveIncome,
                                  comp.otherMovements,
                                  comp.closingBalance
                                ]);
                              }
                            });
                          });
                          
                          rows.push(["", "", "", "", "", "", "", "", "", "", ""]);
                          if (equityShowComparison && equityReport.comparisonStartDate) {
                            const totalVarPct = equityReport.closingBalanceVariancePercentage === "Infinity" ? "∞%" 
                              : equityReport.closingBalanceVariancePercentage === "-Infinity" ? "-∞%"
                              : typeof equityReport.closingBalanceVariancePercentage === "number" ? `${equityReport.closingBalanceVariancePercentage.toFixed(1)}%` : "N/A";
                            rows.push([
                              "TOTAL EQUITY",
                              equityReport.totalOpeningBalance,
                              equityReport.totalNetProfitLoss,
                              equityReport.totalDividends,
                              equityReport.totalShareCapitalChanges,
                              equityReport.totalOtherComprehensiveIncome,
                              equityReport.totalOtherMovements,
                              equityReport.totalClosingBalance,
                              equityReport.comparisonTotalClosingBalance || "",
                              equityReport.closingBalanceVariance || "",
                              totalVarPct
                            ]);
                          } else {
                            rows.push([
                              "TOTAL EQUITY",
                              equityReport.totalOpeningBalance,
                              equityReport.totalNetProfitLoss,
                              equityReport.totalDividends,
                              equityReport.totalShareCapitalChanges,
                              equityReport.totalOtherComprehensiveIncome,
                              equityReport.totalOtherMovements,
                              equityReport.totalClosingBalance
                            ]);
                          }
                          
                          downloadCSV(headers, rows, `Equity-Statement-${format(new Date(equityReport.endDate), "yyyy-MM-dd")}.csv`);
                        }}
                        data-testid="button-export-equity-csv"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const headers = equityShowComparison && equityReport.comparisonStartDate
                            ? ["Component", "Opening Balance", "Net Profit/Loss", "Dividends", "Share Capital Changes", "OCI", "Other Movements", "Closing Balance", "Comparison Closing", "Variance", "Variance %"]
                            : ["Component", "Opening Balance", "Net Profit/Loss", "Dividends", "Share Capital Changes", "OCI", "Other Movements", "Closing Balance"];
                          
                          const rows: string[][] = [];
                          
                          equityReport.equityCategories.forEach(cat => {
                            rows.push([`${cat.category} (Category)`, "", "", "", "", "", "", "", "", "", ""]);
                            cat.components.forEach(comp => {
                              if (equityShowComparison && equityReport.comparisonStartDate) {
                                const varPct = comp.closingBalanceVariancePercentage === "Infinity" ? "∞%" 
                                  : comp.closingBalanceVariancePercentage === "-Infinity" ? "-∞%"
                                  : typeof comp.closingBalanceVariancePercentage === "number" ? `${comp.closingBalanceVariancePercentage.toFixed(1)}%` : "N/A";
                                rows.push([
                                  comp.accountName,
                                  comp.openingBalance,
                                  comp.netProfitLoss,
                                  comp.dividends,
                                  comp.shareCapitalChanges,
                                  comp.otherComprehensiveIncome,
                                  comp.otherMovements,
                                  comp.closingBalance,
                                  comp.comparisonClosingBalance || "",
                                  comp.closingBalanceVariance || "",
                                  varPct
                                ]);
                              } else {
                                rows.push([
                                  comp.accountName,
                                  comp.openingBalance,
                                  comp.netProfitLoss,
                                  comp.dividends,
                                  comp.shareCapitalChanges,
                                  comp.otherComprehensiveIncome,
                                  comp.otherMovements,
                                  comp.closingBalance
                                ]);
                              }
                            });
                          });
                          
                          rows.push(["", "", "", "", "", "", "", "", "", "", ""]);
                          if (equityShowComparison && equityReport.comparisonStartDate) {
                            const totalVarPct = equityReport.closingBalanceVariancePercentage === "Infinity" ? "∞%" 
                              : equityReport.closingBalanceVariancePercentage === "-Infinity" ? "-∞%"
                              : typeof equityReport.closingBalanceVariancePercentage === "number" ? `${equityReport.closingBalanceVariancePercentage.toFixed(1)}%` : "N/A";
                            rows.push([
                              "TOTAL EQUITY",
                              equityReport.totalOpeningBalance,
                              equityReport.totalNetProfitLoss,
                              equityReport.totalDividends,
                              equityReport.totalShareCapitalChanges,
                              equityReport.totalOtherComprehensiveIncome,
                              equityReport.totalOtherMovements,
                              equityReport.totalClosingBalance,
                              equityReport.comparisonTotalClosingBalance || "",
                              equityReport.closingBalanceVariance || "",
                              totalVarPct
                            ]);
                          } else {
                            rows.push([
                              "TOTAL EQUITY",
                              equityReport.totalOpeningBalance,
                              equityReport.totalNetProfitLoss,
                              equityReport.totalDividends,
                              equityReport.totalShareCapitalChanges,
                              equityReport.totalOtherComprehensiveIncome,
                              equityReport.totalOtherMovements,
                              equityReport.totalClosingBalance
                            ]);
                          }
                          
                          downloadExcel(headers, rows, `Equity-Statement-${format(new Date(equityReport.endDate), "yyyy-MM-dd")}.xlsx`);
                        }}
                        data-testid="button-export-equity-excel"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                      </Button>
                    </div>
                  </div>
                  {equityReport.reconcilesWithBalanceSheet ? (
                    <Badge variant="default" className="mt-2" data-testid="badge-reconciliation-success">
                      ✓ Reconciles with Balance Sheet
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="mt-2" data-testid="badge-reconciliation-failure">
                      ✗ Does Not Reconcile with Balance Sheet
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Component</TableHead>
                          <TableHead className="text-right">Opening Balance</TableHead>
                          <TableHead className="text-right">Net Profit/Loss</TableHead>
                          <TableHead className="text-right">Dividends</TableHead>
                          <TableHead className="text-right">Share Capital</TableHead>
                          <TableHead className="text-right">OCI</TableHead>
                          <TableHead className="text-right">Other</TableHead>
                          <TableHead className="text-right font-semibold">Closing Balance</TableHead>
                          {equityShowComparison && equityReport.comparisonStartDate && (
                            <>
                              <TableHead className="text-right">Comparison</TableHead>
                              <TableHead className="text-right">Variance</TableHead>
                              <TableHead className="text-right">% Change</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {equityReport.equityCategories.map((category) => (
                          <>
                            <TableRow
                              key={category.category}
                              className="bg-muted/50 font-medium cursor-pointer hover-elevate"
                              onClick={() => {
                                const newExpanded = new Set(expandedEquityCategories);
                                if (newExpanded.has(category.category)) {
                                  newExpanded.delete(category.category);
                                } else {
                                  newExpanded.add(category.category);
                                }
                                setExpandedEquityCategories(newExpanded);
                              }}
                              data-testid={`row-category-${category.category}`}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {expandedEquityCategories.has(category.category) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  {category.category}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(parseFloat(category.subtotalOpeningBalance), baseCurrency?.code || 'USD')}</TableCell>
                              <TableCell className="text-right">{formatCurrency(parseFloat(category.subtotalNetProfitLoss), baseCurrency?.code || 'USD')}</TableCell>
                              <TableCell className="text-right">{formatCurrency(parseFloat(category.subtotalDividends), baseCurrency?.code || 'USD')}</TableCell>
                              <TableCell className="text-right">{formatCurrency(parseFloat(category.subtotalShareCapitalChanges), baseCurrency?.code || 'USD')}</TableCell>
                              <TableCell className="text-right">{formatCurrency(parseFloat(category.subtotalOtherComprehensiveIncome), baseCurrency?.code || 'USD')}</TableCell>
                              <TableCell className="text-right">{formatCurrency(parseFloat(category.subtotalOtherMovements), baseCurrency?.code || 'USD')}</TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(parseFloat(category.subtotalClosingBalance), baseCurrency?.code || 'USD')}</TableCell>
                              {equityShowComparison && equityReport.comparisonStartDate && (
                                <>
                                  <TableCell className="text-right">{formatCurrency(parseFloat(category.comparisonSubtotalClosingBalance || '0'), baseCurrency?.code || 'USD')}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(parseFloat(category.closingBalanceVariance || '0'), baseCurrency?.code || 'USD')}</TableCell>
                                  <TableCell className="text-right">{renderBSVariancePercentage(category.closingBalanceVariancePercentage)}</TableCell>
                                </>
                              )}
                            </TableRow>
                            {expandedEquityCategories.has(category.category) && category.components.map((comp) => (
                              <TableRow key={comp.accountId} data-testid={`row-component-${comp.accountId}`}>
                                <TableCell className="pl-12 text-sm">{comp.accountName}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(parseFloat(comp.openingBalance), baseCurrency?.code || 'USD')}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(parseFloat(comp.netProfitLoss), baseCurrency?.code || 'USD')}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(parseFloat(comp.dividends), baseCurrency?.code || 'USD')}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(parseFloat(comp.shareCapitalChanges), baseCurrency?.code || 'USD')}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(parseFloat(comp.otherComprehensiveIncome), baseCurrency?.code || 'USD')}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(parseFloat(comp.otherMovements), baseCurrency?.code || 'USD')}</TableCell>
                                <TableCell className="text-right text-sm font-semibold">{formatCurrency(parseFloat(comp.closingBalance), baseCurrency?.code || 'USD')}</TableCell>
                                {equityShowComparison && equityReport.comparisonStartDate && (
                                  <>
                                    <TableCell className="text-right text-sm">{formatCurrency(parseFloat(comp.comparisonClosingBalance || '0'), baseCurrency?.code || 'USD')}</TableCell>
                                    <TableCell className="text-right text-sm">{formatCurrency(parseFloat(comp.closingBalanceVariance || '0'), baseCurrency?.code || 'USD')}</TableCell>
                                    <TableCell className="text-right text-sm">{renderBSVariancePercentage(comp.closingBalanceVariancePercentage)}</TableCell>
                                  </>
                                )}
                              </TableRow>
                            ))}
                          </>
                        ))}
                        <TableRow className="border-t-2 font-bold" data-testid="row-total-equity">
                          <TableCell>TOTAL EQUITY</TableCell>
                          <TableCell className="text-right">{formatCurrency(parseFloat(equityReport.totalOpeningBalance), baseCurrency?.code || 'USD')}</TableCell>
                          <TableCell className="text-right">{formatCurrency(parseFloat(equityReport.totalNetProfitLoss), baseCurrency?.code || 'USD')}</TableCell>
                          <TableCell className="text-right">{formatCurrency(parseFloat(equityReport.totalDividends), baseCurrency?.code || 'USD')}</TableCell>
                          <TableCell className="text-right">{formatCurrency(parseFloat(equityReport.totalShareCapitalChanges), baseCurrency?.code || 'USD')}</TableCell>
                          <TableCell className="text-right">{formatCurrency(parseFloat(equityReport.totalOtherComprehensiveIncome), baseCurrency?.code || 'USD')}</TableCell>
                          <TableCell className="text-right">{formatCurrency(parseFloat(equityReport.totalOtherMovements), baseCurrency?.code || 'USD')}</TableCell>
                          <TableCell className="text-right">{formatCurrency(parseFloat(equityReport.totalClosingBalance), baseCurrency?.code || 'USD')}</TableCell>
                          {equityShowComparison && equityReport.comparisonStartDate && (
                            <>
                              <TableCell className="text-right">{formatCurrency(parseFloat(equityReport.comparisonTotalClosingBalance || '0'), baseCurrency?.code || 'USD')}</TableCell>
                              <TableCell className="text-right">{formatCurrency(parseFloat(equityReport.closingBalanceVariance || '0'), baseCurrency?.code || 'USD')}</TableCell>
                              <TableCell className="text-right">{renderBSVariancePercentage(equityReport.closingBalanceVariancePercentage)}</TableCell>
                            </>
                          )}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {equityReport.ifrsComplianceEnabled && equityReport.fxTranslationStandard ? (
                <FxDisclosure
                  standard={equityReport.fxTranslationStandard}
                  baseCurrency={equityReport.baseCurrency}
                  applied={equityReport.fxTranslationApplied}
                />
              ) : null}
            </>
          )}
        </TabsContent>

        {/* Trial Balance Tab */}
        <TabsContent value="trial-balance" className="space-y-6" data-testid="content-trial-balance">
          <Card>
            <CardHeader>
              <CardTitle>Trial Balance</CardTitle>
              <CardDescription>All accounts with debit and credit balances</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">As of Date</label>
                  <input
                    type="date"
                    value={tbAsOfDate}
                    onChange={(e) => setTbAsOfDate(e.target.value)}
                    className="w-full h-10 px-3 py-2 border rounded-md"
                    data-testid="input-tb-as-of-date"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => setFetchTB(true)}
                    className="w-full"
                    data-testid="button-generate-tb"
                  >
                    Generate Report
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tb-comparison"
                    checked={tbShowComparison}
                    onChange={(e) => setTbShowComparison(e.target.checked)}
                    className="h-4 w-4"
                    data-testid="checkbox-tb-comparison"
                  />
                  <label htmlFor="tb-comparison" className="text-sm font-medium">
                    Enable Comparison Period
                  </label>
                </div>

                {tbShowComparison && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Comparison As of Date</label>
                    <input
                      type="date"
                      value={tbComparisonDate}
                      onChange={(e) => setTbComparisonDate(e.target.value)}
                      className="w-full h-10 px-3 py-2 border rounded-md"
                      data-testid="input-tb-comparison-date"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {tbLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {tbReport && !tbLoading && (
            <>
              <div className="flex justify-end mb-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportTrialBalanceCSV(tbReport, baseCurrency?.code || "USD", tbAsOfDate)}
                    data-testid="button-export-tb-csv"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportTrialBalanceExcel(tbReport, baseCurrency?.code || "USD", tbAsOfDate)}
                    data-testid="button-export-tb-excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Trial Balance Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm font-medium text-muted-foreground">Total Debits</div>
                      <div className="text-2xl font-bold font-mono" data-testid="text-total-debits">
                        {formatCurrency(tbReport.totalDebits, baseCurrency?.code || "USD", currencies)}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm font-medium text-muted-foreground">Total Credits</div>
                      <div className="text-2xl font-bold font-mono" data-testid="text-total-credits">
                        {formatCurrency(tbReport.totalCredits, baseCurrency?.code || "USD", currencies)}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm font-medium text-muted-foreground">Status</div>
                      <div 
                        className={`text-2xl font-bold ${tbReport.isBalanced ? 'text-green-600' : 'text-red-600'}`}
                        data-testid="text-tb-balanced"
                      >
                        {tbReport.isBalanced ? 'Balanced ✓' : 'Not Balanced ✗'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {tbReport.accounts.length === 0 ? (
                    <p className="text-muted-foreground">No accounts to display</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead className="text-right">Current Debit</TableHead>
                          <TableHead className="text-right">Current Credit</TableHead>
                          {tbShowComparison && tbReport.comparisonDate && (
                            <>
                              <TableHead className="text-right">Comparison Debit</TableHead>
                              <TableHead className="text-right">Comparison Credit</TableHead>
                              <TableHead className="text-right">Variance Debit</TableHead>
                              <TableHead className="text-right">Variance Credit</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tbReport.accounts.map((account, idx) => (
                          <TableRow key={idx} data-testid={`row-account-${idx}`}>
                            <TableCell className="font-mono text-sm">{account.accountCode}</TableCell>
                            <TableCell>{account.accountName}</TableCell>
                            <TableCell className="text-right font-mono">
                              {account.debit > 0 ? formatCurrency(account.debit, baseCurrency?.code || "USD", currencies) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {account.credit > 0 ? formatCurrency(account.credit, baseCurrency?.code || "USD", currencies) : '-'}
                            </TableCell>
                            {tbShowComparison && tbReport.comparisonDate && (
                              <>
                                <TableCell className="text-right font-mono">
                                  {account.comparisonDebit && account.comparisonDebit > 0 
                                    ? formatCurrency(account.comparisonDebit, baseCurrency?.code || "USD", currencies) 
                                    : '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {account.comparisonCredit && account.comparisonCredit > 0 
                                    ? formatCurrency(account.comparisonCredit, baseCurrency?.code || "USD", currencies) 
                                    : '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {account.varianceDebit && account.varianceDebit !== 0
                                    ? formatCurrency(account.varianceDebit, baseCurrency?.code || "USD", currencies)
                                    : '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {account.varianceCredit && account.varianceCredit !== 0
                                    ? formatCurrency(account.varianceCredit, baseCurrency?.code || "USD", currencies)
                                    : '-'}
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold bg-muted/50">
                          <TableCell colSpan={2}>Totals</TableCell>
                          <TableCell className="text-right font-mono" data-testid="cell-total-debits">
                            {formatCurrency(tbReport.totalDebits, baseCurrency?.code || "USD", currencies)}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid="cell-total-credits">
                            {formatCurrency(tbReport.totalCredits, baseCurrency?.code || "USD", currencies)}
                          </TableCell>
                          {tbShowComparison && tbReport.comparisonDate && (
                            <>
                              <TableCell className="text-right font-mono" data-testid="cell-comparison-total-debits">
                                {formatCurrency(tbReport.comparisonTotalDebits || 0, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                              <TableCell className="text-right font-mono" data-testid="cell-comparison-total-credits">
                                {formatCurrency(tbReport.comparisonTotalCredits || 0, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                              <TableCell className="text-right font-mono" data-testid="cell-variance-total-debits">
                                {formatCurrency(tbReport.totalDebitsVariance || 0, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                              <TableCell className="text-right font-mono" data-testid="cell-variance-total-credits">
                                {formatCurrency(tbReport.totalCreditsVariance || 0, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {tbReport.ifrsComplianceEnabled && (
                <FxDisclosure
                  standard={tbReport.fxTranslationStandard!}
                  method={tbReport.translationMethod}
                  baseCurrency={tbReport.baseCurrency || "USD"}
                  applied={tbReport.fxTranslationApplied || false}
                />
              )}
            </>
          )}
        </TabsContent>

        {/* Cash Flow Tab */}
        <TabsContent value="cash-flow" className="space-y-6" data-testid="content-cash-flow">
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Statement (Indirect Method)</CardTitle>
              <CardDescription>Cash movements for the selected period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Start Date</label>
                  <input
                    type="date"
                    value={cfStartDate}
                    onChange={(e) => setCfStartDate(e.target.value)}
                    className="w-full h-10 px-3 py-2 border rounded-md"
                    data-testid="input-cf-start-date"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">End Date</label>
                  <input
                    type="date"
                    value={cfEndDate}
                    onChange={(e) => setCfEndDate(e.target.value)}
                    className="w-full h-10 px-3 py-2 border rounded-md"
                    data-testid="input-cf-end-date"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => setFetchCF(true)}
                    className="w-full"
                    data-testid="button-generate-cf"
                  >
                    Generate Report
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="cf-comparison"
                    checked={cfShowComparison}
                    onChange={(e) => setCfShowComparison(e.target.checked)}
                    className="h-4 w-4"
                    data-testid="checkbox-cf-comparison"
                  />
                  <label htmlFor="cf-comparison" className="text-sm font-medium">
                    Enable Period Comparison
                  </label>
                </div>

                {cfShowComparison && (
                  <div className="grid gap-4 md:grid-cols-2 pl-6">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Comparison Start Date</label>
                      <input
                        type="date"
                        value={cfComparisonStartDate}
                        onChange={(e) => setCfComparisonStartDate(e.target.value)}
                        className="w-full h-10 px-3 py-2 border rounded-md"
                        data-testid="input-cf-comparison-start"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Comparison End Date</label>
                      <input
                        type="date"
                        value={cfComparisonEndDate}
                        onChange={(e) => setCfComparisonEndDate(e.target.value)}
                        className="w-full h-10 px-3 py-2 border rounded-md"
                        data-testid="input-cf-comparison-end"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {cfLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {cfReport && !cfLoading && (
            <>
              <div className="flex justify-end mb-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportCashFlowCSV(cfReport, baseCurrency?.code || "USD", cfShowComparison && !!cfReport.comparisonData)}
                    data-testid="button-export-cf-csv"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportCashFlowExcel(cfReport, baseCurrency?.code || "USD", cfShowComparison && !!cfReport.comparisonData)}
                    data-testid="button-export-cf-excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Cash Flow Visualization</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                      data={[
                        { name: 'Operating', amount: cfReport.netOperating },
                        { name: 'Investing', amount: cfReport.netInvesting },
                        { name: 'Financing', amount: cfReport.netFinancing },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Operating Activities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {cfReport.operating.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No operating activities</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Activity</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cfReport.operating.map((item, idx) => (
                            <TableRow key={idx} data-testid={`row-operating-${idx}`}>
                              <TableCell className="text-sm">{item.activity}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(item.amount, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Net Operating</TableCell>
                            <TableCell className="text-right font-mono" data-testid="cell-net-operating">
                              {formatCurrency(cfReport.netOperating, baseCurrency?.code || "USD", currencies)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Investing Activities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {cfReport.investing.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No investing activities</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Activity</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cfReport.investing.map((item, idx) => (
                            <TableRow key={idx} data-testid={`row-investing-${idx}`}>
                              <TableCell className="text-sm">{item.activity}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(item.amount, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Net Investing</TableCell>
                            <TableCell className="text-right font-mono" data-testid="cell-net-investing">
                              {formatCurrency(cfReport.netInvesting, baseCurrency?.code || "USD", currencies)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Financing Activities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {cfReport.financing.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No financing activities</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Activity</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cfReport.financing.map((item, idx) => (
                            <TableRow key={idx} data-testid={`row-financing-${idx}`}>
                              <TableCell className="text-sm">{item.activity}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(item.amount, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Net Financing</TableCell>
                            <TableCell className="text-right font-mono" data-testid="cell-net-financing">
                              {formatCurrency(cfReport.netFinancing, baseCurrency?.code || "USD", currencies)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Net Cash Flow Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        Total Net Cash Flow
                      </div>
                      <div 
                        className={`text-3xl font-bold ${cfReport.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        data-testid="text-net-cash-flow"
                      >
                        {formatCurrency(cfReport.netCashFlow, cfReport.baseCurrency || baseCurrency?.code || "USD", currencies)}
                      </div>
                    </div>

                    {cfReport.comparisonData && (
                      <div className="border-t pt-4">
                        <h3 className="text-sm font-semibold mb-3">Period Comparison & Variance</h3>
                        <div className="grid gap-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Operating Activities</span>
                            <div className="flex items-center gap-2">
                              {cfReport.operatingVariance !== undefined && (
                                <>
                                  <span className={cfReport.operatingVariance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {cfReport.operatingVariance >= 0 ? <ArrowUp className="h-3 w-3 inline" /> : <ArrowDown className="h-3 w-3 inline" />}
                                    {formatCurrency(Math.abs(cfReport.operatingVariance), cfReport.baseCurrency || baseCurrency?.code || "USD", currencies)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Investing Activities</span>
                            <div className="flex items-center gap-2">
                              {cfReport.investingVariance !== undefined && (
                                <>
                                  <span className={cfReport.investingVariance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {cfReport.investingVariance >= 0 ? <ArrowUp className="h-3 w-3 inline" /> : <ArrowDown className="h-3 w-3 inline" />}
                                    {formatCurrency(Math.abs(cfReport.investingVariance), cfReport.baseCurrency || baseCurrency?.code || "USD", currencies)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Financing Activities</span>
                            <div className="flex items-center gap-2">
                              {cfReport.financingVariance !== undefined && (
                                <>
                                  <span className={cfReport.financingVariance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {cfReport.financingVariance >= 0 ? <ArrowUp className="h-3 w-3 inline" /> : <ArrowDown className="h-3 w-3 inline" />}
                                    {formatCurrency(Math.abs(cfReport.financingVariance), cfReport.baseCurrency || baseCurrency?.code || "USD", currencies)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-sm font-semibold border-t pt-2">
                            <span>Net Cash Flow Change</span>
                            <div className="flex items-center gap-2">
                              {cfReport.netVariance !== undefined && (
                                <>
                                  <span className={cfReport.netVariance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {cfReport.netVariance >= 0 ? <ArrowUp className="h-4 w-4 inline" /> : <ArrowDown className="h-4 w-4 inline" />}
                                    {formatCurrency(Math.abs(cfReport.netVariance), cfReport.baseCurrency || baseCurrency?.code || "USD", currencies)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* IFRS Disclosure for Cash Flow Statement (IAS 7) */}
              {cfReport.ifrsComplianceEnabled && (
                <FxDisclosure
                  standard={cfReport.fxTranslationStandard!}
                  method={cfReport.translationMethod}
                  baseCurrency={cfReport.baseCurrency || "USD"}
                  applied={cfReport.fxTranslationApplied || false}
                />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
