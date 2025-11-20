import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Filter, Search, CheckCheck, X, AlertCircle, Clock, TrendingUp, DollarSign, FileText, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import type { AlertInstance } from "@shared/schema";
import { format } from "date-fns";

const alertTypeIcons: Record<string, typeof AlertCircle> = {
  cash_deficiency: DollarSign,
  aged_ar: Clock,
  aged_ap: Clock,
  pending_approval: FileText,
  accrual_suggestion: TrendingUp,
  month_end: AlertCircle,
  compliance_deadline: AlertTriangle,
  anomaly: AlertTriangle,
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-600 dark:bg-red-600",
  high: "bg-orange-600 dark:bg-orange-600",
  medium: "bg-amber-600 dark:bg-amber-600",
  low: "bg-blue-600 dark:bg-blue-600",
};

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  viewed: "secondary",
  actioned: "outline",
  dismissed: "destructive",
  expired: "destructive",
};

export default function AlertsCenterPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("new");
  const [sortBy, setSortBy] = useState<"date" | "priority">("date");

  const { data: alerts, isLoading } = useQuery<AlertInstance[]>({
    queryKey: ["/api/alerts", currentTenant?.id, selectedPriority, selectedType, selectedStatus],
    enabled: !!currentTenant,
  });

  const handleMarkAsViewed = async (alertId: string) => {
    try {
      await apiRequest(`/api/alerts/${alertId}/viewed`, {
        method: "PATCH",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert marked as viewed",
        description: "The alert has been updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update alert status",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await apiRequest(`/api/alerts/${alertId}/dismiss`, {
        method: "PATCH",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert dismissed",
        description: "The alert has been dismissed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to dismiss alert",
        variant: "destructive",
      });
    }
  };

  const handleMarkAllAsViewed = async () => {
    try {
      await apiRequest(`/api/alerts/mark-all-viewed`, {
        method: "POST",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "All alerts marked as viewed",
        description: "Successfully updated all alerts",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update alerts",
        variant: "destructive",
      });
    }
  };

  const filteredAlerts = alerts?.filter((alert) => {
    if (selectedPriority !== "all" && alert.priority !== selectedPriority) return false;
    if (selectedType !== "all" && alert.alertType !== selectedType) return false;
    if (selectedStatus !== "all" && alert.status !== selectedStatus) return false;
    if (searchQuery && !alert.title.toLowerCase().includes(searchQuery.toLowerCase()) && !alert.message.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === "priority") {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
    }
    return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
  });

  const AlertIcon = ({ type }: { type: string }) => {
    const Icon = alertTypeIcons[type] || AlertCircle;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Alert Center
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Monitor and manage all system alerts and notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleMarkAllAsViewed}
            disabled={!filteredAlerts?.some(a => a.status === "new")}
            data-testid="button-mark-all-viewed"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All as Viewed
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                <Input
                  placeholder="Search alerts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-alerts"
                />
              </div>
            </div>
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger data-testid="select-priority">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger data-testid="select-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="cash_deficiency">Cash Deficiency</SelectItem>
                <SelectItem value="aged_ar">Aged Receivables</SelectItem>
                <SelectItem value="aged_ap">Aged Payables</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="accrual_suggestion">Accrual Suggestion</SelectItem>
                <SelectItem value="month_end">Month End</SelectItem>
                <SelectItem value="compliance_deadline">Compliance Deadline</SelectItem>
                <SelectItem value="anomaly">Anomaly</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "date" | "priority")}>
              <SelectTrigger data-testid="select-sort">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Status Tabs */}
      <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
        <TabsList className="grid w-full grid-cols-5" data-testid="tabs-status">
          <TabsTrigger value="new" data-testid="tab-new">New</TabsTrigger>
          <TabsTrigger value="viewed" data-testid="tab-viewed">Viewed</TabsTrigger>
          <TabsTrigger value="actioned" data-testid="tab-actioned">Actioned</TabsTrigger>
          <TabsTrigger value="dismissed" data-testid="tab-dismissed">Dismissed</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Alerts List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAlerts && filteredAlerts.length > 0 ? (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <Card key={alert.id} className="hover-elevate" data-testid={`card-alert-${alert.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`rounded-full p-2 ${priorityColors[alert.priority]}`}>
                      <AlertIcon type={alert.alertType} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg font-medium text-gray-900 dark:text-white">
                          {alert.title}
                        </CardTitle>
                        <Badge variant={statusVariants[alert.status]} className="capitalize" data-testid={`badge-status-${alert.status}`}>
                          {alert.status}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                        {alert.message}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.status === "new" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkAsViewed(alert.id)}
                        data-testid={`button-mark-viewed-${alert.id}`}
                      >
                        <CheckCheck className="h-4 w-4 mr-1" />
                        Mark Viewed
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDismiss(alert.id)}
                      data-testid={`button-dismiss-${alert.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(alert.createdAt!), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                    <Badge variant="outline" className="capitalize">
                      {alert.alertType.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {alert.priority}
                    </Badge>
                  </div>
                  {alert.quickActions && Array.isArray(alert.quickActions) && alert.quickActions.length > 0 && (
                    <div className="flex gap-2">
                      {(alert.quickActions as any[]).slice(0, 2).map((action: any, idx: number) => (
                        <Button
                          key={idx}
                          size="sm"
                          variant="outline"
                          data-testid={`button-quick-action-${idx}`}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No active alerts
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
              You're all caught up! There are no alerts matching your current filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
