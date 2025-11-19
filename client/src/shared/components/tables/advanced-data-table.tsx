import { useState, useMemo, useEffect, useCallback, ReactNode } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Download, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { TableSkeleton } from '@/shared/components/ui/skeleton';
import { ColumnVisibilityDropdown } from './column-visibility-dropdown';
import { TableFilterBar } from './table-filter-bar';
import { AdvancedColumnDef, BulkAction, TableFilter } from '@/shared/lib/utils/advanced-table-types';
import { exportTableToCSV, exportTableToExcel } from '@/shared/lib/exports/table-export';
import { cn } from '@/shared/lib/utils/utils';

export interface AdvancedDataTableProps<TData> {
  columns: AdvancedColumnDef<TData>[];
  data: TData[];
  tableId?: string;
  onRowClick?: (row: TData) => void;
  onBulkAction?: (action: string, rows: TData[]) => void;
  bulkActions?: BulkAction[];
  loading?: boolean;
  defaultPageSize?: number;
  enableRowSelection?: boolean;
  enableColumnResizing?: boolean;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enablePagination?: boolean;
  enableExport?: boolean;
  emptyState?: ReactNode;
  className?: string;
}

export function AdvancedDataTable<TData>({
  columns,
  data,
  tableId = 'advanced-table',
  onRowClick,
  onBulkAction,
  bulkActions = [],
  loading = false,
  defaultPageSize = 25,
  enableRowSelection = false,
  enableColumnResizing = false,
  enableFiltering = true,
  enableSorting = true,
  enablePagination = true,
  enableExport = true,
  emptyState,
  className,
}: AdvancedDataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const saved = localStorage.getItem(`table-columns-${tableId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    const initial: VisibilityState = {};
    columns.forEach(col => {
      if (col.defaultHidden) {
        initial[col.key] = false;
      }
    });
    return initial;
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [advancedFilters, setAdvancedFilters] = useState<TableFilter[]>([]);

  useEffect(() => {
    localStorage.setItem(`table-columns-${tableId}`, JSON.stringify(columnVisibility));
  }, [columnVisibility, tableId]);

  const resetColumnVisibility = useCallback(() => {
    const initial: VisibilityState = {};
    columns.forEach(col => {
      if (col.defaultHidden) {
        initial[col.key] = false;
      }
    });
    setColumnVisibility(initial);
  }, [columns]);

  const tableColumns = useMemo<ColumnDef<TData, any>[]>(() => {
    const cols: ColumnDef<TData, any>[] = [];

    if (enableRowSelection) {
      cols.push({
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            data-testid="checkbox-select-all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            data-testid={`checkbox-select-row-${row.index}`}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      });
    }

    columns.forEach(col => {
      const tanstackCol: ColumnDef<TData, any> = {
        id: col.key,
        accessorKey: col.accessorKey,
        accessorFn: col.accessorFn,
        header: ({ column }) => {
          if (!enableSorting || col.enableSorting === false) {
            return <div className={cn('font-medium', col.align && `text-${col.align}`)}>{col.header}</div>;
          }

          const isSorted = column.getIsSorted();
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className={cn('-ml-4 h-8 font-medium hover-elevate', col.align && `justify-${col.align}`)}
              data-testid={`button-sort-${col.key}`}
            >
              {col.header}
              {isSorted === 'asc' ? (
                <ArrowUp className="ml-2 h-4 w-4" />
              ) : isSorted === 'desc' ? (
                <ArrowDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
              )}
            </Button>
          );
        },
        cell: col.cell || (({ getValue }) => {
          const value = getValue();
          return (
            <div className={cn(col.className, col.align && `text-${col.align}`)}>
              {value !== null && value !== undefined ? String(value) : ''}
            </div>
          );
        }),
        enableSorting: enableSorting && col.enableSorting !== false,
        enableHiding: col.enableHiding !== false,
        sortingFn: col.sortingFn,
        size: col.width ? parseInt(col.width) : undefined,
        minSize: col.minWidth ? parseInt(col.minWidth) : undefined,
        maxSize: col.maxWidth ? parseInt(col.maxWidth) : undefined,
      };

      cols.push(tanstackCol);
    });

    return cols;
  }, [columns, enableRowSelection, enableSorting]);

  const handleGlobalFilterChange = useCallback((value: string) => {
    setGlobalFilter(value);
  }, []);

  const filteredData = useMemo(() => {
    if (advancedFilters.length === 0) return data;

    return data.filter(row => {
      return advancedFilters.every(filter => {
        const column = columns.find(col => col.key === filter.columnId || col.accessorKey === filter.columnId);
        if (!column) return true;

        let value: any;
        if (column.accessorFn) {
          value = column.accessorFn(row);
        } else if (column.accessorKey) {
          value = (row as any)[column.accessorKey];
        }

        const strValue = value !== null && value !== undefined ? String(value).toLowerCase() : '';
        const filterValue = String(filter.value).toLowerCase();

        switch (filter.operator) {
          case 'contains':
            return strValue.includes(filterValue);
          case 'equals':
            return strValue === filterValue;
          case 'startsWith':
            return strValue.startsWith(filterValue);
          case 'endsWith':
            return strValue.endsWith(filterValue);
          case 'greaterThan':
            return Number(value) > Number(filter.value);
          case 'lessThan':
            return Number(value) < Number(filter.value);
          case 'greaterThanOrEqual':
            return Number(value) >= Number(filter.value);
          case 'lessThanOrEqual':
            return Number(value) <= Number(filter.value);
          case 'isEmpty':
            return !value || strValue === '';
          case 'isNotEmpty':
            return !!value && strValue !== '';
          default:
            return true;
        }
      });
    });
  }, [data, advancedFilters, columns]);

  const table = useReactTable({
    data: filteredData,
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    initialState: {
      pagination: {
        pageSize: defaultPageSize,
      },
    },
  });

  const selectedRows = useMemo(() => {
    return table.getFilteredSelectedRowModel().rows.map(row => row.original);
  }, [table, rowSelection]);

  const handleExportCSV = () => {
    exportTableToCSV(data, columns, `${tableId}-export.csv`, {
      selectedRowsOnly: selectedRows.length > 0 ? selectedRows : undefined,
      visibleColumnsOnly: columnVisibility,
    });
  };

  const handleExportExcel = () => {
    exportTableToExcel(data, columns, `${tableId}-export.xlsx`, {
      sheetName: 'Data',
      selectedRowsOnly: selectedRows.length > 0 ? selectedRows : undefined,
      visibleColumnsOnly: columnVisibility,
    });
  };

  if (loading) {
    return <TableSkeleton columns={columns} rows={8} />;
  }

  const showBulkActions = enableRowSelection && selectedRows.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {enableFiltering && (
        <TableFilterBar
          columns={columns}
          globalFilter={globalFilter}
          onGlobalFilterChange={handleGlobalFilterChange}
          columnFilters={advancedFilters}
          onColumnFiltersChange={setAdvancedFilters}
        />
      )}

      <div className="flex items-center justify-between gap-4">
        {showBulkActions ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground" data-testid="text-selected-count">
              {selectedRows.length} row{selectedRows.length !== 1 ? 's' : ''} selected
            </span>
            {bulkActions.map(action => (
              <Button
                key={action.value}
                variant={action.variant || 'outline'}
                size="sm"
                onClick={() => onBulkAction?.(action.value, selectedRows)}
                data-testid={`button-bulk-${action.value}`}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex items-center gap-2">
          {enableExport && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                data-testid="button-export-excel"
              >
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </>
          )}

          <ColumnVisibilityDropdown
            columns={columns}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            onResetToDefault={resetColumnVisibility}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    style={{
                      width: header.getSize() !== 150 ? header.getSize() : undefined,
                    }}
                    className={cn(
                      header.column.getIsSorted() && 'bg-muted/50'
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    row.getIsSelected() && 'bg-muted/50'
                  )}
                  data-testid={`row-${row.index}`}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                  {emptyState || (
                    <div className="text-muted-foreground">
                      No results found.
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && (
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground" data-testid="text-pagination-info">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{' '}
            of {table.getFilteredRowModel().rows.length} rows
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm">Rows per page:</span>
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="w-20" data-testid="select-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map(size => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  data-testid="button-previous-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
