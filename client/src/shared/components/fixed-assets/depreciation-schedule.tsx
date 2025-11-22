import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/shared/lib/api/queryClient";
import type { FixedAsset } from "@shared/schema";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Badge } from "@/shared/components/ui/badge";
import { Download, Calendar, TrendingDown, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";

interface DepreciationScheduleProps {
  asset: FixedAsset;
  onClose?: () => void;
}

interface ScheduleData {
  asset: FixedAsset;
  schedule: Array<{
    period: string;
    periodDate: string;
    depreciationAmount: string;
    accumulatedDepreciation: string;
    bookValue: string;
  }>;
  recordedDepreciation: Array<{
    id: string;
    periodDate: string;
    depreciationAmount: string;
    accumulatedDepreciation: string;
    bookValue: string;
    journalEntryId?: string;
  }>;
}

export function DepreciationSchedule({ asset, onClose }: DepreciationScheduleProps) {
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("yearly");

  const { data: scheduleData, isLoading } = useQuery<ScheduleData>({
    queryKey: ["/api/fixed-assets", asset.id, "depreciation-schedule"],
    queryFn: () => apiRequest(`/api/fixed-assets/${asset.id}/depreciation-schedule`),
  });

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return "$0.00";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const exportToExcel = () => {
    if (!scheduleData?.schedule) return;

    const worksheetData = scheduleData.schedule.map(row => ({
      Period: row.period,
      Date: row.periodDate,
      "Depreciation Amount": formatCurrency(row.depreciationAmount),
      "Accumulated Depreciation": formatCurrency(row.accumulatedDepreciation),
      "Book Value": formatCurrency(row.bookValue),
    }));

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Depreciation Schedule");

    // Add asset info sheet
    const assetInfo = {
      "Asset Code": asset.assetCode,
      "Asset Name": asset.name,
      "Category": asset.category,
      "Acquisition Date": asset.acquisitionDate ? format(new Date(asset.acquisitionDate), "MMM dd, yyyy") : "",
      "Acquisition Cost": formatCurrency(asset.acquisitionCost),
      "Salvage Value": formatCurrency(asset.salvageValue),
      "Useful Life": `${asset.usefulLifeYears} years`,
      "Depreciation Method": asset.depreciationMethod,
      "Current Book Value": formatCurrency(asset.currentBookValue),
    };
    const wsInfo = XLSX.utils.json_to_sheet([assetInfo]);
    XLSX.utils.book_append_sheet(wb, wsInfo, "Asset Info");

    XLSX.writeFile(wb, `${asset.assetCode}_depreciation_schedule.xlsx`);
  };

  // Prepare data for chart
  const chartData = scheduleData?.schedule?.map((item, index) => ({
    period: viewMode === 'yearly' ? `Year ${index + 1}` : `Month ${index + 1}`,
    bookValue: parseFloat(item.bookValue),
    depreciation: parseFloat(item.depreciationAmount),
    accumulated: parseFloat(item.accumulatedDepreciation),
  })) || [];

  // Group schedule by year if in yearly mode
  const displaySchedule = () => {
    if (!scheduleData?.schedule) return [];

    if (viewMode === "yearly") {
      // Group by year
      const yearlyData: any = {};
      scheduleData.schedule.forEach(item => {
        const year = new Date(item.periodDate).getFullYear();
        if (!yearlyData[year]) {
          yearlyData[year] = {
            year,
            depreciationAmount: 0,
            bookValue: item.bookValue,
            accumulatedDepreciation: item.accumulatedDepreciation,
            periods: []
          };
        }
        yearlyData[year].depreciationAmount += parseFloat(item.depreciationAmount);
        yearlyData[year].bookValue = item.bookValue;
        yearlyData[year].accumulatedDepreciation = item.accumulatedDepreciation;
        yearlyData[year].periods.push(item);
      });
      return Object.values(yearlyData);
    } else {
      return scheduleData.schedule;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Depreciation Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Depreciation Schedule</CardTitle>
              <CardDescription>
                {asset.name} ({asset.assetCode})
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                data-testid="button-export-excel"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export to Excel
              </Button>
              {onClose && (
                <Button variant="outline" size="sm" onClick={onClose} data-testid="button-close">
                  Close
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Asset Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Acquisition Cost</p>
              <p className="text-lg font-bold">{formatCurrency(asset.acquisitionCost)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Book Value</p>
              <p className="text-lg font-bold">{formatCurrency(asset.currentBookValue)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Accumulated Depreciation</p>
              <p className="text-lg font-bold">
                {formatCurrency(
                  parseFloat(asset.acquisitionCost || '0') - parseFloat(asset.currentBookValue || '0')
                )}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Method</p>
              <Badge variant="outline">
                {asset.depreciationMethod === 'straight-line' ? 'Straight Line' :
                 asset.depreciationMethod === 'declining-balance' ? 'Declining Balance' :
                 'None'}
              </Badge>
            </div>
          </div>

          <Tabs defaultValue="schedule" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="chart">Chart</TabsTrigger>
              <TabsTrigger value="recorded">Recorded</TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="space-y-4">
              <div className="flex justify-end">
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === "monthly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("monthly")}
                    data-testid="button-view-monthly"
                  >
                    Monthly
                  </Button>
                  <Button
                    variant={viewMode === "yearly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("yearly")}
                    data-testid="button-view-yearly"
                  >
                    Yearly
                  </Button>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{viewMode === "yearly" ? "Year" : "Period"}</TableHead>
                      <TableHead>Depreciation Amount</TableHead>
                      <TableHead>Accumulated Depreciation</TableHead>
                      <TableHead>Book Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displaySchedule().map((row: any, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {viewMode === "yearly" ? 
                            row.year : 
                            format(new Date(row.periodDate), "MMM yyyy")
                          }
                        </TableCell>
                        <TableCell>
                          {formatCurrency(row.depreciationAmount)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(row.accumulatedDepreciation)}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(row.bookValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="chart" className="space-y-4">
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(value)}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="bookValue" 
                      stroke="hsl(var(--primary))" 
                      name="Book Value"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="accumulated" 
                      stroke="hsl(var(--destructive))" 
                      name="Accumulated Depreciation"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="recorded" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Accumulated</TableHead>
                      <TableHead>Book Value</TableHead>
                      <TableHead>Journal Entry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduleData?.recordedDepreciation?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          No depreciation recorded yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      scheduleData?.recordedDepreciation?.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {format(new Date(record.periodDate), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>{formatCurrency(record.depreciationAmount)}</TableCell>
                          <TableCell>{formatCurrency(record.accumulatedDepreciation)}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(record.bookValue)}
                          </TableCell>
                          <TableCell>
                            {record.journalEntryId ? (
                              <Badge variant="outline">{record.journalEntryId}</Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}