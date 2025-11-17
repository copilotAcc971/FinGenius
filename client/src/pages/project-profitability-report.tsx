import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { Link } from "wouter";

export default function ProjectProfitabilityReport() {
  const { currentTenant } = useTenant();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const currencySymbol = currentTenant?.defaultCurrency === 'USD' ? '$' : 
                        currentTenant?.defaultCurrency === 'EUR' ? '€' : 
                        currentTenant?.defaultCurrency === 'GBP' ? '£' : 
                        currentTenant?.defaultCurrency === 'AED' ? 'د.إ' : '$';

  const { data: summary, isLoading } = useQuery({
    queryKey: ['/api/reports/projects/profitability', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/reports/projects/profitability?${params}`);
      if (!response.ok) throw new Error('Failed to fetch profitability report');
      return response.json();
    },
    enabled: !!currentTenant?.id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2" data-testid="heading-profitability-report">
          Project Profitability Report
        </h1>
        <p className="text-muted-foreground">
          View profitability metrics across all projects
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <CardTitle>Project Profitability Summary</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="filter-status">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : summary && summary.length > 0 ? (
            <div className="rounded-md border">
              <Table data-testid="table-profitability">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Project</TableHead>
                    <TableHead className="font-semibold">Customer</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">Revenue</TableHead>
                    <TableHead className="font-semibold text-right">Costs</TableHead>
                    <TableHead className="font-semibold text-right">Profit</TableHead>
                    <TableHead className="font-semibold text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((project: any) => (
                    <TableRow key={project.projectId} data-testid={`row-project-${project.projectId}`}>
                      <TableCell>
                        <Link href={`/projects/${project.projectId}`}>
                          <span className="text-primary hover:underline cursor-pointer" data-testid={`link-project-${project.projectId}`}>
                            {project.projectName}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>{project.customerName}</TableCell>
                      <TableCell>
                        <span className="capitalize">{project.status.replace('_', ' ')}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`revenue-${project.projectId}`}>
                        {currencySymbol}{parseFloat(project.totalRevenue).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`costs-${project.projectId}`}>
                        {currencySymbol}{parseFloat(project.totalCosts).toLocaleString()}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-medium ${parseFloat(project.totalProfit) < 0 ? 'text-destructive' : 'text-green-600'}`} data-testid={`profit-${project.projectId}`}>
                        {currencySymbol}{parseFloat(project.totalProfit).toLocaleString()}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${parseFloat(project.profitMargin) < 0 ? 'text-destructive' : 'text-green-600'}`} data-testid={`margin-${project.projectId}`}>
                        {parseFloat(project.profitMargin).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>No projects found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
