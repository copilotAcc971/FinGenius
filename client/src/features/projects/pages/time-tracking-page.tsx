import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Play, Pause, Square, Clock, Plus, Edit, Trash2, Send } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Checkbox } from "@/shared/components/ui/checkbox";
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
import type { Project, TimeEntry, ProjectTask } from "@shared/schema";
import { format, startOfToday, subDays } from "date-fns";

interface TimerState {
  isRunning: boolean;
  startTime: number | null;
  totalElapsed: number;
  projectId: string;
  taskId: string;
  description: string;
  isBillable: boolean;
}

const TIMER_STORAGE_KEY = "time-tracker-state";

function loadTimerState(): TimerState | null {
  const stored = localStorage.getItem(TIMER_STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return null;
}

function saveTimerState(state: TimerState) {
  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
}

function clearTimerState() {
  localStorage.removeItem(TIMER_STORAGE_KEY);
}

export default function TimeTracking() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { hasPermission } = useRBAC();

  const initialState = loadTimerState() || {
    isRunning: false,
    startTime: null,
    totalElapsed: 0,
    projectId: "",
    taskId: "",
    description: "",
    isBillable: true,
  };

  const [timerState, setTimerState] = useState<TimerState>(initialState);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects", { tenantId: currentTenant?.id, status: "active" }],
    enabled: !!currentTenant?.id,
  });

  const { data: tasks = [] } = useQuery<ProjectTask[]>({
    queryKey: ["/api/project-tasks", { projectId: timerState.projectId, tenantId: currentTenant?.id }],
    enabled: !!timerState.projectId && !!currentTenant?.id,
  });

  const today = format(startOfToday(), "yyyy-MM-dd");
  const sevenDaysAgo = format(subDays(startOfToday(), 7), "yyyy-MM-dd");

  const { data: recentEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries", { tenantId: currentTenant?.id, startDate: sevenDaysAgo, endDate: today }],
    enabled: !!currentTenant?.id,
  });

  const { data: todayEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries", { tenantId: currentTenant?.id, date: today }],
    enabled: !!currentTenant?.id,
  });

  const createTimeEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/time-entries?tenantId=${currentTenant.id}`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries", { tenantId: currentTenant?.id }] });
      clearTimerState();
      setTimerState({
        isRunning: false,
        startTime: null,
        totalElapsed: 0,
        projectId: "",
        taskId: "",
        description: "",
        isBillable: true,
      });
      toast({
        title: "Time entry saved",
        description: "Your time has been recorded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save time entry.",
        variant: "destructive",
      });
    },
  });

  const deleteTimeEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/time-entries/${id}?tenantId=${currentTenant.id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries", { tenantId: currentTenant?.id }] });
      toast({
        title: "Time entry deleted",
        description: "Entry has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete time entry.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timerState.isRunning && timerState.startTime) {
      interval = setInterval(() => {
        setTimerState(prev => {
          if (!prev.startTime) return prev;
          
          const currentSessionElapsed = Math.floor((Date.now() - prev.startTime) / 1000);
          const newState = {
            ...prev,
            totalElapsed: prev.totalElapsed + currentSessionElapsed,
            startTime: Date.now()
          };
          saveTimerState(newState);
          return newState;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerState.isRunning]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStart = () => {
    if (!timerState.projectId) {
      toast({
        title: "Project required",
        description: "Please select a project before starting the timer.",
        variant: "destructive",
      });
      return;
    }

    const newState = {
      ...timerState,
      isRunning: true,
      startTime: Date.now(),
    };
    setTimerState(newState);
    saveTimerState(newState);
  };

  const handlePause = () => {
    setTimerState(prev => {
      if (!prev.startTime) return prev;
      const sessionElapsed = Math.floor((Date.now() - prev.startTime) / 1000);
      const newState = {
        ...prev,
        isRunning: false,
        totalElapsed: prev.totalElapsed + sessionElapsed,
        startTime: null
      };
      saveTimerState(newState);
      return newState;
    });
  };

  const handleStop = () => {
    if (!timerState.description.trim()) {
      toast({
        title: "Description required",
        description: "Please add a description before stopping the timer.",
        variant: "destructive",
      });
      return;
    }

    const finalElapsed = timerState.startTime
      ? timerState.totalElapsed + Math.floor((Date.now() - timerState.startTime) / 1000)
      : timerState.totalElapsed;

    const hours = finalElapsed / 3600;
    const minutes = Math.floor((finalElapsed % 3600) / 60);

    createTimeEntryMutation.mutate({
      projectId: timerState.projectId,
      taskId: timerState.taskId || undefined,
      description: timerState.description,
      date: format(new Date(), "yyyy-MM-dd"),
      hours: hours.toFixed(2),
      minutes,
      isBillable: timerState.isBillable,
      status: "draft",
    });
  };

  const todayTotal = todayEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);

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
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">Time Tracking</h1>
        <p className="text-muted-foreground mt-1">Track your time and manage timesheets</p>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Active Timer</h2>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Project *</label>
              <Select
                value={timerState.projectId}
                onValueChange={(value) => setTimerState(prev => ({ ...prev, projectId: value, taskId: "" }))}
                disabled={timerState.isRunning}
              >
                <SelectTrigger data-testid="select-project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Task (Optional)</label>
              <Select
                value={timerState.taskId}
                onValueChange={(value) => setTimerState(prev => ({ ...prev, taskId: value }))}
                disabled={!timerState.projectId || timerState.isRunning}
              >
                <SelectTrigger data-testid="select-task">
                  <SelectValue placeholder="Select task" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Description *</label>
            <Textarea
              placeholder="What are you working on?"
              value={timerState.description}
              onChange={(e) => setTimerState(prev => ({ ...prev, description: e.target.value }))}
              disabled={timerState.isRunning}
              data-testid="input-description"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="billable"
              checked={timerState.isBillable}
              onCheckedChange={(checked) => setTimerState(prev => ({ ...prev, isBillable: checked as boolean }))}
              disabled={timerState.isRunning}
              data-testid="checkbox-billable"
            />
            <label htmlFor="billable" className="text-sm font-medium cursor-pointer">
              Billable
            </label>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-4xl font-mono font-semibold" data-testid="text-timer-display">
              {formatDuration(
                timerState.isRunning && timerState.startTime
                  ? timerState.totalElapsed + Math.floor((Date.now() - timerState.startTime) / 1000)
                  : timerState.totalElapsed
              )}
            </div>
            <div className="flex gap-2">
              {!timerState.isRunning && timerState.totalElapsed === 0 && (
                <Button onClick={handleStart} data-testid="button-start">
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              )}
              {timerState.isRunning && (
                <Button onClick={handlePause} variant="outline" data-testid="button-pause">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
              {!timerState.isRunning && timerState.totalElapsed > 0 && (
                <>
                  <Button onClick={handleStart} variant="outline" data-testid="button-resume">
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                  <Button onClick={handleStop} data-testid="button-stop">
                    <Square className="h-4 w-4 mr-2" />
                    Stop & Save
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Today's Summary</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
            <p className="text-2xl font-semibold font-mono" data-testid="text-today-total">
              {todayTotal.toFixed(2)} hrs
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Entries</p>
            <p className="text-2xl font-semibold" data-testid="text-today-count">
              {todayEntries.length}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Billable</p>
            <p className="text-2xl font-semibold font-mono" data-testid="text-today-billable">
              {todayEntries.filter(e => e.isBillable).reduce((sum, e) => sum + parseFloat(e.hours), 0).toFixed(2)} hrs
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Recent Entries (Last 7 Days)</h2>
          {hasPermission("time_entries:create") && (
            <Button variant="outline" data-testid="button-manual-entry">
              <Plus className="h-4 w-4 mr-2" />
              Manual Entry
            </Button>
          )}
        </div>

        {recentEntries.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground" data-testid="text-no-entries">
            No time entries in the last 7 days.
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
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEntries.map((entry) => {
                  const project = projects.find(p => p.id === entry.projectId);
                  return (
                    <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                      <TableCell>{format(new Date(entry.date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{project?.name || "Unknown"}</TableCell>
                      <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                      <TableCell className="text-right font-mono">{parseFloat(entry.hours).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={entry.status === "draft" ? "secondary" : "default"}>
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {hasPermission("time_entries:update") && entry.status === "draft" && (
                            <Button size="sm" variant="ghost" data-testid={`button-edit-${entry.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission("time_entries:delete") && entry.status === "draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Delete this time entry?")) {
                                  deleteTimeEntryMutation.mutate(entry.id);
                                }
                              }}
                              data-testid={`button-delete-${entry.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
