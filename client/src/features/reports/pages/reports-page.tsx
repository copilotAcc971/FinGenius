import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileBarChart, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";

export default function Reports() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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
        <p className="text-muted-foreground">Comprehensive financial insights and statements</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover-elevate cursor-pointer" data-testid="card-profit-loss">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle>Profit & Loss</CardTitle>
            <CardDescription>
              Income statement showing revenue and expenses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" data-testid="button-view-pl">
              View Report
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" data-testid="card-balance-sheet">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle>Balance Sheet</CardTitle>
            <CardDescription>
              Assets, liabilities, and equity overview
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" data-testid="button-view-balance">
              View Report
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" data-testid="card-accounts-payable">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileBarChart className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle>Accounts Payable</CardTitle>
            <CardDescription>
              Outstanding bills and vendor payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" data-testid="button-view-payables">
              View Report
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Options</CardTitle>
          <CardDescription>Customize your financial reports</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Date Range</label>
              <select className="w-full h-10 px-3 py-2 border rounded-md">
                <option>This Month</option>
                <option>Last Month</option>
                <option>This Quarter</option>
                <option>This Year</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Format</label>
              <select className="w-full h-10 px-3 py-2 border rounded-md">
                <option>PDF</option>
                <option>Excel</option>
                <option>CSV</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button data-testid="button-generate-report">Generate Report</Button>
            <Button variant="outline" data-testid="button-export-report">Export</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
