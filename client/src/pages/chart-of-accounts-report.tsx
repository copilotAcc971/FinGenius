import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Download, ChevronDown, ChevronRight, FileText, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/status-badge";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/currency-utils";
import { format } from "date-fns";
import { PieChart, Pie, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { Account } from "@shared/schema";

interface AccountTransaction {
  id: string;
  transactionDate: string;
  journalEntryId: string | null;
  journalEntryNumber: string | null;
  journalEntryLegId: string | null;
  description: string | null;
  debitAmount: string;
  creditAmount: string;
  runningBalance: string;
  sourceDocumentType: string | null;
  sourceDocumentId: string | null;
}

interface TransactionHistoryResponse {
  accountId: string;
  accountCode: string;
  accountName: string;
  transactions: AccountTransaction[];
  summary: {
    totalDebits: string;
    totalCredits: string;
    openingBalance: string;
    closingBalance: string;
    transactionCount: number;
  };
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const TRANSACTION_PAGE_SIZE = 20;

export default function ChartOfAccountsReport() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [transactionPages, setTransactionPages] = useState<Record<string, number>>({});

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

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const getTransactionQueryKey = (accountId: string, page: number) => {
    const offset = (page - 1) * TRANSACTION_PAGE_SIZE;
    const params: any = {
      tenantId: currentTenant?.id,
      limit: TRANSACTION_PAGE_SIZE.toString(),
      offset: offset.toString(),
    };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    return [`/api/accounts/${accountId}/transaction-history`, params];
  };

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {
      asset: [],
      liability: [],
      equity: [],
      income: [],
      expense: [],
    };

    accounts.forEach(account => {
      const type = account.type.toLowerCase();
      if (type === 'revenue' || type === 'income') {
        groups.income.push(account);
      } else if (groups[type]) {
        groups[type].push(account);
      }
    });

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.code.localeCompare(b.code));
    });

    return groups;
  }, [accounts]);

  const accountTypeSubtotals = useMemo(() => {
    const subtotals: Record<string, number> = {
      asset: 0,
      liability: 0,
      equity: 0,
      income: 0,
      expense: 0,
    };

    Object.entries(groupedAccounts).forEach(([type, accts]) => {
      subtotals[type] = accts.reduce((sum, acc) => sum + parseFloat(acc.currentBalance || "0"), 0);
    });

    return subtotals;
  }, [groupedAccounts]);

  const pieChartData = useMemo(() => {
    return [
      { name: 'Assets', value: Math.abs(accountTypeSubtotals.asset) },
      { name: 'Liabilities', value: Math.abs(accountTypeSubtotals.liability) },
      { name: 'Equity', value: Math.abs(accountTypeSubtotals.equity) },
      { name: 'Income', value: Math.abs(accountTypeSubtotals.income) },
      { name: 'Expenses', value: Math.abs(accountTypeSubtotals.expense) },
    ].filter(item => item.value > 0);
  }, [accountTypeSubtotals]);

  const barChartData = useMemo(() => {
    return [
      { type: 'Assets', amount: accountTypeSubtotals.asset },
      { type: 'Liabilities', amount: accountTypeSubtotals.liability },
      { type: 'Equity', amount: accountTypeSubtotals.equity },
      { type: 'Income', amount: accountTypeSubtotals.income },
      { type: 'Expenses', amount: accountTypeSubtotals.expense },
    ];
  }, [accountTypeSubtotals]);

  const toggleAccount = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
      if (!transactionPages[accountId]) {
        setTransactionPages(prev => ({ ...prev, [accountId]: 1 }));
      }
    }
    setExpandedAccounts(newExpanded);
  };

  const changePage = (accountId: string, newPage: number) => {
    setTransactionPages(prev => ({ ...prev, [accountId]: newPage }));
  };

  const exportToCSV = () => {
    const csvRows: string[] = [];
    csvRows.push(['Account Type', 'Account Code', 'Account Name', 'Current Balance'].join(','));

    Object.entries(groupedAccounts).forEach(([type, accts]) => {
      const typeName = type.charAt(0).toUpperCase() + type.slice(1);
      accts.forEach(acc => {
        csvRows.push([
          typeName,
          acc.code,
          `"${acc.name}"`,
          acc.currentBalance || "0"
        ].join(','));
      });
      csvRows.push([typeName + ' Subtotal', '', '', accountTypeSubtotals[type].toString()].join(','));
      csvRows.push('');
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chart-of-accounts-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Chart of Accounts exported to CSV",
    });
  };

  const getSourceDocumentLabel = (type: string | null, id: string | null) => {
    if (!type || !id) return null;
    
    const labels: Record<string, string> = {
      invoice: "Invoice",
      bill: "Bill",
      payment: "Payment",
      customer_payment: "Customer Payment",
      journal_entry: "Journal Entry",
      expense: "Expense",
      credit_note: "Credit Note",
    };

    return `${labels[type] || type} #${id.substring(0, 8)}`;
  };

  const renderAccountGroup = (groupType: string, groupAccounts: Account[], groupTitle: string) => {
    if (groupAccounts.length === 0) return null;

    return (
      <Card key={groupType} data-testid={`card-account-group-${groupType}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{groupTitle}</CardTitle>
              <CardDescription>
                {groupAccounts.length} account{groupAccounts.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Subtotal</div>
              <div className="text-2xl font-mono font-semibold" data-testid={`text-subtotal-${groupType}`}>
                {formatCurrency(accountTypeSubtotals[groupType])}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="w-32">Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead className="text-right">Current Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupAccounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  expanded={expandedAccounts.has(account.id)}
                  onToggle={() => toggleAccount(account.id)}
                  currentPage={transactionPages[account.id] || 1}
                  onPageChange={(page) => changePage(account.id, page)}
                  startDate={startDate}
                  endDate={endDate}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

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
    <div className="flex flex-col h-full">
      <div className="flex-none border-b p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold" data-testid="text-page-title">Chart of Accounts</h1>
            <p className="text-muted-foreground mt-1">
              View all accounts grouped by type with current balances
            </p>
          </div>
          <Button 
            onClick={exportToCSV} 
            variant="outline"
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4 mr-2" />
            Export to CSV
          </Button>
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Start Date (Optional)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-10 px-3 border rounded-md"
              data-testid="input-start-date"
            />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">End Date (Optional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-10 px-3 border rounded-md"
              data-testid="input-end-date"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
            data-testid="button-clear-dates"
          >
            Clear Dates
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {accountsLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-40 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Accounts Found</h3>
              <p className="text-muted-foreground">Create accounts to see them here</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-pie-chart">
                <CardHeader>
                  <CardTitle>Account Balances by Type</CardTitle>
                  <CardDescription>Distribution of balances across account types</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card data-testid="card-bar-chart">
                <CardHeader>
                  <CardTitle>Account Type Comparison</CardTitle>
                  <CardDescription>Balance comparison across account types</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => formatCurrency(value)} />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {renderAccountGroup('asset', groupedAccounts.asset, 'Assets')}
            {renderAccountGroup('liability', groupedAccounts.liability, 'Liabilities')}
            {renderAccountGroup('equity', groupedAccounts.equity, 'Equity')}
            {renderAccountGroup('income', groupedAccounts.income, 'Income')}
            {renderAccountGroup('expense', groupedAccounts.expense, 'Expenses')}
          </>
        )}
      </div>
    </div>
  );
}

interface AccountRowProps {
  account: Account;
  expanded: boolean;
  onToggle: () => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  startDate: string;
  endDate: string;
}

function AccountRow({ account, expanded, onToggle, currentPage, onPageChange, startDate, endDate }: AccountRowProps) {
  const { currentTenant } = useTenant();
  
  const offset = (currentPage - 1) * TRANSACTION_PAGE_SIZE;
  const queryParams: any = {
    tenantId: currentTenant?.id,
    limit: TRANSACTION_PAGE_SIZE.toString(),
    offset: offset.toString(),
  };
  if (startDate) queryParams.startDate = startDate;
  if (endDate) queryParams.endDate = endDate;

  const { data: transactionData, isLoading: transactionsLoading } = useQuery<TransactionHistoryResponse>({
    queryKey: [`/api/accounts/${account.id}/transaction-history`, queryParams],
    enabled: expanded && !!currentTenant?.id,
  });

  const totalPages = transactionData 
    ? Math.ceil((transactionData.summary.transactionCount || 0) / TRANSACTION_PAGE_SIZE)
    : 0;

  return (
    <>
      <TableRow 
        className="cursor-pointer hover-elevate"
        onClick={onToggle}
        data-testid={`row-account-${account.id}`}
      >
        <TableCell>
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </TableCell>
        <TableCell className="font-mono" data-testid={`text-account-code-${account.id}`}>
          {account.code}
        </TableCell>
        <TableCell data-testid={`text-account-name-${account.id}`}>
          {account.name}
        </TableCell>
        <TableCell className="text-right font-mono font-medium" data-testid={`text-account-balance-${account.id}`}>
          {formatCurrency(parseFloat(account.currentBalance || "0"))}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={4} className="p-0">
            <Collapsible open={expanded}>
              <CollapsibleContent>
                <div className="p-6 bg-muted/30">
                  {transactionsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : transactionData?.transactions && transactionData.transactions.length > 0 ? (
                    <>
                      <div className="mb-4">
                        <h4 className="font-semibold mb-2">Transaction History</h4>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Opening Balance:</span>{" "}
                            <span className="font-mono font-medium">
                              {formatCurrency(parseFloat(transactionData.summary.openingBalance))}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Debits:</span>{" "}
                            <span className="font-mono font-medium">
                              {formatCurrency(parseFloat(transactionData.summary.totalDebits))}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Credits:</span>{" "}
                            <span className="font-mono font-medium">
                              {formatCurrency(parseFloat(transactionData.summary.totalCredits))}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Closing Balance:</span>{" "}
                            <span className="font-mono font-medium">
                              {formatCurrency(parseFloat(transactionData.summary.closingBalance))}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead>Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactionData.transactions.map((tx) => (
                            <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                              <TableCell className="text-sm">
                                {format(new Date(tx.transactionDate), "MMM dd, yyyy")}
                              </TableCell>
                              <TableCell className="text-sm">
                                {tx.description || "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {parseFloat(tx.debitAmount) > 0 
                                  ? formatCurrency(parseFloat(tx.debitAmount))
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {parseFloat(tx.creditAmount) > 0 
                                  ? formatCurrency(parseFloat(tx.creditAmount))
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm font-medium">
                                {formatCurrency(parseFloat(tx.runningBalance))}
                              </TableCell>
                              <TableCell className="text-sm">
                                {tx.sourceDocumentType && tx.sourceDocumentId ? (
                                  <StatusBadge status={tx.sourceDocumentType}>
                                    {tx.sourceDocumentType === 'journal_entry' && tx.journalEntryNumber
                                      ? `JE-${tx.journalEntryNumber}`
                                      : `${tx.sourceDocumentType.toUpperCase()}`}
                                  </StatusBadge>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                          <div className="text-sm text-muted-foreground">
                            Showing {offset + 1} - {Math.min(offset + TRANSACTION_PAGE_SIZE, transactionData.summary.transactionCount)} of {transactionData.summary.transactionCount}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPageChange(currentPage - 1);
                              }}
                              disabled={currentPage === 1}
                              data-testid={`button-prev-page-${account.id}`}
                            >
                              Previous
                            </Button>
                            <div className="flex items-center px-3 text-sm">
                              Page {currentPage} of {totalPages}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPageChange(currentPage + 1);
                              }}
                              disabled={currentPage === totalPages}
                              data-testid={`button-next-page-${account.id}`}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No transactions found for this account
                      {(startDate || endDate) && " in the selected date range"}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
