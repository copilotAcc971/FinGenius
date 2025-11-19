import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Send, Check, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useRBAC } from "@/shared/contexts/rbac-context";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import type { TimeEntry, Project } from "@shared/schema";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO } from "date-fns";

export default function Timesheets() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [billableFilter, setBillableFilter] = useState<string>("all");
  
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { hasPermission } = useRBAC();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: timeEntries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries", {
      tenantId: currentTenant?.id,
      startDate: format(weekStart, "yyyy-MM-dd"),
      endDate: format(weekEnd, "yyyy-MM-dd"),
    }],
    enabled: !!currentTenant?.id,
  });

  const submitTimesheetMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/time-entries/bulk-submit?tenantId=${currentTenant.id}`, "POST", { entryIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/time-entries", {
          tenantId: currentTenant?.id,
          startDate: format(weekStart, "yyyy-MM-dd"),
          endDate: format(weekEnd, "yyyy-MM-dd"),
        }]
      });
      toast({
        title: "Timesheet submitted",
        description: "Your timesheet has been submitted for approval.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit timesheet.",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/time-entries/${id}?tenantId=${currentTenant.id}`, "PATCH", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/time-entries", {
          tenantId: currentTenant?.id,
          startDate: format(weekStart, "yyyy-MM-dd"),
          endDate: format(weekEnd, "yyyy-MM-dd"),
        }]
      });
      toast({
        title: "Status updated",
        description: "Time entry status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status.",
        variant: "destructive",
      });
    },
  });

  const filteredEntries = timeEntries.filter((entry) => {
    const matchesProject = projectFilter === "all" || entry.projectId === projectFilter;
    const matchesBillable = billableFilter === "all" || 
      (billableFilter === "billable" && entry.isBillable) ||
      (billableFilter === "non-billable" && !entry.isBillable);
    return matchesProject && matchesBillable;
  });

  const getEntriesForDay = (day: Date) => {
    return filteredEntries.filter(entry => 
      isSameDay(parseISO(entry.date), day)
    );
  };

  const getDayTotal = (day: Date) => {
    return getEntriesForDay(day).reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
  };

  const weekTotal = filteredEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);

  const draftEntries = filteredEntries.filter(e => e.status === "draft");

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      submitted: "outline",
      approved: "default",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const handleExportCSV = () => {
    const headers = ["Date", "Project", "Description", "Hours", "Billable", "Status"];
    const rows = filteredEntries.map(entry => {
      const project = projects.find(p => p.id === entry.projectId);
      return [
        format(parseISO(entry.date), "yyyy-MM-dd"),
        project?.name || "Unknown",
        entry.description,
        entry.hours,
        entry.isBillable ? "Yes" : "No",
        entry.status,
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesheet-${format(weekStart, "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">Please select or create an organization to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Timesheets</h1>
          <p className="text-muted-foreground mt-1">Review and submit your weekly timesheets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          {draftEntries.length > 0 && (
            <Button
              onClick={() => submitTimesheetMutation.mutate(draftEntries.map(e => e.id))}
              data-testid="button-submit-timesheet"
            >
              <Send className="h-4 w-4 mr-2" />
              Submit Timesheet ({draftEntries.length})
            </Button>
          )}
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}
              data-testid="button-prev-week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold min-w-64 text-center" data-testid="text-week-range">
              {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}
              data-testid="button-next-week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentWeek(new Date())}
              data-testid="button-current-week"
            >
              This Week
            </Button>
          </div>

          <div className="flex gap-2">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-48" data-testid="select-project-filter">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={billableFilter} onValueChange={setBillableFilter}>
              <SelectTrigger className="w-40" data-testid="select-billable-filter">
                <SelectValue placeholder="Billable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="billable">Billable</SelectItem>
                <SelectItem value="non-billable">Non-Billable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Project</TableHead>
                    {weekDays.map((day) => (
                      <TableHead key={day.toISOString()} className="font-semibold text-center min-w-24">
                        <div>{format(day, "EEE")}</div>
                        <div className="text-xs font-normal text-muted-foreground">{format(day, "MMM d")}</div>
                      </TableHead>
                    ))}
                    <TableHead className="font-semibold text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.filter(p => filteredEntries.some(e => e.projectId === p.id)).map((project) => {
                    const projectEntries = filteredEntries.filter(e => e.projectId === project.id);
                    const projectTotal = projectEntries.reduce((sum, e) => sum + parseFloat(e.hours), 0);

                    return (
                      <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        {weekDays.map((day) => {
                          const dayEntries = projectEntries.filter(e => isSameDay(parseISO(e.date), day));
                          const dayTotal = dayEntries.reduce((sum, e) => sum + parseFloat(e.hours), 0);
                          return (
                            <TableCell key={day.toISOString()} className="text-center font-mono">
                              {dayTotal > 0 ? dayTotal.toFixed(2) : "-"}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right font-mono font-semibold">
                          {projectTotal.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell>Daily Total</TableCell>
                    {weekDays.map((day) => (
                      <TableCell key={day.toISOString()} className="text-center font-mono" data-testid={`total-${format(day, "yyyy-MM-dd")}`}>
                        {getDayTotal(day).toFixed(2)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-lg" data-testid="text-week-total">
                      {weekTotal.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Time Entry Details</h3>
              {filteredEntries.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground" data-testid="text-no-entries">
                  No time entries for this week.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Project</TableHead>
                        <TableHead className="font-semibold">Description</TableHead>
                        <TableHead className="font-semibold text-right">Hours</TableHead>
                        <TableHead className="font-semibold">Billable</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        {hasPermission("time_entries:approve") && (
                          <TableHead className="font-semibold text-right">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => {
                        const project = projects.find(p => p.id === entry.projectId);
                        return (
                          <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                            <TableCell>{format(parseISO(entry.date), "MMM d, yyyy")}</TableCell>
                            <TableCell>{project?.name || "Unknown"}</TableCell>
                            <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                            <TableCell className="text-right font-mono">{parseFloat(entry.hours).toFixed(2)}</TableCell>
                            <TableCell>{entry.isBillable ? "Yes" : "No"}</TableCell>
                            <TableCell>{getStatusBadge(entry.status)}</TableCell>
                            {hasPermission("time_entries:approve") && (
                              <TableCell className="text-right">
                                {entry.status === "submitted" && (
                                  <div className="flex gap-1 justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "approved" })}
                                      data-testid={`button-approve-${entry.id}`}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "rejected" })}
                                      data-testid={`button-reject-${entry.id}`}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
