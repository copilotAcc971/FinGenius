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
import { CreateOrganizationDialog } from "@/features/auth/components/create-organization-dialog";

export function OrganizationSwitcher() {
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
          data-testid="button-create-first-organization"
          aria-label="Create a new organization"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Your First Organization
        </Button>
        <CreateOrganizationDialog
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
            aria-label="Switch organization"
            aria-haspopup="listbox"
            className="w-[200px] justify-between"
            data-testid="button-organization-switcher"
          >
            <span className="truncate">
              {currentTenant?.name || "Select organization..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search organization..." />
            <CommandList>
              <CommandEmpty>No organization found.</CommandEmpty>
              <CommandGroup heading="Organizations">
                {tenants.map((tenant) => (
                  <CommandItem
                    key={tenant.id}
                    onSelect={() => {
                      setCurrentTenant(tenant);
                      setOpen(false);
                    }}
                    data-testid={`organization-${tenant.id}`}
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
                  data-testid="button-create-organization"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Organization
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateOrganizationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}
