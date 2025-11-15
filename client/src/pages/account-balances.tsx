import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/currency-utils";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Account } from "@shared/schema";

interface BalanceHistoryItem {
  date: string;
  balance: string;
  debit: string;
  credit: string;
  entryType: string | null;
  entryId: string | null;
  description: string | null;
}

interface BalanceHistoryResponse {
  account: Account;
  openingBalance: string;
  currentBalance: string;
  balanceHistory: BalanceHistoryItem[];
}

const ITEMS_PER_PAGE = 50;

export default function AccountBalances() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(1);

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

  const { data: balanceData, isLoading: balanceLoading } = useQuery<BalanceHistoryResponse>({
    queryKey: [
      `/api/accounts/${selectedAccountId}/balances`,
      {
        tenantId: currentTenant?.id,
        accountId: selectedAccountId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    ],
    queryFn: async () => {
      if (!selectedAccountId || !startDate) return null;
      
      const params = new URLSearchParams({
        startDate: startDate.toISOString().split('T')[0],
        ...(endDate && { endDate: endDate.toISOString().split('T')[0] })
      });
      
      const response = await fetch(
        `/api/accounts/${selectedAccountId}/balances?${params.toString()}`,
        {
          headers: {
            'x-tenant-id': currentTenant?.id || '',
          },
          credentials: 'include',
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      return response.json();
    },
    enabled: !!currentTenant?.id && !!selectedAccountId && !!startDate,
  });

  const handleClearFilters = () => {
    setSelectedAccountId("");
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    setStartDate(defaultStartDate);
    setEndDate(new Date());
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy");
  };

  const formatAmount = (amount: string) => {
    return formatCurrency(parseFloat(amount));
  };

  const chartData = useMemo(() => {
    if (!balanceData?.balanceHistory) return [];
    return balanceData.balanceHistory.map(item => ({
      date: formatDate(item.date),
      balance: parseFloat(item.balance),
      dateRaw: item.date,
    }));
  }, [balanceData]);

  const paginatedTransactions = useMemo(() => {
    if (!balanceData?.balanceHistory) return [];
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return balanceData.balanceHistory.slice().reverse().slice(start, end);
  }, [balanceData, currentPage]);

  const totalPages = Math.ceil((balanceData?.balanceHistory.length || 0) / ITEMS_PER_PAGE);

  const getEntryTypeLabel = (entryType: string | null) => {
    if (!entryType) return "Journal Entry";
    
    const labels: Record<string, string> = {
      journal_entry: "Journal Entry",
      invoice: "Invoice",
      bill: "Bill",
      payment: "Vendor Payment",
      customer_payment: "Customer Payment",
      credit_note: "Credit Note",
      debit_note: "Debit Note",
      expense: "Expense",
      fixed_asset: "Fixed Asset",
      inventory_adjustment: "Inventory Adj.",
      depreciation: "Depreciation",
      payment_batch: "Payment Batch",
      approval: "Approval",
    };
    
    return labels[entryType] || entryType;
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Account Balance History</h1>
        <p className="text-muted-foreground">View historical balances and transactions for accounts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select an account and date range to view balance history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Account</label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger data-testid="select-account">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accountsLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading accounts...
                    </SelectItem>
                  ) : accounts.length === 0 ? (
                    <SelectItem value="no-accounts" disabled>
                      No accounts available
                    </SelectItem>
                  ) : (
                    accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start" data-testid="button-start-date">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(startDate, "MMM dd, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start" data-testid="button-end-date">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(endDate, "MMM dd, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium opacity-0">Actions</label>
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full"
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedAccountId && balanceData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Opening Balance</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold font-mono" data-testid="text-opening-balance">
                  {formatAmount(balanceData.openingBalance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  As of {format(startDate, "MMM dd, yyyy")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
                {parseFloat(balanceData.currentBalance) >= parseFloat(balanceData.openingBalance) ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold font-mono" data-testid="text-current-balance">
                  {formatAmount(balanceData.currentBalance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {balanceData.account.name} ({balanceData.account.code})
                </p>
              </CardContent>
            </Card>
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Balance Timeline</CardTitle>
                <CardDescription>Balance changes over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => formatAmount(value.toString())}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="balance"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Showing {paginatedTransactions.length} of {balanceData.balanceHistory.length} transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {balanceData.balanceHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
                  <p className="text-lg font-medium mb-2">No transactions found</p>
                  <p className="text-sm text-muted-foreground">
                    No transactions in the selected date range
                  </p>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Entry Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Running Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTransactions.map((transaction, index) => (
                          <TableRow key={`${transaction.date}-${index}`} data-testid={`row-transaction-${index}`}>
                            <TableCell className="font-medium" data-testid={`text-date-${index}`}>
                              {formatDate(transaction.date)}
                            </TableCell>
                            <TableCell data-testid={`text-entry-type-${index}`}>
                              {getEntryTypeLabel(transaction.entryType)}
                            </TableCell>
                            <TableCell data-testid={`text-description-${index}`}>
                              {transaction.description || "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono" data-testid={`text-debit-${index}`}>
                              {parseFloat(transaction.debit) > 0 ? formatAmount(transaction.debit) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono" data-testid={`text-credit-${index}`}>
                              {parseFloat(transaction.credit) > 0 ? formatAmount(transaction.credit) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold" data-testid={`text-balance-${index}`}>
                              {formatAmount(transaction.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          data-testid="button-prev-page"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          data-testid="button-next-page"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {selectedAccountId && balanceLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-40" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-40" />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedAccountId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <p className="text-lg font-medium mb-2">Select an account to view balance history</p>
            <p className="text-sm text-muted-foreground">
              Choose an account from the filters above to get started
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
