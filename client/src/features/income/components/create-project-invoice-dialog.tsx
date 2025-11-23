import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Button } from "@/shared/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Calendar } from "@/shared/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
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
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Slider } from "@/shared/components/ui/slider";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { useToast } from "@/shared/hooks/use-toast";
import { useTenant } from "@/shared/hooks/useTenant";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { 
  Project, 
  Customer, 
  TimeEntry, 
  ProjectTask, 
  ProjectMilestone, 
  User, 
  Tax 
} from "@shared/schema";

type BillingMode = "time_entries" | "milestone" | "progress";

interface TimeEntryWithUser extends TimeEntry {
  user?: User;
  task?: ProjectTask;
}

interface InvoiceableMilestone extends ProjectMilestone {
  remaining: number;
}

interface ProgressBillingCalculation {
  totalBudget: number;
  totalInvoiced: number;
  remainingBudget: number;
  availableToBill: number;
  suggestedPercentage: number;
}

interface CreateProjectInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  customer: Customer;
}

const safeDecimal = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

export function CreateProjectInvoiceDialog({
  open,
  onOpenChange,
  project,
  customer,
}: CreateProjectInvoiceDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [step, setStep] = useState(1);
  const [billingMode, setBillingMode] = useState<BillingMode | null>(null);
  const [selectedTimeEntries, setSelectedTimeEntries] = useState<Set<string>>(new Set());
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);

  // Filter form for time entries
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
  const [selectedTask, setSelectedTask] = useState<string | undefined>(undefined);

  // Query for project members (users)
  const { data: projectMembers = [], isLoading: projectMembersLoading } = useQuery<User[]>({
    queryKey: ["/api/projects", project.id, "members", currentTenant?.id],
    enabled: !!currentTenant?.id && open && billingMode === "time_entries",
  });

  // Query for project tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<ProjectTask[]>({
    queryKey: ["/api/project-tasks", { projectId: project.id, tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open && billingMode === "time_entries",
  });

  // Query for invoiceable time entries
  const { data: timeEntries = [], isLoading: timeEntriesLoading } = useQuery<TimeEntryWithUser[]>({
    queryKey: [
      "/api/projects",
      project.id,
      "invoices",
      "invoiceable-time-entries",
      { 
        startDate: startDate?.toISOString().split('T')[0],
        endDate: endDate?.toISOString().split('T')[0],
        userId: selectedUser,
        taskId: selectedTask,
        tenantId: currentTenant?.id
      }
    ],
    enabled: !!currentTenant?.id && open && billingMode === "time_entries" && step === 3,
  });

  // Query for invoiceable milestones
  const { data: milestones = [], isLoading: milestonesLoading } = useQuery<InvoiceableMilestone[]>({
    queryKey: ["/api/projects", project.id, "invoices", "invoiceable-milestones", currentTenant?.id],
    enabled: !!currentTenant?.id && open && billingMode === "milestone" && step === 2,
  });

  // Query for progress billing calculation
  const { data: progressCalc, isLoading: progressCalcLoading } = useQuery<ProgressBillingCalculation>({
    queryKey: ["/api/projects", project.id, "invoices", "progress-billing-calculation", currentTenant?.id],
    enabled: !!currentTenant?.id && open && billingMode === "progress" && step === 2,
  });

  // Query for taxes
  const { data: taxes = [] } = useQuery<Tax[]>({
    queryKey: ["/api/taxes", currentTenant?.id],
    enabled: !!currentTenant?.id && open,
  });

  // Invoice details form schema
  const invoiceDetailsSchema = z.object({
    invoiceDate: z.string().min(1, "Invoice date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    taxId: z.string().optional(),
    notes: z.string().optional(),
    description: z.string().optional(),
    amount: z.string().optional(),
  });

  const form = useForm<z.infer<typeof invoiceDetailsSchema>>({
    resolver: zodResolver(invoiceDetailsSchema),
    defaultValues: {
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      taxId: "",
      notes: "",
      description: "",
      amount: "",
    },
  });

  // Calculate totals for time entries
  const timeEntriesTotals = useMemo(() => {
    const selected = timeEntries.filter(te => selectedTimeEntries.has(te.id));
    const totalHours = selected.reduce((sum, te) => sum + safeDecimal(te.hours), 0);
    const totalAmount = selected.reduce((sum, te) => sum + safeDecimal(te.billableAmount), 0);
    return { totalHours, totalAmount };
  }, [timeEntries, selectedTimeEntries]);

  // Calculate milestone remaining amount
  const selectedMilestoneData = useMemo(() => {
    if (!selectedMilestone) return null;
    return milestones.find(m => m.id === selectedMilestone);
  }, [selectedMilestone, milestones]);

  // Calculate progress billing amount with clamping to availableToBill
  const progressAmount = useMemo(() => {
    if (!progressCalc) return 0;
    const calculatedAmount = (progressCalc.totalBudget * progressPercentage) / 100 - progressCalc.totalInvoiced;
    return Math.min(calculatedAmount, progressCalc.availableToBill);
  }, [progressCalc, progressPercentage]);

  // Set initial progress percentage from calculation
  useEffect(() => {
    if (progressCalc && progressPercentage === 0) {
      setProgressPercentage(progressCalc.suggestedPercentage || 0);
    }
  }, [progressCalc, progressPercentage]);

  // Set default amount for milestone
  useEffect(() => {
    if (selectedMilestoneData && step === 3) {
      form.setValue("amount", selectedMilestoneData.remaining.toFixed(2));
    }
  }, [selectedMilestoneData, step, form]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setBillingMode(null);
      setSelectedTimeEntries(new Set());
      setSelectedMilestone(null);
      setProgressPercentage(0);
      setStartDate(undefined);
      setEndDate(undefined);
      setSelectedUser(undefined);
      setSelectedTask(undefined);
      form.reset();
    }
  }, [open, form]);

  // Toggle all time entries
  const toggleAllTimeEntries = () => {
    if (selectedTimeEntries.size === timeEntries.length) {
      setSelectedTimeEntries(new Set());
    } else {
      setSelectedTimeEntries(new Set(timeEntries.map(te => te.id)));
    }
  };

  // Toggle individual time entry
  const toggleTimeEntry = (id: string) => {
    const newSet = new Set(selectedTimeEntries);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTimeEntries(newSet);
  };

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof invoiceDetailsSchema>) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      if (!customer) throw new Error("Customer information required");
      
      let endpoint = "";
      let payload: any = {
        customerId: customer.id,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        taxId: data.taxId || null,
        notes: data.notes || "",
      };

      if (billingMode === "time_entries") {
        endpoint = `/api/projects/${project.id}/invoices/from-time-entries?tenantId=${currentTenant.id}`;
        payload.timeEntryIds = Array.from(selectedTimeEntries);
      } else if (billingMode === "milestone") {
        endpoint = `/api/projects/${project.id}/invoices/from-milestone?tenantId=${currentTenant.id}`;
        payload.milestoneId = selectedMilestone;
        payload.amount = parseFloat(data.amount || "0");
      } else if (billingMode === "progress") {
        endpoint = `/api/projects/${project.id}/invoices/from-progress?tenantId=${currentTenant.id}`;
        // Clamp progress percentage to ensure it doesn't exceed available to bill
        const clampedPercentage = progressCalc 
          ? Math.min(progressPercentage, (progressCalc.availableToBill / progressCalc.totalBudget) * 100)
          : progressPercentage;
        payload.percentageComplete = clampedPercentage.toString();
        payload.description = data.description || "";
      }

      await apiRequest(endpoint, "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice created",
        description: "Project invoice has been created successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice.",
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    // Prevent advancement if required data not loaded
    if (step === 1 && billingMode === "time_entries") {
      if (!currentTenant?.id || projectMembersLoading || tasksLoading) return;
    }
    if (step === 1 && billingMode === "milestone") {
      if (!currentTenant?.id || milestonesLoading) return;
    }
    if (step === 1 && billingMode === "progress") {
      if (!currentTenant?.id || progressCalcLoading) return;
    }
    if (step === 2 && billingMode === "time_entries") {
      if (timeEntriesLoading || !timeEntries) return;
    }
    if (step === 2 && billingMode === "milestone") {
      if (milestonesLoading || !milestones || !selectedMilestone) return;
    }
    if (step === 2 && billingMode === "progress") {
      if (progressCalcLoading || !progressCalc) return;
    }
    
    // Check customer exists before final step
    if (!customer) {
      toast({ 
        title: "Error", 
        description: "Customer information not available", 
        variant: "destructive" 
      });
      return;
    }

    if (billingMode === "time_entries") {
      if (step === 1) setStep(2);
      else if (step === 2) setStep(3);
      else if (step === 3) setStep(4);
    } else if (billingMode === "milestone") {
      if (step === 1) setStep(2);
      else if (step === 2 && selectedMilestone) setStep(3);
      else if (step === 3) setStep(4);
    } else if (billingMode === "progress") {
      if (step === 1) setStep(2);
      else if (step === 2) setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = form.handleSubmit((data) => {
    if (!customer) {
      toast({ 
        title: "Error", 
        description: "Customer information required", 
        variant: "destructive" 
      });
      return;
    }
    
    if (!currentTenant?.id) {
      toast({ 
        title: "Error", 
        description: "Tenant context required", 
        variant: "destructive" 
      });
      return;
    }
    
    createInvoiceMutation.mutate(data);
  });

  const isNextDisabled = () => {
    if (step === 1) {
      if (!billingMode) return true;
      if (billingMode === "time_entries" && (projectMembersLoading || tasksLoading)) return true;
      if (billingMode === "milestone" && milestonesLoading) return true;
      if (billingMode === "progress" && progressCalcLoading) return true;
    }
    if (step === 2) {
      if (billingMode === "time_entries" && timeEntriesLoading) return true;
      if (billingMode === "milestone" && (milestonesLoading || !selectedMilestone)) return true;
      if (billingMode === "progress" && progressCalcLoading) return true;
    }
    if (step === 3) {
      if (billingMode === "time_entries" && selectedTimeEntries.size === 0) return true;
      if (billingMode === "milestone" && !form.watch("amount")) return true;
    }
    return false;
  };

  const getStepTitle = () => {
    if (step === 1) return "Select Billing Mode";
    
    if (billingMode === "time_entries") {
      if (step === 2) return "Filter Time Entries";
      if (step === 3) return "Select Time Entries";
      if (step === 4) return "Invoice Details";
    } else if (billingMode === "milestone") {
      if (step === 2) return "Select Milestone";
      if (step === 3) return "Invoice Amount";
      if (step === 4) return "Invoice Details";
    } else if (billingMode === "progress") {
      if (step === 2) return "Calculate Progress";
      if (step === 3) return "Invoice Details";
    }
    
    return "";
  };

  const isFinalStep = () => {
    if (billingMode === "time_entries" && step === 4) return true;
    if (billingMode === "milestone" && step === 4) return true;
    if (billingMode === "progress" && step === 3) return true;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title-create-invoice">
            Create Project Invoice
          </DialogTitle>
          <DialogDescription>
            {getStepTitle()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Select Billing Mode */}
          {step === 1 && (
            <div className="space-y-4">
              <RadioGroup
                value={billingMode || ""}
                onValueChange={(value) => setBillingMode(value as BillingMode)}
                data-testid="radio-group-billing-mode"
              >
                <div className="flex items-center space-x-2 p-4 border rounded-md hover-elevate">
                  <RadioGroupItem value="time_entries" id="time_entries" data-testid="radio-time-entries" />
                  <label htmlFor="time_entries" className="flex-1 cursor-pointer">
                    <div className="font-semibold">Time Entries</div>
                    <div className="text-sm text-muted-foreground">
                      Bill based on tracked time entries
                    </div>
                  </label>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-md hover-elevate">
                  <RadioGroupItem value="milestone" id="milestone" data-testid="radio-milestone" />
                  <label htmlFor="milestone" className="flex-1 cursor-pointer">
                    <div className="font-semibold">Milestone</div>
                    <div className="text-sm text-muted-foreground">
                      Bill based on project milestone completion
                    </div>
                  </label>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-md hover-elevate">
                  <RadioGroupItem value="progress" id="progress" data-testid="radio-progress" />
                  <label htmlFor="progress" className="flex-1 cursor-pointer">
                    <div className="font-semibold">Progress Billing</div>
                    <div className="text-sm text-muted-foreground">
                      Bill based on percentage of project completion
                    </div>
                  </label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Time Entries Mode - Step 2: Filters */}
          {billingMode === "time_entries" && step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left"
                        data-testid="button-start-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left"
                        data-testid="button-end-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">User</label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger data-testid="select-user">
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {projectMembers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Task</label>
                  <Select value={selectedTask} onValueChange={setSelectedTask}>
                    <SelectTrigger data-testid="select-task">
                      <SelectValue placeholder="All tasks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tasks</SelectItem>
                      {tasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Time Entries Mode - Step 3: Select Time Entries */}
          {billingMode === "time_entries" && step === 3 && (
            <div className="space-y-4">
              {timeEntriesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : timeEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No invoiceable time entries found
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedTimeEntries.size === timeEntries.length}
                              onCheckedChange={toggleAllTimeEntries}
                              data-testid="checkbox-select-all"
                            />
                          </TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Task</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Hours</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {timeEntries.map((entry) => (
                          <TableRow key={entry.id} data-testid={`row-time-entry-${entry.id}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedTimeEntries.has(entry.id)}
                                onCheckedChange={() => toggleTimeEntry(entry.id)}
                                data-testid={`checkbox-time-entry-${entry.id}`}
                              />
                            </TableCell>
                            <TableCell>{format(new Date(entry.date), "MMM d, yyyy")}</TableCell>
                            <TableCell>
                              {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : "-"}
                            </TableCell>
                            <TableCell>{entry.task?.name || "-"}</TableCell>
                            <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                            <TableCell className="text-right font-mono">
                              {safeDecimal(entry.hours).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${safeDecimal(entry.billableRate).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${safeDecimal(entry.billableAmount).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end gap-6 p-4 bg-muted rounded-md">
                    <div>
                      <div className="text-sm text-muted-foreground">Total Hours</div>
                      <div className="text-lg font-mono font-semibold" data-testid="text-total-hours">
                        {timeEntriesTotals.totalHours.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Total Amount</div>
                      <div className="text-lg font-mono font-semibold" data-testid="text-total-amount">
                        ${timeEntriesTotals.totalAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Milestone Mode - Step 2: Select Milestone */}
          {billingMode === "milestone" && step === 2 && (
            <div className="space-y-4">
              {milestonesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : milestones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No invoiceable milestones found
                </div>
              ) : (
                <RadioGroup
                  value={selectedMilestone || ""}
                  onValueChange={setSelectedMilestone}
                  data-testid="radio-group-milestones"
                >
                  {milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex items-start space-x-3 p-4 border rounded-md hover-elevate"
                    >
                      <RadioGroupItem
                        value={milestone.id}
                        id={milestone.id}
                        className="mt-1"
                        data-testid={`radio-milestone-${milestone.id}`}
                      />
                      <label htmlFor={milestone.id} className="flex-1 cursor-pointer space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{milestone.name}</div>
                          <Badge variant={milestone.status === "completed" ? "default" : "secondary"}>
                            {milestone.status}
                          </Badge>
                        </div>
                        {milestone.description && (
                          <div className="text-sm text-muted-foreground">{milestone.description}</div>
                        )}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Due Date: </span>
                            <span className="font-medium">{format(new Date(milestone.dueDate), "MMM d, yyyy")}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Invoiceable: </span>
                            <span className="font-mono font-medium">
                              ${safeDecimal(milestone.invoiceableAmount).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Already Invoiced: </span>
                            <span className="font-mono font-medium">
                              ${safeDecimal(milestone.invoicedAmount).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Remaining: </span>
                            <span className="font-mono font-semibold">
                              ${milestone.remaining.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          {/* Milestone Mode - Step 3: Invoice Amount */}
          {billingMode === "milestone" && step === 3 && selectedMilestoneData && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Milestone</span>
                  <span className="font-semibold">{selectedMilestoneData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Invoiceable Amount</span>
                  <span className="font-mono font-semibold">
                    ${safeDecimal(selectedMilestoneData.invoiceableAmount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Already Invoiced</span>
                  <span className="font-mono">
                    ${safeDecimal(selectedMilestoneData.invoicedAmount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-semibold">Remaining</span>
                  <span className="font-mono font-semibold">
                    ${selectedMilestoneData.remaining.toFixed(2)}
                  </span>
                </div>
              </div>
              <Form {...form}>
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          data-testid="input-invoice-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Form>
              <p className="text-sm text-muted-foreground">
                You can invoice a partial amount. Maximum: ${selectedMilestoneData.remaining.toFixed(2)}
              </p>
            </div>
          )}

          {/* Progress Mode - Step 2: Calculate Progress */}
          {billingMode === "progress" && step === 2 && (
            <div className="space-y-4">
              {progressCalcLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : progressCalc ? (
                <>
                  <div className="p-4 bg-muted rounded-md space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Budget</span>
                      <span className="font-mono font-semibold">
                        ${progressCalc.totalBudget.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Invoiced</span>
                      <span className="font-mono">
                        ${progressCalc.totalInvoiced.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-sm font-semibold">Remaining Budget</span>
                      <span className="font-mono font-semibold">
                        ${progressCalc.remainingBudget.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Percentage Complete</label>
                      <span className="text-lg font-semibold" data-testid="text-progress-percentage">
                        {progressPercentage}%
                      </span>
                    </div>
                    <Slider
                      value={[progressPercentage]}
                      onValueChange={(value) => setProgressPercentage(value[0])}
                      max={100}
                      step={1}
                      data-testid="slider-progress"
                    />
                  </div>
                  {(() => {
                    const unclampedAmount = (progressCalc.totalBudget * progressPercentage) / 100 - progressCalc.totalInvoiced;
                    const exceedsAvailable = unclampedAmount > progressCalc.availableToBill;
                    
                    return (
                      <>
                        {exceedsAvailable && (
                          <Alert variant="destructive" data-testid="alert-amount-exceeds">
                            <AlertDescription>
                              Amount exceeds available to bill. Maximum: ${progressCalc.availableToBill.toFixed(2)}
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="p-4 bg-primary/10 rounded-md">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold">Amount to Bill</span>
                            <span className="text-2xl font-mono font-semibold" data-testid="text-progress-amount">
                              ${progressAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Unable to calculate progress billing
                </div>
              )}
            </div>
          )}

          {/* Invoice Details - Final Step */}
          {isFinalStep() && (
            <Form {...form}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="invoiceDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-invoice-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-due-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax (Optional)</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-tax">
                            <SelectValue placeholder="Select tax" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No tax</SelectItem>
                          {taxes.map((tax) => (
                            <SelectItem key={tax.id} value={tax.id}>
                              {tax.name} ({safeDecimal(tax.rate)}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {billingMode === "progress" && (
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Progress billing description"
                            {...field}
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes for this invoice"
                          className="resize-none"
                          rows={3}
                          {...field}
                          data-testid="textarea-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="p-4 bg-muted rounded-md space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Customer</span>
                    <span className="font-semibold">{customer.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Project</span>
                    <span className="font-semibold">{project.name}</span>
                  </div>
                </div>
              </div>
            </Form>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={createInvoiceMutation.isPending}
              data-testid="button-back"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          {!isFinalStep() ? (
            <Button
              onClick={handleNext}
              disabled={isNextDisabled()}
              data-testid="button-next"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createInvoiceMutation.isPending}
              data-testid="button-create-invoice"
            >
              {createInvoiceMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Invoice
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
