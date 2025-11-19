# Advanced Data Table System

Enterprise-grade data table system built with TanStack Table v8 for production use in Copilot Accountant.

## Overview

The Advanced Data Table provides a full-featured, accessible, and performant table component with:
- ✅ Sorting (single and multi-column)
- ✅ Global search and advanced filtering
- ✅ Column visibility management
- ✅ Row selection with bulk actions
- ✅ Pagination with customizable page sizes
- ✅ CSV/Excel export
- ✅ LocalStorage persistence
- ✅ Full TypeScript support
- ✅ WCAG AA accessibility
- ✅ Monochrome design system integration

## Quick Start

```tsx
import { AdvancedDataTable } from '@/shared/components/tables';
import { AdvancedColumnDef } from '@/shared/lib/utils/advanced-table-types';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid';
}

const columns: AdvancedColumnDef<Invoice>[] = [
  {
    key: 'invoiceNumber',
    header: 'Invoice #',
    accessorKey: 'invoiceNumber',
    width: '150px',
    enableSorting: true,
    enableFiltering: true,
  },
  {
    key: 'customerName',
    header: 'Customer',
    accessorKey: 'customerName',
    minWidth: '200px',
  },
  {
    key: 'amount',
    header: 'Amount',
    accessorKey: 'amount',
    align: 'right',
    cell: ({ getValue }) => formatCurrency(getValue()),
    filterFn: 'number',
  },
];

export function InvoicesTable() {
  const [data, setData] = useState<Invoice[]>([]);

  return (
    <AdvancedDataTable
      tableId="invoices"
      columns={columns}
      data={data}
      enableRowSelection
      enableFiltering
      enableSorting
      enablePagination
      enableExport
    />
  );
}
```

## Column Definition

### Basic Properties
```typescript
interface AdvancedColumnDef<TData> {
  key: string;              // Unique identifier
  header: string;           // Column header text
  accessorKey?: string;     // Path to data property
  accessorFn?: (row: TData) => any;  // Custom accessor function
  
  // Dimensions
  width?: string;           // Fixed width (e.g., "150px")
  minWidth?: string;        // Minimum width
  maxWidth?: string;        // Maximum width
  align?: 'left' | 'center' | 'right';
  className?: string;       // Additional CSS classes
}
```

### Advanced Features
```typescript
{
  // Custom rendering
  cell?: (info: CellContext) => ReactNode;
  
  // Feature toggles
  enableSorting?: boolean;      // Default: true
  enableFiltering?: boolean;    // Default: true
  enableHiding?: boolean;       // Default: true
  
  // Filtering
  filterFn?: 'text' | 'number' | 'date' | 'select';
  filterOptions?: string[];     // For select filters
  
  // Visibility
  defaultHidden?: boolean;      // Initially hidden
}
```

## Component Props

### AdvancedDataTable
```typescript
interface AdvancedDataTableProps<TData> {
  // Required
  columns: AdvancedColumnDef<TData>[];
  data: TData[];
  
  // Optional
  tableId?: string;                    // For localStorage persistence
  loading?: boolean;                   // Show skeleton loader
  defaultPageSize?: number;            // Default: 25
  
  // Features
  enableRowSelection?: boolean;        // Default: false
  enableFiltering?: boolean;           // Default: true
  enableSorting?: boolean;            // Default: true
  enablePagination?: boolean;         // Default: true
  enableExport?: boolean;             // Default: true
  
  // Interactions
  onRowClick?: (row: TData) => void;
  onBulkAction?: (action: string, rows: TData[]) => void;
  bulkActions?: BulkAction[];
  
  // UI
  emptyState?: ReactNode;
  className?: string;
}
```

## Features

### 1. Sorting
Click column headers to sort. The table supports:
- Single column sorting (click once for ascending, twice for descending)
- Visual indicators (up/down arrows)
- Configurable per column via `enableSorting`

```tsx
{
  key: 'amount',
  header: 'Amount',
  accessorKey: 'amount',
  enableSorting: true,
  sortingFn: 'alphanumeric',  // or 'datetime', 'basic'
}
```

### 2. Global Search
Search across all filterable columns:
```tsx
<AdvancedDataTable
  columns={columns}
  data={data}
  enableFiltering={true}  // Enables global search
/>
```

### 3. Advanced Filtering
Click "Add Filter" to create column-specific filters:
- **Text columns:** contains, equals, starts with, ends with
- **Number columns:** >, <, >=, <=, equals
- **Date columns:** before, after, equals
- **Select columns:** dropdown with options

```tsx
{
  key: 'status',
  header: 'Status',
  accessorKey: 'status',
  filterFn: 'select',
  filterOptions: ['draft', 'sent', 'paid'],
}
```

### 4. Column Visibility
Click "Columns" dropdown to:
- Show/hide individual columns
- Reset to default configuration
- Preferences persist in localStorage

```tsx
{
  key: 'description',
  header: 'Description',
  accessorKey: 'description',
  defaultHidden: true,  // Initially hidden
  enableHiding: true,   // Can be toggled
}
```

### 5. Row Selection & Bulk Actions
Select rows and perform bulk operations:
```tsx
const bulkActions: BulkAction[] = [
  {
    label: 'Delete',
    value: 'delete',
    icon: <Trash2 className="h-4 w-4 mr-2" />,
    variant: 'destructive',
  },
];

<AdvancedDataTable
  columns={columns}
  data={data}
  enableRowSelection={true}
  bulkActions={bulkActions}
  onBulkAction={(action, rows) => {
    console.log(`Action: ${action}, Rows:`, rows);
  }}
/>
```

### 6. Export
Export visible data to CSV or Excel:
- Respects column visibility settings
- Exports only selected rows if any are selected
- Custom filename per table via `tableId`

```tsx
<AdvancedDataTable
  tableId="invoices-2024"
  enableExport={true}
  // ...
/>
```

Export functions are also available standalone:
```tsx
import { exportTableToCSV, exportTableToExcel } from '@/shared/lib/exports/table-export';

exportTableToCSV(data, columns, 'invoices.csv', {
  visibleColumnsOnly: columnVisibility,
  selectedRowsOnly: selectedRows,
});
```

### 7. Pagination
Customizable pagination with:
- Rows per page selector (10, 25, 50, 100)
- Previous/Next navigation
- Page count display
- Row range display ("Showing 1-25 of 100 rows")

```tsx
<AdvancedDataTable
  defaultPageSize={25}
  enablePagination={true}
  // ...
/>
```

## Custom Cell Rendering

```tsx
{
  key: 'status',
  header: 'Status',
  accessorKey: 'status',
  cell: ({ getValue, row }) => {
    const status = getValue() as string;
    return (
      <Badge variant={getStatusVariant(status)}>
        {status}
      </Badge>
    );
  },
}
```

## Demo Page

Visit `/demo/advanced-table` to see all features in action with sample invoice data.

## Accessibility

The table follows WCAG 2.1 AA guidelines:
- ✅ All interactive elements have `data-testid` attributes
- ✅ Keyboard navigation (Tab, Enter, Space, Arrow keys)
- ✅ ARIA labels on all buttons and inputs
- ✅ Focus states on all interactive elements
- ✅ Screen reader compatible
- ✅ High contrast support

## Performance

- Uses `useMemo` and `useCallback` to minimize re-renders
- Global search is debounced (300ms)
- Column definitions are memoized
- Pagination reduces DOM nodes
- Virtual scrolling ready (can add @tanstack/react-virtual)

## LocalStorage Persistence

Column visibility preferences are automatically saved:
```typescript
// Key format: table-columns-{tableId}
localStorage.setItem('table-columns-invoices', JSON.stringify({
  description: false,
  emailStatus: true,
  // ...
}));
```

## TypeScript Support

Full TypeScript support with generic types:
```tsx
interface MyData {
  id: string;
  name: string;
}

const columns: AdvancedColumnDef<MyData>[] = [...];
const data: MyData[] = [...];

<AdvancedDataTable<MyData>
  columns={columns}
  data={data}
  onRowClick={(row: MyData) => console.log(row.name)}
/>
```

## Files Structure

```
client/src/shared/
├── components/tables/
│   ├── advanced-data-table.tsx       # Main table component
│   ├── column-visibility-dropdown.tsx # Column toggle UI
│   ├── table-filter-bar.tsx          # Filter UI
│   ├── index.ts                      # Barrel export
│   └── README.md                     # This file
├── lib/
│   ├── utils/
│   │   ├── advanced-table-types.ts   # TypeScript definitions
│   │   └── table-columns.tsx         # Column definitions
│   └── exports/
│       └── table-export.ts           # CSV/Excel export
└── pages/
    └── advanced-table-demo-page.tsx  # Demo page
```

## Migration from Basic Tables

Existing basic tables can be gradually migrated:

1. **Keep existing TableColumnDef:**
   ```tsx
   // Still works - basic columns
   const columns: TableColumnDef[] = [...];
   ```

2. **Upgrade to AdvancedColumnDef:**
   ```tsx
   // Enhanced columns with new features
   const columns: AdvancedColumnDef<Invoice>[] = [
     {
       ...basicColumn,
       accessorKey: 'invoiceNumber',
       enableSorting: true,
       filterFn: 'text',
     },
   ];
   ```

3. **Use AdvancedDataTable:**
   ```tsx
   <AdvancedDataTable
     columns={columns}
     data={data}
     enableRowSelection
     enableFiltering
   />
   ```

## Best Practices

1. **Always provide a unique `tableId`** for localStorage persistence
2. **Use `accessorKey` for simple data paths**, `accessorFn` for computed values
3. **Set `defaultHidden: true`** for non-essential columns
4. **Use `filterFn` to enable smart filtering** (number, date, select)
5. **Memoize column definitions** to prevent re-renders
6. **Provide meaningful `data-testid`** attributes for testing
7. **Use monospace fonts** (`font-mono`) for financial data
8. **Right-align numerical columns** with `align: 'right'`

## Troubleshooting

### Columns not sorting
- Ensure `enableSorting` is not set to `false`
- Check that `accessorKey` or `accessorFn` is provided

### Filters not working
- Verify `enableFiltering` is true on table and column
- Ensure `accessorKey` is defined
- Check `filterFn` type matches data type

### LocalStorage not persisting
- Verify unique `tableId` is provided
- Check browser's localStorage is enabled
- Inspect `localStorage.getItem('table-columns-{tableId}')`

### Export not including all data
- Exports respect column visibility
- Exports only selected rows if any are selected
- Check column visibility state

## Future Enhancements

Potential features for future iterations:
- [ ] Column reordering (drag and drop)
- [ ] Column resizing (drag borders)
- [ ] Saved views (filter/sort presets)
- [ ] Virtual scrolling (@tanstack/react-virtual)
- [ ] Multi-column sorting (Shift+Click)
- [ ] Column pinning (freeze left/right)
- [ ] Row grouping/aggregation
- [ ] Inline editing
- [ ] Advanced date range filters
- [ ] Export to PDF
