import { ReactNode } from 'react';
import { TableColumnDef } from './table-columns';

export interface AdvancedColumnDef<TData = any> extends TableColumnDef {
  key: string;
  header: string;
  
  // Existing from TableColumnDef
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  
  // NEW - Advanced features
  accessorKey?: string;
  accessorFn?: (row: TData) => any;
  cell?: (info: { getValue: () => any; row: { original: TData } }) => ReactNode;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableHiding?: boolean;
  enableResizing?: boolean;
  filterFn?: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'includesString';
  filterOptions?: string[];
  defaultHidden?: boolean;
  pinned?: 'left' | 'right' | false;
  aggregationFn?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  sortingFn?: 'alphanumeric' | 'datetime' | 'basic';
}

export interface TableFilter {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: any;
}

export type FilterOperator =
  | 'contains'
  | 'equals'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'between'
  | 'isEmpty'
  | 'isNotEmpty';

export interface SavedView {
  id: string;
  name: string;
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  filters: TableFilter[];
  sorting: Array<{ id: string; desc: boolean }>;
}

export interface BulkAction {
  label: string;
  value: string;
  icon?: ReactNode;
  variant?: 'default' | 'destructive';
}
