import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import type { FixedAsset } from "@shared/schema";
import { useToast } from "@/shared/hooks/use-toast";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Calendar, 
  TrendingDown,
  Calculator,
  DollarSign,
  FileText,
  PlayCircle,
  Plus
} from "lucide-react";
import { format } from "date-fns";

interface FixedAssetListProps {
  onEdit?: (asset: FixedAsset) => void;
  onViewSchedule?: (asset: FixedAsset) => void;
  onDispose?: (asset: FixedAsset) => void;
  onAdd?: () => void;
}

export function FixedAssetList({ onEdit, onViewSchedule, onDispose, onAdd }: FixedAssetListProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [processingDepreciation, setProcessingDepreciation] = useState(false);

  const { data: assets = [], isLoading } = useQuery<FixedAsset[]>({
    queryKey: ["/api/fixed-assets"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/fixed-assets/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast({ title: "Fixed asset deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting fixed asset",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const processDepreciationMutation = useMutation({
    mutationFn: (periodDate: string) =>
      apiRequest("/api/fixed-assets/process-depreciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodDate }),
      }),
    onSuccess: (data) => {
      toast({ 
        title: "Depreciation processed successfully",
        description: data.message 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      setProcessingDepreciation(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error processing depreciation",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
      setProcessingDepreciation(false);
    },
  });

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  const handleProcessDepreciation = () => {
    const currentDate = new Date().toISOString();
    setProcessingDepreciation(true);
    processDepreciationMutation.mutate(currentDate);
  };

  // Get unique categories for filter
  const categories = [...new Set(assets.map(a => a.category).filter(Boolean))];

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    if (statusFilter !== "all" && asset.status !== statusFilter) return false;
    if (categoryFilter && asset.category !== categoryFilter) return false;
    if (searchTerm && !asset.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !asset.assetCode?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'disposed':
        return <Badge variant="secondary">Disposed</Badge>;
      case 'fully-depreciated':
        return <Badge variant="outline">Fully Depreciated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return "$0.00";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fixed Assets</CardTitle>
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
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Fixed Assets</CardTitle>
              <CardDescription>Manage your organization's fixed assets and depreciation</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleProcessDepreciation}
                disabled={processingDepreciation}
                variant="outline"
                data-testid="button-process-depreciation"
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Process Monthly Depreciation
              </Button>
              {onAdd && (
                <Button onClick={onAdd} data-testid="button-add-asset">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Asset
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
              data-testid="input-search"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disposed">Disposed</SelectItem>
                <SelectItem value="fully-depreciated">Fully Depreciated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Acquisition Date</TableHead>
                  <TableHead>Acquisition Cost</TableHead>
                  <TableHead>Book Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      No fixed assets found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">
                        {asset.assetCode}
                      </TableCell>
                      <TableCell>{asset.name}</TableCell>
                      <TableCell>{asset.category}</TableCell>
                      <TableCell>
                        {asset.acquisitionDate ? 
                          format(new Date(asset.acquisitionDate), "MMM dd, yyyy") : 
                          "-"
                        }
                      </TableCell>
                      <TableCell>{formatCurrency(asset.acquisitionCost)}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(asset.currentBookValue)}
                      </TableCell>
                      <TableCell>{getStatusBadge(asset.status)}</TableCell>
                      <TableCell>
                        {asset.depreciationMethod === 'straight-line' ? 'Straight Line' :
                         asset.depreciationMethod === 'declining-balance' ? 'Declining Balance' :
                         'None'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${asset.id}`}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            {onEdit && asset.status !== 'disposed' && (
                              <DropdownMenuItem onClick={() => onEdit(asset)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {onViewSchedule && (
                              <DropdownMenuItem onClick={() => onViewSchedule(asset)}>
                                <Calendar className="mr-2 h-4 w-4" />
                                View Schedule
                              </DropdownMenuItem>
                            )}
                            {onDispose && asset.status === 'active' && (
                              <DropdownMenuItem onClick={() => onDispose(asset)}>
                                <TrendingDown className="mr-2 h-4 w-4" />
                                Dispose Asset
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {asset.status !== 'disposed' && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(asset.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{assets.filter(a => a.status === 'active').length}</div>
                <p className="text-xs text-muted-foreground">Active Assets</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    assets.reduce((sum, a) => sum + parseFloat(a.acquisitionCost || '0'), 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Total Acquisition Cost</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    assets.reduce((sum, a) => sum + parseFloat(a.currentBookValue || '0'), 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Total Book Value</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    assets.reduce((sum, a) => 
                      sum + (parseFloat(a.acquisitionCost || '0') - parseFloat(a.currentBookValue || '0')), 0
                    )
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Total Depreciation</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the fixed asset
              and all associated depreciation records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}