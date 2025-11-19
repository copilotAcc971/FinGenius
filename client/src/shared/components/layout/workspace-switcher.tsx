import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/shared/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { useTenant } from "@/shared/hooks/useTenant";
import type { Tenant } from "@shared/schema";
import { CreateWorkspaceDialog } from "@/features/auth/components/create-workspace-dialog";

export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { currentTenant, setCurrentTenant } = useTenant();

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const hasNoTenants = !isLoading && tenants.length === 0;

  if (hasNoTenants && !currentTenant) {
    return (
      <>
        <Button
          variant="default"
          onClick={() => setShowCreateDialog(true)}
          data-testid="button-create-first-workspace"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Your First Workspace
        </Button>
        <CreateWorkspaceDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[200px] justify-between"
            data-testid="button-workspace-switcher"
          >
            <span className="truncate">
              {currentTenant?.name || "Select workspace..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search workspace..." />
            <CommandList>
              <CommandEmpty>No workspace found.</CommandEmpty>
              <CommandGroup heading="Workspaces">
                {tenants.map((tenant) => (
                  <CommandItem
                    key={tenant.id}
                    onSelect={() => {
                      setCurrentTenant(tenant);
                      setOpen(false);
                    }}
                    data-testid={`workspace-${tenant.id}`}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        currentTenant?.id === tenant.id
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                    />
                    {tenant.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setShowCreateDialog(true);
                  }}
                  data-testid="button-create-workspace"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Workspace
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateWorkspaceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}
