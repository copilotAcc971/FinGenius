import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, TrendingUp, DollarSign, FileBarChart, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { type Currency } from "@shared/schema";
import { formatCurrency } from "@/lib/currency-utils";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface ProfitLossReport {
  revenue: Array<{ accountName: string; amount: number }>;
  expenses: Array<{ accountName: string; amount: number }>;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

interface BalanceSheetReport {
  assets: Array<{ accountName: string; amount: number }>;
  liabilities: Array<{ accountName: string; amount: number }>;
  equity: Array<{ accountName: string; amount: number }>;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
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

export default function FinancialReports() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Date states for different reports
  const [plStartDate, setPlStartDate] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd")
  );
  const [plEndDate, setPlEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bsAsOfDate, setBsAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tbAsOfDate, setTbAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cfStartDate, setCfStartDate] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd")
  );
  const [cfEndDate, setCfEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Control when to fetch reports
  const [fetchPL, setFetchPL] = useState(false);
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

  // Profit & Loss Query
  const { data: plReport, isLoading: plLoading } = useQuery<ProfitLossReport>({
    queryKey: ["/api/reports/profit-loss", { tenantId: currentTenant?.id, startDate: plStartDate, endDate: plEndDate }],
    enabled: !!currentTenant?.id && fetchPL,
  });

  // Balance Sheet Query
  const { data: bsReport, isLoading: bsLoading } = useQuery<BalanceSheetReport>({
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

        {/* Profit & Loss Tab */}
        <TabsContent value="profit-loss" className="space-y-6" data-testid="content-profit-loss">
          <Card>
            <CardHeader>
              <CardTitle>Profit & Loss Statement</CardTitle>
              <CardDescription>Revenue and expenses for the selected period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Start Date</label>
                  <input
                    type="date"
                    value={plStartDate}
                    onChange={(e) => setPlStartDate(e.target.value)}
                    className="w-full h-10 px-3 py-2 border rounded-md"
                    data-testid="input-pl-start-date"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">End Date</label>
                  <input
                    type="date"
                    value={plEndDate}
                    onChange={(e) => setPlEndDate(e.target.value)}
                    className="w-full h-10 px-3 py-2 border rounded-md"
                    data-testid="input-pl-end-date"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => setFetchPL(true)}
                    className="w-full"
                    data-testid="button-generate-pl"
                  >
                    Generate Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {plLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {plReport && !plLoading && (
            <>
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600" data-testid="text-total-revenue">
                      {formatCurrency(plReport.totalRevenue, baseCurrency?.code || "USD", currencies)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600" data-testid="text-total-expenses">
                      {formatCurrency(plReport.totalExpenses, baseCurrency?.code || "USD", currencies)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className={`text-2xl font-bold ${plReport.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      data-testid="text-net-profit"
                    >
                      {formatCurrency(plReport.netProfit, baseCurrency?.code || "USD", currencies)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue vs Expenses Chart</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[
                        { name: 'Revenue', amount: plReport.totalRevenue },
                        { name: 'Expenses', amount: plReport.totalExpenses },
                        { name: 'Net Profit', amount: plReport.netProfit },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {plReport.revenue.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No revenue accounts</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {plReport.revenue.map((item, idx) => (
                            <TableRow key={idx} data-testid={`row-revenue-${idx}`}>
                              <TableCell>{item.accountName}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(item.amount, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Total Revenue</TableCell>
                            <TableCell className="text-right font-mono" data-testid="cell-total-revenue">
                              {formatCurrency(plReport.totalRevenue, baseCurrency?.code || "USD", currencies)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Expense Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {plReport.expenses.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No expense accounts</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {plReport.expenses.map((item, idx) => (
                            <TableRow key={idx} data-testid={`row-expense-${idx}`}>
                              <TableCell>{item.accountName}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(item.amount, baseCurrency?.code || "USD", currencies)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Total Expenses</TableCell>
                            <TableCell className="text-right font-mono" data-testid="cell-total-expenses">
                              {formatCurrency(plReport.totalExpenses, baseCurrency?.code || "USD", currencies)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
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

          {bsReport && !bsLoading && (
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
                          { name: 'Assets', value: bsReport.totalAssets },
                          { name: 'Liabilities', value: bsReport.totalLiabilities },
                          { name: 'Equity', value: bsReport.totalEquity },
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
                      <Tooltip />
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
                    {bsReport.assets.length === 0 ? (
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
                          {bsReport.assets.map((item, idx) => (
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
                              {formatCurrency(bsReport.totalAssets, baseCurrency?.code || "USD", currencies)}
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
                    {bsReport.liabilities.length === 0 ? (
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
                          {bsReport.liabilities.map((item, idx) => (
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
                              {formatCurrency(bsReport.totalLiabilities, baseCurrency?.code || "USD", currencies)}
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
                    {bsReport.equity.length === 0 ? (
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
                          {bsReport.equity.map((item, idx) => (
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
                              {formatCurrency(bsReport.totalEquity, baseCurrency?.code || "USD", currencies)}
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
                      <span className="font-mono">{formatCurrency(bsReport.totalAssets, baseCurrency?.code || "USD", currencies)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Liabilities + Equity:</span>
                      <span className="font-mono">
                        {formatCurrency(bsReport.totalLiabilities + bsReport.totalEquity, baseCurrency?.code || "USD", currencies)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t font-semibold">
                      <span>Balance:</span>
                      <span 
                        className={Math.abs(bsReport.totalAssets - (bsReport.totalLiabilities + bsReport.totalEquity)) < 0.01 
                          ? 'text-green-600' 
                          : 'text-red-600'
                        }
                        data-testid="text-balance-check"
                      >
                        {Math.abs(bsReport.totalAssets - (bsReport.totalLiabilities + bsReport.totalEquity)) < 0.01 
                          ? 'Balanced ✓' 
                          : 'Not Balanced ✗'
                        }
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                      <Tooltip />
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
