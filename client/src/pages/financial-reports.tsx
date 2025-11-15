import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, TrendingUp, DollarSign, FileBarChart, Activity, Download, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { type Currency } from "@shared/schema";
import { formatCurrency } from "@/lib/currency-utils";
import {
  DateRangePreset,
  ComparisonMode,
  dateRangePresetOptions,
  comparisonModeOptions,
  getPeriodComparison
} from "@/lib/date-range-presets";
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

interface TrialBalanceReport {
  accounts: Array<{ 
    accountName: string; 
    accountCode: string; 
    debit: number; 
    credit: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

interface CashFlowReport {
  operating: Array<{ activity: string; amount: number }>;
  investing: Array<{ activity: string; amount: number }>;
  financing: Array<{ activity: string; amount: number }>;
  netOperating: number;
  netInvesting: number;
  netFinancing: number;
  netCashFlow: number;
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
  const [tbAsOfDate, setTbAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cfStartDate, setCfStartDate] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd")
  );
  const [cfEndDate, setCfEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Control when to fetch reports
  const [fetchPLComparison, setFetchPLComparison] = useState(false);
  const [fetchBS, setFetchBS] = useState(false);
  const [fetchTB, setFetchTB] = useState(false);
  const [fetchCF, setFetchCF] = useState(false);

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
  const { data: balanceSheetData, isLoading: bsLoading } = useQuery<BalanceSheetResponse>({
    queryKey: ["/api/reports/balance-sheet", { tenantId: currentTenant?.id, asOfDate: bsAsOfDate }],
    enabled: !!currentTenant?.id && fetchBS,
  });

  // Trial Balance Query
  const { data: tbReport, isLoading: tbLoading } = useQuery<TrialBalanceReport>({
    queryKey: ["/api/reports/trial-balance", { tenantId: currentTenant?.id, asOfDate: tbAsOfDate }],
    enabled: !!currentTenant?.id && fetchTB,
  });

  // Cash Flow Query
  const { data: cfReport, isLoading: cfLoading } = useQuery<CashFlowReport>({
    queryKey: ["/api/reports/cash-flow", { tenantId: currentTenant?.id, startDate: cfStartDate, endDate: cfEndDate }],
    enabled: !!currentTenant?.id && fetchCF,
  });

  // Currency query for formatting
  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['/api/currencies', { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const baseCurrency = currencies.find(c => c.isBaseCurrency);

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Workspace Selected</h2>
          <p className="text-muted-foreground">Please select or create a workspace to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Financial Reports</h1>
        <p className="text-muted-foreground">Comprehensive financial insights with visualizations</p>
      </div>

      <Tabs defaultValue="profit-loss" className="space-y-6" data-testid="tabs-financial-reports">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto" data-testid="tabs-list-reports">
          <TabsTrigger value="profit-loss" data-testid="tab-profit-loss">
            <TrendingUp className="h-4 w-4 mr-2" />
            P&L
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" data-testid="tab-balance-sheet">
            <DollarSign className="h-4 w-4 mr-2" />
            Balance Sheet
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const headers = ["Account", "Current Period", "Previous Period", "$ Variance", "% Variance"];
                      const rows: string[][] = [];
                      
                      rows.push(["REVENUE", "", "", "", ""]);
                      plComparisonData.current.revenue.forEach(acc => {
                        let percentageText: string;
                        if (acc.percentageChange === "Infinity") {
                          percentageText = "Infinity";
                        } else if (acc.percentageChange === "-Infinity") {
                          percentageText = "-Infinity";
                        } else if (typeof acc.percentageChange === "number") {
                          percentageText = acc.percentageChange.toFixed(1) + "%";
                        } else {
                          percentageText = "N/A";
                        }
                        
                        rows.push([
                          acc.accountName,
                          acc.currentAmount.toString(),
                          acc.previousAmount.toString(),
                          acc.variance.toString(),
                          percentageText
                        ]);
                      });
                      
                      const revenuePercentageText = plComparisonData.variances.revenue.percentage === "Infinity" 
                        ? "Infinity" 
                        : plComparisonData.variances.revenue.percentage === "-Infinity"
                        ? "-Infinity"
                        : typeof plComparisonData.variances.revenue.percentage === "number"
                        ? plComparisonData.variances.revenue.percentage.toFixed(1) + "%"
                        : "N/A";
                      rows.push(["Total Revenue", plComparisonData.current.totalRevenue.toString(), plComparisonData.previous.totalRevenue.toString(), plComparisonData.variances.revenue.amount.toString(), revenuePercentageText]);
                      
                      rows.push(["", "", "", "", ""]);
                      rows.push(["EXPENSES", "", "", "", ""]);
                      plComparisonData.current.expenses.forEach(acc => {
                        let percentageText: string;
                        if (acc.percentageChange === "Infinity") {
                          percentageText = "Infinity";
                        } else if (acc.percentageChange === "-Infinity") {
                          percentageText = "-Infinity";
                        } else if (typeof acc.percentageChange === "number") {
                          percentageText = acc.percentageChange.toFixed(1) + "%";
                        } else {
                          percentageText = "N/A";
                        }
                        
                        rows.push([
                          acc.accountName,
                          acc.currentAmount.toString(),
                          acc.previousAmount.toString(),
                          acc.variance.toString(),
                          percentageText
                        ]);
                      });
                      
                      const expensesPercentageText = plComparisonData.variances.expenses.percentage === "Infinity"
                        ? "Infinity"
                        : plComparisonData.variances.expenses.percentage === "-Infinity"
                        ? "-Infinity"
                        : typeof plComparisonData.variances.expenses.percentage === "number"
                        ? plComparisonData.variances.expenses.percentage.toFixed(1) + "%"
                        : "N/A";
                      rows.push(["Total Expenses", plComparisonData.current.totalExpenses.toString(), plComparisonData.previous.totalExpenses.toString(), plComparisonData.variances.expenses.amount.toString(), expensesPercentageText]);
                      
                      rows.push(["", "", "", "", ""]);
                      
                      const netProfitPercentageText = plComparisonData.variances.netProfit.percentage === "Infinity"
                        ? "Infinity"
                        : plComparisonData.variances.netProfit.percentage === "-Infinity"
                        ? "-Infinity"
                        : typeof plComparisonData.variances.netProfit.percentage === "number"
                        ? plComparisonData.variances.netProfit.percentage.toFixed(1) + "%"
                        : "N/A";
                      rows.push(["NET PROFIT", plComparisonData.current.netProfit.toString(), plComparisonData.previous.netProfit.toString(), plComparisonData.variances.netProfit.amount.toString(), netProfitPercentageText]);
                      
                      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `PL-Comparison-${format(new Date(), "yyyy-MM-dd")}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    data-testid="button-export-csv"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
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
              <CardDescription>Financial position as of a specific date</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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

              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Assets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {balanceSheetData.assets.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No asset accounts</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {balanceSheetData.assets.map((item, idx) => (
                            <TableRow key={idx} data-testid={`row-asset-${idx}`}>
                              <TableCell className="text-sm">{item.accountName}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(item.amount, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Total Assets</TableCell>
                            <TableCell className="text-right font-mono" data-testid="cell-total-assets">
                              {formatCurrency(balanceSheetData.totalAssets, baseCurrency?.code || "USD", currencies)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Liabilities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {balanceSheetData.liabilities.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No liability accounts</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {balanceSheetData.liabilities.map((item, idx) => (
                            <TableRow key={idx} data-testid={`row-liability-${idx}`}>
                              <TableCell className="text-sm">{item.accountName}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(item.amount, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Total Liabilities</TableCell>
                            <TableCell className="text-right font-mono" data-testid="cell-total-liabilities">
                              {formatCurrency(balanceSheetData.totalLiabilities, baseCurrency?.code || "USD", currencies)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Equity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {balanceSheetData.equity.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No equity accounts</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {balanceSheetData.equity.map((item, idx) => (
                            <TableRow key={idx} data-testid={`row-equity-${idx}`}>
                              <TableCell className="text-sm">{item.accountName}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(item.amount, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Total Equity</TableCell>
                            <TableCell className="text-right font-mono" data-testid="cell-total-equity">
                              {formatCurrency(balanceSheetData.totalEquity, baseCurrency?.code || "USD", currencies)}
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
                        className={Math.abs(balanceSheetData.totalAssets - (balanceSheetData.totalLiabilities + balanceSheetData.totalEquity)) < 0.01 
                          ? 'text-green-600' 
                          : 'text-red-600'
                        }
                        data-testid="text-balance-check"
                      >
                        {Math.abs(balanceSheetData.totalAssets - (balanceSheetData.totalLiabilities + balanceSheetData.totalEquity)) < 0.01 
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
            </CardContent>
          </Card>

          {tbLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {tbReport && !tbLoading && (
            <>
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
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
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
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Cash Flow Tab */}
        <TabsContent value="cash-flow" className="space-y-6" data-testid="content-cash-flow">
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Statement</CardTitle>
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
            </CardContent>
          </Card>

          {cfLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {cfReport && !cfLoading && (
            <>
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
                  <CardTitle>Net Cash Flow</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-sm font-medium text-muted-foreground mb-2">
                      Total Net Cash Flow
                    </div>
                    <div 
                      className={`text-3xl font-bold ${cfReport.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      data-testid="text-net-cash-flow"
                    >
                      {formatCurrency(cfReport.netCashFlow, baseCurrency?.code || "USD", currencies)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
