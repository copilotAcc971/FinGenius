import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import type { BeneficialOwner } from "@shared/schema";
import { format } from "date-fns";

interface BeneficialOwnersSectionProps {
  customerId: string;
  tenantId: string;
}

export function BeneficialOwnersSection({ customerId, tenantId }: BeneficialOwnersSectionProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingOwner, setEditingOwner] = useState<BeneficialOwner | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    nationality: "",
    countryOfResidence: "",
    ownershipPercentage: "",
    ownershipType: "direct",
    identificationType: "passport",
    identificationNumber: "",
    identificationExpiryDate: "",
    isPEP: false,
    pepCategory: "",
    pepDetails: "",
    notes: "",
  });

  const { data: owners = [], isLoading } = useQuery<BeneficialOwner[]>({
    queryKey: ["/api/beneficial-owners", { customerId, tenantId }],
    enabled: !!customerId && !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/beneficial-owners", "POST", {
        ...data,
        customerId,
        tenantId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficial-owners"] });
      toast({ title: "Beneficial owner added successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add beneficial owner",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/beneficial-owners/${data.id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficial-owners"] });
      toast({ title: "Beneficial owner updated successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update beneficial owner",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/beneficial-owners/${id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficial-owners"] });
      toast({ title: "Beneficial owner deleted successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete beneficial owner",
        variant: "destructive",
      });
    },
  });

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingOwner(null);
    setFormData({
      fullName: "",
      dateOfBirth: "",
      nationality: "",
      countryOfResidence: "",
      ownershipPercentage: "",
      ownershipType: "direct",
      identificationType: "passport",
      identificationNumber: "",
      identificationExpiryDate: "",
      isPEP: false,
      pepCategory: "",
      pepDetails: "",
      notes: "",
    });
  };

  const handleEdit = (owner: BeneficialOwner) => {
    setEditingOwner(owner);
    setFormData({
      fullName: owner.fullName,
      dateOfBirth: owner.dateOfBirth ? format(new Date(owner.dateOfBirth), "yyyy-MM-dd") : "",
      nationality: owner.nationality || "",
      countryOfResidence: owner.countryOfResidence || "",
      ownershipPercentage: owner.ownershipPercentage?.toString() || "",
      ownershipType: owner.ownershipType || "direct",
      identificationType: owner.identificationType || "passport",
      identificationNumber: owner.identificationNumber || "",
      identificationExpiryDate: owner.identificationExpiryDate ? format(new Date(owner.identificationExpiryDate), "yyyy-MM-dd") : "",
      isPEP: owner.isPEP || false,
      pepCategory: owner.pepCategory || "",
      pepDetails: owner.pepDetails || "",
      notes: owner.notes || "",
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.fullName || !formData.ownershipPercentage) {
      toast({
        title: "Validation Error",
        description: "Full name and ownership percentage are required",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...formData,
      ownershipPercentage: formData.ownershipPercentage,
      dateOfBirth: formData.dateOfBirth || null,
      identificationExpiryDate: formData.identificationExpiryDate || null,
    };

    if (editingOwner) {
      updateMutation.mutate({ id: editingOwner.id, ...submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Beneficial Owners</h3>
        <Button onClick={() => setShowDialog(true)} size="sm" data-testid="button-add-beneficial-owner">
          <Plus className="mr-2 h-4 w-4" />
          Add Owner
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
      ) : owners.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-gray-400 text-center py-4 border border-dashed rounded-lg">
          No beneficial owners recorded
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead>Ownership %</TableHead>
                <TableHead>Is PEP</TableHead>
                <TableHead>Verification Status</TableHead>
                <TableHead>Last Screened</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.map((owner) => (
                <TableRow key={owner.id} data-testid={`row-owner-${owner.id}`}>
                  <TableCell className="font-medium">{owner.fullName}</TableCell>
                  <TableCell>{owner.ownershipPercentage}%</TableCell>
                  <TableCell>
                    {owner.isPEP ? (
                      <Badge variant="default" className="bg-orange-600 text-white">PEP</Badge>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={owner.verificationStatus === "verified" ? "default" : "secondary"}>
                      {owner.verificationStatus || "pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                    {owner.lastScreenedAt ? format(new Date(owner.lastScreenedAt), "MMM d, yyyy") : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(owner)}
                        data-testid={`button-edit-owner-${owner.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(owner.id)}
                        data-testid={`button-delete-owner-${owner.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-beneficial-owner">
          <DialogHeader>
            <DialogTitle>{editingOwner ? "Edit" : "Add"} Beneficial Owner</DialogTitle>
            <DialogDescription>
              Enter the details of the beneficial owner. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  data-testid="input-full-name"
                />
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  data-testid="input-date-of-birth"
                />
              </div>
              <div>
                <Label htmlFor="ownershipPercentage">Ownership Percentage * (0-100)</Label>
                <Input
                  id="ownershipPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.ownershipPercentage}
                  onChange={(e) => setFormData({ ...formData, ownershipPercentage: e.target.value })}
                  data-testid="input-ownership-percentage"
                />
              </div>
              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <Input
                  id="nationality"
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  data-testid="input-nationality"
                />
              </div>
              <div>
                <Label htmlFor="countryOfResidence">Country of Residence</Label>
                <Input
                  id="countryOfResidence"
                  value={formData.countryOfResidence}
                  onChange={(e) => setFormData({ ...formData, countryOfResidence: e.target.value })}
                  data-testid="input-country-of-residence"
                />
              </div>
              <div>
                <Label htmlFor="ownershipType">Ownership Type</Label>
                <Select
                  value={formData.ownershipType}
                  onValueChange={(value) => setFormData({ ...formData, ownershipType: value })}
                >
                  <SelectTrigger id="ownershipType" data-testid="select-ownership-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="indirect">Indirect</SelectItem>
                    <SelectItem value="control">Control</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="identificationType">Identification Type</Label>
                <Select
                  value={formData.identificationType}
                  onValueChange={(value) => setFormData({ ...formData, identificationType: value })}
                >
                  <SelectTrigger id="identificationType" data-testid="select-identification-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="national_id">National ID</SelectItem>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="identificationNumber">Identification Number</Label>
                <Input
                  id="identificationNumber"
                  value={formData.identificationNumber}
                  onChange={(e) => setFormData({ ...formData, identificationNumber: e.target.value })}
                  data-testid="input-identification-number"
                />
              </div>
              <div>
                <Label htmlFor="identificationExpiryDate">ID Expiry Date</Label>
                <Input
                  id="identificationExpiryDate"
                  type="date"
                  value={formData.identificationExpiryDate}
                  onChange={(e) => setFormData({ ...formData, identificationExpiryDate: e.target.value })}
                  data-testid="input-id-expiry-date"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPEP"
                checked={formData.isPEP}
                onCheckedChange={(checked) => setFormData({ ...formData, isPEP: checked as boolean })}
                data-testid="checkbox-is-pep"
              />
              <Label htmlFor="isPEP" className="cursor-pointer">
                This person is a Politically Exposed Person (PEP)
              </Label>
            </div>

            {formData.isPEP && (
              <div className="space-y-4 pl-6 border-l-2 border-orange-600">
                <div>
                  <Label htmlFor="pepCategory">PEP Category</Label>
                  <Select
                    value={formData.pepCategory}
                    onValueChange={(value) => setFormData({ ...formData, pepCategory: value })}
                  >
                    <SelectTrigger id="pepCategory" data-testid="select-pep-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="senior_official">Senior Official</SelectItem>
                      <SelectItem value="family_member">Family Member</SelectItem>
                      <SelectItem value="close_associate">Close Associate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pepDetails">PEP Details</Label>
                  <Textarea
                    id="pepDetails"
                    value={formData.pepDetails}
                    onChange={(e) => setFormData({ ...formData, pepDetails: e.target.value })}
                    placeholder="Describe the PEP status..."
                    data-testid="textarea-pep-details"
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                data-testid="textarea-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-owner"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
