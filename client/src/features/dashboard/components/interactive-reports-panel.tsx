import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface ComparisonData {
  current: { revenue: number; expenses: number; profit: number; margin: number };
  previous: { revenue: number; expenses: number; profit: number; margin: number };
  variance: { revenue: { amount: number; percentage: number }; expenses: { amount: number; percentage: number }; profit: { amount: number; percentage: number } };
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981'];

function VarianceIndicator({ variance }: { variance: { amount: number; percentage: number } }) {
  const isPositive = variance.amount > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${isPositive ? 'text-green-600' : 'text-red-600'}`} />
      <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
        {variance.percentage > 0 ? '+' : ''}{variance.percentage.toFixed(1)}%
      </span>
    </div>
  );
}

export function InteractiveReportsPanel() {
  const [comparisonType, setComparisonType] = useState<'month' | 'quarter' | 'year'>('month');

  const { data: trendData } = useQuery({
    queryKey: ['/api/reports/trend'],
    queryFn: async () => {
      const res = await fetch(`/api/reports/trend?days=30`);
      if (!res.ok) return null;
      return res.json();
    }
  });

  const { data: comparisonData } = useQuery<ComparisonData>({
    queryKey: ['/api/reports/compare', comparisonType],
    queryFn: async () => {
      const res = await fetch(`/api/reports/compare?type=${comparisonType}`);
      if (!res.ok) return null;
      return res.json();
    }
  });

  return (
    <div className="space-y-6" data-testid="panel-interactive-reports">
      <Card>
        <CardHeader>
          <CardTitle>Period Comparison</CardTitle>
          <div className="flex gap-2 mt-4">
            {(['month', 'quarter', 'year'] as const).map(type => (
              <Button
                key={type}
                size="sm"
                variant={comparisonType === type ? 'default' : 'outline'}
                onClick={() => setComparisonType(type)}
                className="capitalize"
                data-testid={`button-compare-${type}`}
              >
                {type === 'month' ? 'MoM' : type === 'quarter' ? 'QoQ' : 'YoY'}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {comparisonData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold" data-testid="text-revenue">${comparisonData.current.revenue.toFixed(0)}</p>
                <VarianceIndicator variance={comparisonData.variance.revenue} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Expenses</p>
                <p className="text-2xl font-bold" data-testid="text-expenses">${comparisonData.current.expenses.toFixed(0)}</p>
                <VarianceIndicator variance={comparisonData.variance.expenses} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className="text-2xl font-bold" data-testid="text-profit">${comparisonData.current.profit.toFixed(0)}</p>
                <VarianceIndicator variance={comparisonData.variance.profit} />
                <Badge variant="outline">{comparisonData.current.margin.toFixed(1)}% margin</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {trendData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              30-Day Trend
            </CardTitle>
          </CardHeader>
          <CardContent data-testid="chart-trend">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value: any) => `$${value.toFixed(0)}`} />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                <Line type="monotone" dataKey="profit" stroke="#10b981" name="Profit" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {comparisonData && (
        <Card>
          <CardHeader>
            <CardTitle>P&L Distribution</CardTitle>
          </CardHeader>
          <CardContent data-testid="chart-distribution">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Revenue', value: comparisonData.current.revenue },
                    { name: 'Expenses', value: comparisonData.current.expenses }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: $${value.toFixed(0)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `$${value.toFixed(0)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default InteractiveReportsPanel;
