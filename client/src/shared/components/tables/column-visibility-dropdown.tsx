import { Settings2, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { AdvancedColumnDef } from '@/shared/lib/utils/advanced-table-types';

interface ColumnVisibilityDropdownProps<TData> {
  columns: AdvancedColumnDef<TData>[];
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (visibility: Record<string, boolean>) => void;
  onResetToDefault: () => void;
}

export function ColumnVisibilityDropdown<TData>({
  columns,
  columnVisibility,
  onColumnVisibilityChange,
  onResetToDefault,
}: ColumnVisibilityDropdownProps<TData>) {
  const toggleColumn = (columnKey: string) => {
    onColumnVisibilityChange({
      ...columnVisibility,
      [columnKey]: !columnVisibility[columnKey],
    });
  };

  const hideableColumns = columns.filter(col => col.enableHiding !== false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-column-visibility"
        >
          <Settings2 className="h-4 w-4 mr-2" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {hideableColumns.map(column => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={columnVisibility[column.key] !== false}
            onCheckedChange={() => toggleColumn(column.key)}
            data-testid={`checkbox-column-${column.key}`}
          >
            {column.header}
          </DropdownMenuCheckboxItem>
        ))}
        {hideableColumns.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              onSelect={(e) => {
                e.preventDefault();
                onResetToDefault();
              }}
              className="justify-center text-sm text-muted-foreground"
              data-testid="button-reset-columns"
            >
              <RotateCcw className="h-3 w-3 mr-2" />
              Reset to default
            </DropdownMenuCheckboxItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
