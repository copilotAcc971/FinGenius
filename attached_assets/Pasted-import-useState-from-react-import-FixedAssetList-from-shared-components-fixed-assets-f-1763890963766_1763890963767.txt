import { useState } from "react";
import { FixedAssetList } from "@/shared/components/fixed-assets/fixed-asset-list";
import { FixedAssetForm } from "@/shared/components/fixed-assets/fixed-asset-form";
import { DepreciationSchedule } from "@/shared/components/fixed-assets/depreciation-schedule";
import { DisposalDialog } from "@/shared/components/fixed-assets/disposal-dialog";
import type { FixedAsset } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";
import { Package } from "lucide-react";

export default function FixedAssets() {
  const [activeTab, setActiveTab] = useState("list");
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [showDisposalDialog, setShowDisposalDialog] = useState(false);
  const [assetToDispose, setAssetToDispose] = useState<FixedAsset | null>(null);
  const [viewingSchedule, setViewingSchedule] = useState<FixedAsset | null>(null);

  const handleAdd = () => {
    setSelectedAsset(null);
    setActiveTab("form");
  };

  const handleEdit = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setActiveTab("form");
  };

  const handleFormSuccess = () => {
    setActiveTab("list");
    setSelectedAsset(null);
  };

  const handleFormCancel = () => {
    setActiveTab("list");
    setSelectedAsset(null);
  };

  const handleViewSchedule = (asset: FixedAsset) => {
    setViewingSchedule(asset);
    setActiveTab("schedule");
  };

  const handleDispose = (asset: FixedAsset) => {
    setAssetToDispose(asset);
    setShowDisposalDialog(true);
  };

  const handleDisposalSuccess = () => {
    setShowDisposalDialog(false);
    setAssetToDispose(null);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            Fixed Assets Management
          </h1>
          <Breadcrumb className="mt-2">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/accounting">Accounting</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Fixed Assets</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="list">Assets List</TabsTrigger>
          <TabsTrigger value="form">
            {selectedAsset ? "Edit Asset" : "New Asset"}
          </TabsTrigger>
          <TabsTrigger value="schedule" disabled={!viewingSchedule}>
            Schedule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <FixedAssetList
            onAdd={handleAdd}
            onEdit={handleEdit}
            onViewSchedule={handleViewSchedule}
            onDispose={handleDispose}
          />
        </TabsContent>

        <TabsContent value="form" className="mt-6">
          <FixedAssetForm
            asset={selectedAsset || undefined}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </TabsContent>

        <TabsContent value="schedule" className="mt-6">
          {viewingSchedule && (
            <DepreciationSchedule
              asset={viewingSchedule}
              onClose={() => {
                setViewingSchedule(null);
                setActiveTab("list");
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      <DisposalDialog
        asset={assetToDispose}
        open={showDisposalDialog}
        onOpenChange={setShowDisposalDialog}
        onSuccess={handleDisposalSuccess}
      />
    </div>
  );
}