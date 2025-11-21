import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, RefreshCw } from 'lucide-react';
import { queryClient, apiRequest } from '@/shared/lib/api/queryClient';
import { useToast } from '@/shared/hooks/use-toast';

interface PAndLData {
  name: string;
  revenue: number;
  expenses: number;
  margin: number;
}

interface BalanceSheetData {
  assets: number;
  liabilities: number;
  equity: number;
}

interface CashFlowData {
  period: string;
  operating: number;
  investing: number;
  financing: number;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<'p_and_l' | 'balance_sheet' | 'cash_flow'>('p_and_l');

  // P&L Data
  const pLData: PAndLData[] = [
    { name: 'Q1', revenue: 125000, expenses: 85000, margin: 32 },
    { name: 'Q2', revenue: 145000, expenses: 92000, margin: 37 },
    { name: 'Q3', revenue: 165000, expenses: 98000, margin: 41 },
    { name: 'Q4', revenue: 155000, expenses: 95000, margin: 39 },
  ];

  // Balance Sheet Data
  const bsData = {
    assets: 500000,
    liabilities: 200000,
    equity: 300000,
  };

  // Cash Flow Data
  const cfData: CashFlowData[] = [
    { period: 'Q1', operating: 85000, investing: -20000, financing: -15000 },
    { period: 'Q2', operating: 92000, investing: -25000, financing: -10000 },
    { period: 'Q3', operating: 98000, investing: -15000, financing: -20000 },
    { period: 'Q4', operating: 95000, investing: -30000, financing: -5000 },
  ];

  // Fetch reports
  const { data: reports, isLoading } = useQuery({
    queryKey: ['/api/reports'],
    queryFn: async () => {
      const response = await apiRequest('/api/reports', { method: 'GET' });
      return response || [];
    },
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (reportType: string) => {
      return apiRequest('/api/reports/generate', {
        method: 'POST',
        body: { reportType },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      toast({ title: 'Report generated successfully' });
    },
  });

  // Export report mutation
  const exportReportMutation = useMutation({
    mutationFn: async (payload: { reportId: number; format: 'csv' | 'excel' | 'pdf' }) => {
      return apiRequest(`/api/reports/${payload.reportId}/export`, {
        method: 'POST',
        body: { format: payload.format },
      });
    },
    onSuccess: () => {
      toast({ title: 'Report exported successfully' });
    },
  });

  return (
    <div className="space-y-6" data-testid="page-reports">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="heading-reports">Financial Reports</h1>
        <Button
          onClick={() => generateReportMutation.mutate(selectedReport)}
          disabled={generateReportMutation.isPending}
          data-testid="button-generate-report"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>

      <Tabs value={selectedReport} onValueChange={(v: any) => setSelectedReport(v)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="p_and_l" data-testid="tab-p-and-l">
            P&L Statement
          </TabsTrigger>
          <TabsTrigger value="balance_sheet" data-testid="tab-balance-sheet">
            Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="cash_flow" data-testid="tab-cash-flow">
            Cash Flow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="p_and_l" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4" data-testid="heading-p-and-l">
              Profit & Loss Statement
            </h2>
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pLData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="margin" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <Card className="p-4 bg-muted">
                <p className="text-sm text-muted-foreground" data-testid="label-total-revenue">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold" data-testid="text-total-revenue">
                  AED 590,000
                </p>
              </Card>
              <Card className="p-4 bg-muted">
                <p className="text-sm text-muted-foreground" data-testid="label-total-expenses">
                  Total Expenses
                </p>
                <p className="text-2xl font-bold" data-testid="text-total-expenses">
                  AED 370,000
                </p>
              </Card>
              <Card className="p-4 bg-muted">
                <p className="text-sm text-muted-foreground" data-testid="label-net-income">
                  Net Income
                </p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-net-income">
                  AED 220,000
                </p>
              </Card>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="balance_sheet" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4" data-testid="heading-balance-sheet">
              Balance Sheet
            </h2>
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Assets', value: bsData.assets },
                      { name: 'Liabilities', value: bsData.liabilities },
                      { name: 'Equity', value: bsData.equity },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: AED ${value.toLocaleString()}`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#ef4444" />
                    <Cell fill="#10b981" />
                  </Pie>
                  <Tooltip formatter={(value: any) => `AED ${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <Card className="p-4 bg-muted">
                <p className="text-sm text-muted-foreground" data-testid="label-total-assets">
                  Total Assets
                </p>
                <p className="text-2xl font-bold" data-testid="text-total-assets">
                  AED 500,000
                </p>
              </Card>
              <Card className="p-4 bg-muted">
                <p className="text-sm text-muted-foreground" data-testid="label-total-liabilities">
                  Total Liabilities
                </p>
                <p className="text-2xl font-bold" data-testid="text-total-liabilities">
                  AED 200,000
                </p>
              </Card>
              <Card className="p-4 bg-muted">
                <p className="text-sm text-muted-foreground" data-testid="label-total-equity">
                  Total Equity
                </p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-total-equity">
                  AED 300,000
                </p>
              </Card>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="cash_flow" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4" data-testid="heading-cash-flow">
              Cash Flow Statement
            </h2>
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cfData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `AED ${value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="operating" fill="#3b82f6" />
                  <Bar dataKey="investing" fill="#ef4444" />
                  <Bar dataKey="financing" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <Card className="p-4 bg-muted">
                <p className="text-sm text-muted-foreground" data-testid="label-operating-cf">
                  Operating CF
                </p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-operating-cf">
                  AED 370,000
                </p>
              </Card>
              <Card className="p-4 bg-muted">
                <p className="text-sm text-muted-foreground" data-testid="label-investing-cf">
                  Investing CF
                </p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-investing-cf">
                  -AED 90,000
                </p>
              </Card>
              <Card className="p-4 bg-muted">
                <p className="text-sm text-muted-foreground" data-testid="label-financing-cf">
                  Financing CF
                </p>
                <p className="text-2xl font-bold text-amber-600" data-testid="text-financing-cf">
                  -AED 50,000
                </p>
              </Card>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Options */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4" data-testid="heading-export-options">
          Export Report
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exportReportMutation.mutate({ reportId: 1, format: 'csv' })}
            disabled={exportReportMutation.isPending}
            data-testid="button-export-csv"
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => exportReportMutation.mutate({ reportId: 1, format: 'excel' })}
            disabled={exportReportMutation.isPending}
            data-testid="button-export-excel"
          >
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => exportReportMutation.mutate({ reportId: 1, format: 'pdf' })}
            disabled={exportReportMutation.isPending}
            data-testid="button-export-pdf"
          >
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </Card>
    </div>
  );
}
