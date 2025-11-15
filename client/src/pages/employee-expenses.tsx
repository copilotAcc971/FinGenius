import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Receipt, Check, X, DollarSign, Calendar, User, Tag, FileText, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/contexts/rbac-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

const EXPENSE_CATEGORIES = [
  "Travel",
  "Meals",
  "Accommodation",
  "Transportation",
  "Office Supplies",
  "Software",
  "Training",
  "Client Entertainment",
  "Other",
];

const PAYMENT_METHODS = [
  "Bank Transfer",
  "Check",
  "Cash",
  "Direct Deposit",
];

interface Expense {
  id: string;
  tenantId: string;
  employeeId?: string;
  submittedBy?: string;
  date: string;
  amount: string;
  category: string;
  description?: string;
  documentUrl?: string;
  reimbursementStatus: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  reimbursedBy?: string;
  reimbursedAt?: string;
  paymentReference?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

const submitExpenseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  category: z.string().min(1, "Category is required"),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().optional(),
  documentUrl: z.string().optional(),
});

const rejectExpenseSchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

const reimburseExpenseSchema = z.object({
  paymentMethod: z.string().min(1, "Payment method is required"),
  paymentReference: z.string().min(1, "Payment reference is required"),
});

type SubmitExpenseFormData = z.infer<typeof submitExpenseSchema>;
type RejectExpenseFormData = z.infer<typeof rejectExpenseSchema>;
type ReimburseExpenseFormData = z.infer<typeof reimburseExpenseSchema>;

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status.toLowerCase()) {
    case "pending":
      return "outline";
    case "approved":
      return "secondary";
    case "rejected":
      return "destructive";
    case "reimbursed":
      return "default";
    default:
      return "outline";
  }
};

const formatCurrency = (amount: string | number) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
};

export default function EmployeeExpenses() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasPermission } = useRBAC();
  
  const [activeTab, setActiveTab] = useState<"my" | "approvals" | "all">("my");
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [reimburseDialogOpen, setReimburseDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.assign("/api/login");
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);
  
  const submitForm = useForm<SubmitExpenseFormData>({
    resolver: zodResolver(submitExpenseSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      category: "",
      amount: "",
      description: "",
      documentUrl: "",
    },
  });
  
  const rejectForm = useForm<RejectExpenseFormData>({
    resolver: zodResolver(rejectExpenseSchema),
    defaultValues: {
      reason: "",
    },
  });
  
  const reimburseForm = useForm<ReimburseExpenseFormData>({
    resolver: zodResolver(reimburseExpenseSchema),
    defaultValues: {
      paymentMethod: "",
      paymentReference: "",
    },
  });
  
  // Build query params based on active tab and filters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    
    // Add status filter based on active tab
    if (activeTab === "approvals") {
      params.set("status", "pending");
    } else if (activeTab === "all" && statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    // 'my' tab shows all statuses for current user (backend filters by employeeId)
    
    if (employeeFilter !== "all") {
      params.set("employeeId", employeeFilter);
    }
    
    return params.toString();
  };
  
  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/employee-expenses", { tenantId: currentTenant?.id, activeTab, statusFilter, employeeFilter }],
    queryFn: async () => {
      const queryString = buildQueryParams();
      const response = await fetch(`/api/employee-expenses?${queryString}`, {
        credentials: 'include',
        headers: {
          'X-Tenant-ID': currentTenant.id
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch expenses');
      }
      
      return response.json();
    },
    enabled: !!currentTenant?.id,
  });
  
  const submitMutation = useMutation({
    mutationFn: async (data: SubmitExpenseFormData) => {
      const response = await apiRequest("/api/employee-expenses", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-expenses"] });
      setSubmitDialogOpen(false);
      submitForm.reset();
      toast({
        title: "Success",
        description: "Expense submitted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit expense",
        variant: "destructive",
      });
    },
  });
  
  const approveMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const response = await apiRequest(`/api/employee-expenses/${expenseId}/approve`, "POST");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-expenses"] });
      setApproveDialogOpen(false);
      setSelectedExpense(null);
      toast({
        title: "Success",
        description: "Expense approved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve expense",
        variant: "destructive",
      });
    },
  });
  
  const rejectMutation = useMutation({
    mutationFn: async ({ expenseId, reason }: { expenseId: string; reason: string }) => {
      const response = await apiRequest(`/api/employee-expenses/${expenseId}/reject`, "POST", { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-expenses"] });
      setRejectDialogOpen(false);
      setSelectedExpense(null);
      rejectForm.reset();
      toast({
        title: "Success",
        description: "Expense rejected",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject expense",
        variant: "destructive",
      });
    },
  });
  
  const reimburseMutation = useMutation({
    mutationFn: async ({ expenseId, data }: { expenseId: string; data: ReimburseExpenseFormData }) => {
      const response = await apiRequest(`/api/employee-expenses/${expenseId}/reimburse`, "POST", {
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-expenses"] });
      setReimburseDialogOpen(false);
      setSelectedExpense(null);
      reimburseForm.reset();
      toast({
        title: "Success",
        description: "Expense reimbursed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reimburse expense",
        variant: "destructive",
      });
    },
  });
  
  const handleSubmitExpense = (data: SubmitExpenseFormData) => {
    submitMutation.mutate(data);
  };
  
  const handleApprove = () => {
    if (selectedExpense) {
      approveMutation.mutate(selectedExpense.id);
    }
  };
  
  const handleReject = (data: RejectExpenseFormData) => {
    if (selectedExpense) {
      rejectMutation.mutate({ expenseId: selectedExpense.id, reason: data.reason });
    }
  };
  
  const handleReimburse = (data: ReimburseExpenseFormData) => {
    if (selectedExpense) {
      reimburseMutation.mutate({ expenseId: selectedExpense.id, data });
    }
  };
  
  const canSubmit = hasPermission("employee_expenses.submit");
  const canApprove = hasPermission("employee_expenses.approve");
  const canReject = hasPermission("employee_expenses.reject");
  const canReimburse = hasPermission("employee_expenses.reimburse");
  const canViewAll = hasPermission("employee_expenses.view_all");
  
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
  
  const filteredExpenses = expenses || [];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="heading-employee-expenses">Employee Expenses</h1>
          <p className="text-muted-foreground">Submit and manage employee expense reimbursements</p>
        </div>
        {canSubmit && (
          <Button onClick={() => setSubmitDialogOpen(true)} data-testid="button-submit-expense">
            <Plus className="h-4 w-4 mr-2" />
            Submit Expense
          </Button>
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="my" data-testid="tab-my-expenses">
            My Expenses
          </TabsTrigger>
          {canApprove && (
            <TabsTrigger value="approvals" data-testid="tab-pending-approvals">
              Pending Approvals
            </TabsTrigger>
          )}
          {canViewAll && (
            <TabsTrigger value="all" data-testid="tab-all-expenses">
              All Expenses
            </TabsTrigger>
          )}
        </TabsList>
        
        {/* Filters */}
        {activeTab === "all" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="select-status-filter">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="reimbursed">Reimbursed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}
        
        <TabsContent value="my" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              </CardContent>
            </Card>
          ) : filteredExpenses.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Expenses Found</h3>
                <p className="text-muted-foreground mb-4">You haven't submitted any expense claims yet.</p>
                {canSubmit && (
                  <Button onClick={() => setSubmitDialogOpen(true)} data-testid="button-submit-first-expense">
                    <Plus className="h-4 w-4 mr-2" />
                    Submit Your First Expense
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                        <TableCell>{format(new Date(expense.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{expense.category}</TableCell>
                        <TableCell className="max-w-xs truncate">{expense.description || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(expense.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(expense.reimbursementStatus)} data-testid={`badge-status-${expense.id}`}>
                            {expense.reimbursementStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {expense.documentUrl ? (
                            <a href={expense.documentUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid={`link-receipt-${expense.id}`}>
                              View
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {expense.reimbursementStatus === "rejected" && expense.rejectionReason && (
                            <Button variant="ghost" size="sm" title={expense.rejectionReason} data-testid={`button-view-rejection-${expense.id}`}>
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="approvals" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              </CardContent>
            </Card>
          ) : filteredExpenses.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Check className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Pending Approvals</h3>
                <p className="text-muted-foreground">All expense claims have been reviewed.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id} data-testid={`row-approval-${expense.id}`}>
                        <TableCell>{format(new Date(expense.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{expense.employeeId || "—"}</TableCell>
                        <TableCell>{expense.category}</TableCell>
                        <TableCell className="max-w-xs truncate">{expense.description || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(expense.amount)}</TableCell>
                        <TableCell>
                          {expense.documentUrl ? (
                            <a href={expense.documentUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid={`link-approval-receipt-${expense.id}`}>
                              View
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {canApprove && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedExpense(expense);
                                setApproveDialogOpen(true);
                              }}
                              data-testid={`button-approve-${expense.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          )}
                          {canReject && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedExpense(expense);
                                setRejectDialogOpen(true);
                              }}
                              data-testid={`button-reject-${expense.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              </CardContent>
            </Card>
          ) : filteredExpenses.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Expenses Found</h3>
                <p className="text-muted-foreground">No expense claims match the current filters.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id} data-testid={`row-all-${expense.id}`}>
                        <TableCell>{format(new Date(expense.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{expense.employeeId || "—"}</TableCell>
                        <TableCell>{expense.category}</TableCell>
                        <TableCell className="max-w-xs truncate">{expense.description || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(expense.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(expense.reimbursementStatus)} data-testid={`badge-all-status-${expense.id}`}>
                            {expense.reimbursementStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {expense.documentUrl ? (
                            <a href={expense.documentUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid={`link-all-receipt-${expense.id}`}>
                              View
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {expense.reimbursementStatus === "approved" && canReimburse && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedExpense(expense);
                                setReimburseDialogOpen(true);
                              }}
                              data-testid={`button-reimburse-${expense.id}`}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Reimburse
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Submit Expense Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-submit-expense">
          <DialogHeader>
            <DialogTitle>Submit Expense Claim</DialogTitle>
            <DialogDescription>
              Fill in the details of your expense claim. Upload a receipt if available.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...submitForm}>
            <form onSubmit={submitForm.handleSubmit(handleSubmitExpense)} className="space-y-4">
              <FormField
                control={submitForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-expense-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={submitForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} data-testid="select-expense-category">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={submitForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-expense-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={submitForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe the expense..." {...field} data-testid="textarea-expense-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={submitForm.control}
                name="documentUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt URL (optional)</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://..." {...field} data-testid="input-receipt-url" />
                    </FormControl>
                    <FormDescription>
                      Paste a link to your receipt (e.g., from cloud storage)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSubmitDialogOpen(false)} data-testid="button-cancel-submit">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitMutation.isPending} data-testid="button-confirm-submit">
                  {submitMutation.isPending ? "Submitting..." : "Submit Expense"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent data-testid="dialog-approve-expense">
          <DialogHeader>
            <DialogTitle>Approve Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this expense claim?
            </DialogDescription>
          </DialogHeader>
          
          {selectedExpense && (
            <div className="space-y-3 py-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm font-medium text-muted-foreground">Date:</div>
                <div className="text-sm">{format(new Date(selectedExpense.date), "MMM d, yyyy")}</div>
                
                <div className="text-sm font-medium text-muted-foreground">Category:</div>
                <div className="text-sm">{selectedExpense.category}</div>
                
                <div className="text-sm font-medium text-muted-foreground">Amount:</div>
                <div className="text-sm font-mono">{formatCurrency(selectedExpense.amount)}</div>
                
                <div className="text-sm font-medium text-muted-foreground">Description:</div>
                <div className="text-sm">{selectedExpense.description || "—"}</div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)} data-testid="button-cancel-approve">
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending} data-testid="button-confirm-approve">
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent data-testid="dialog-reject-expense">
          <DialogHeader>
            <DialogTitle>Reject Expense</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this expense claim.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...rejectForm}>
            <form onSubmit={rejectForm.handleSubmit(handleReject)} className="space-y-4">
              <FormField
                control={rejectForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rejection Reason</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Explain why this expense is being rejected..." {...field} data-testid="textarea-rejection-reason" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRejectDialogOpen(false)} data-testid="button-cancel-reject">
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={rejectMutation.isPending} data-testid="button-confirm-reject">
                  {rejectMutation.isPending ? "Rejecting..." : "Reject Expense"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Reimburse Dialog */}
      <Dialog open={reimburseDialogOpen} onOpenChange={setReimburseDialogOpen}>
        <DialogContent data-testid="dialog-reimburse-expense">
          <DialogHeader>
            <DialogTitle>Process Reimbursement</DialogTitle>
            <DialogDescription>
              Enter payment details to process this reimbursement.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...reimburseForm}>
            <form onSubmit={reimburseForm.handleSubmit(handleReimburse)} className="space-y-4">
              <FormField
                control={reimburseForm.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} data-testid="select-payment-method">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={reimburseForm.control}
                name="paymentReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Reference</FormLabel>
                    <FormControl>
                      <Input placeholder="Check #, Transfer ID, etc." {...field} data-testid="input-payment-reference" />
                    </FormControl>
                    <FormDescription>
                      Enter the reference number for this payment
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReimburseDialogOpen(false)} data-testid="button-cancel-reimburse">
                  Cancel
                </Button>
                <Button type="submit" disabled={reimburseMutation.isPending} data-testid="button-confirm-reimburse">
                  {reimburseMutation.isPending ? "Processing..." : "Process Reimbursement"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
