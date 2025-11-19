import { useState, useMemo } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { AdvancedColumnDef, TableFilter, FilterOperator } from '@/shared/lib/utils/advanced-table-types';
import { cn } from '@/shared/lib/utils/utils';

interface TableFilterBarProps<TData> {
  columns: AdvancedColumnDef<TData>[];
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  columnFilters: TableFilter[];
  onColumnFiltersChange: (filters: TableFilter[]) => void;
  className?: string;
}

const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'greaterThan', label: 'Greater than' },
  { value: 'lessThan', label: 'Less than' },
  { value: 'greaterThanOrEqual', label: 'Greater than or equal' },
  { value: 'lessThanOrEqual', label: 'Less than or equal' },
  { value: 'isEmpty', label: 'Is empty' },
  { value: 'isNotEmpty', label: 'Is not empty' },
];

export function TableFilterBar<TData>({
  columns,
  globalFilter,
  onGlobalFilterChange,
  columnFilters,
  onColumnFiltersChange,
  className,
}: TableFilterBarProps<TData>) {
  const [isAddingFilter, setIsAddingFilter] = useState(false);
  const [newFilterColumn, setNewFilterColumn] = useState('');
  const [newFilterOperator, setNewFilterOperator] = useState<FilterOperator>('contains');
  const [newFilterValue, setNewFilterValue] = useState('');

  const filterableColumns = useMemo(
    () => columns.filter(col => col.enableFiltering !== false && col.accessorKey),
    [columns]
  );

  const addFilter = () => {
    if (!newFilterColumn || (!newFilterValue && newFilterOperator !== 'isEmpty' && newFilterOperator !== 'isNotEmpty')) {
      return;
    }

    const newFilter: TableFilter = {
      id: `${newFilterColumn}-${Date.now()}`,
      columnId: newFilterColumn,
      operator: newFilterOperator,
      value: newFilterValue,
    };

    onColumnFiltersChange([...columnFilters, newFilter]);
    setNewFilterColumn('');
    setNewFilterOperator('contains');
    setNewFilterValue('');
    setIsAddingFilter(false);
  };

  const removeFilter = (filterId: string) => {
    onColumnFiltersChange(columnFilters.filter(f => f.id !== filterId));
  };

  const clearAllFilters = () => {
    onColumnFiltersChange([]);
    onGlobalFilterChange('');
  };

  const getColumnLabel = (columnId: string) => {
    const column = columns.find(col => col.key === columnId || col.accessorKey === columnId);
    return column?.header || columnId;
  };

  const getOperatorLabel = (operator: FilterOperator) => {
    return FILTER_OPERATORS.find(op => op.value === operator)?.label || operator;
  };

  const availableOperators = useMemo(() => {
    if (!newFilterColumn) return FILTER_OPERATORS;
    
    const column = columns.find(col => col.key === newFilterColumn || col.accessorKey === newFilterColumn);
    if (!column) return FILTER_OPERATORS;

    if (column.filterFn === 'number') {
      return FILTER_OPERATORS.filter(op => 
        ['equals', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual', 'isEmpty', 'isNotEmpty'].includes(op.value)
      );
    }

    if (column.filterFn === 'date') {
      return FILTER_OPERATORS.filter(op => 
        ['equals', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual'].includes(op.value)
      );
    }

    return FILTER_OPERATORS.filter(op => 
      ['contains', 'equals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'].includes(op.value)
    );
  }, [newFilterColumn, columns]);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search across all columns..."
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
            className="pl-9"
            data-testid="input-global-search"
          />
        </div>

        <Popover open={isAddingFilter} onOpenChange={setIsAddingFilter}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-add-filter"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Column</label>
                <Select value={newFilterColumn} onValueChange={setNewFilterColumn}>
                  <SelectTrigger data-testid="select-filter-column">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {filterableColumns.map(col => (
                      <SelectItem key={col.key} value={col.accessorKey || col.key}>
                        {col.header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Operator</label>
                <Select value={newFilterOperator} onValueChange={(v) => setNewFilterOperator(v as FilterOperator)}>
                  <SelectTrigger data-testid="select-filter-operator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOperators.map(op => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newFilterOperator !== 'isEmpty' && newFilterOperator !== 'isNotEmpty' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Value</label>
                  <Input
                    value={newFilterValue}
                    onChange={(e) => setNewFilterValue(e.target.value)}
                    placeholder="Enter filter value..."
                    data-testid="input-filter-value"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={addFilter}
                  size="sm"
                  className="flex-1"
                  data-testid="button-apply-filter"
                >
                  Apply Filter
                </Button>
                <Button
                  onClick={() => setIsAddingFilter(false)}
                  size="sm"
                  variant="outline"
                  data-testid="button-cancel-filter"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {(columnFilters.length > 0 || globalFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            data-testid="button-clear-all-filters"
          >
            Clear All
          </Button>
        )}
      </div>

      {columnFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {columnFilters.map(filter => (
            <Badge
              key={filter.id}
              variant="secondary"
              className="gap-1 pr-1"
              data-testid={`badge-filter-${filter.columnId}`}
            >
              <span className="font-medium">{getColumnLabel(filter.columnId)}</span>
              <span className="text-muted-foreground">{getOperatorLabel(filter.operator)}</span>
              {filter.value && <span>"{filter.value}"</span>}
              <button
                onClick={() => removeFilter(filter.id)}
                className="ml-1 rounded-sm hover:bg-muted p-0.5"
                data-testid={`button-remove-filter-${filter.columnId}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
