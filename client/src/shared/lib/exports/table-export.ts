import * as XLSX from 'xlsx';
import { AdvancedColumnDef } from '../utils/advanced-table-types';

export function exportTableToCSV<TData>(
  data: TData[],
  columns: AdvancedColumnDef<TData>[],
  filename: string,
  options: {
    selectedRowsOnly?: TData[];
    visibleColumnsOnly?: Record<string, boolean>;
  } = {}
): void {
  if (!data || data.length === 0) {
    return;
  }

  const { selectedRowsOnly, visibleColumnsOnly } = options;
  const exportData = selectedRowsOnly && selectedRowsOnly.length > 0 ? selectedRowsOnly : data;
  
  const visibleColumns = columns.filter(col => {
    if (visibleColumnsOnly) {
      return visibleColumnsOnly[col.key] !== false;
    }
    return !col.defaultHidden;
  });

  const headers = visibleColumns.map(col => col.header);
  
  const csvContent = [
    headers.join(','),
    ...exportData.map(row => 
      visibleColumns.map(col => {
        let value: any;
        
        if (col.accessorFn) {
          value = col.accessorFn(row);
        } else if (col.accessorKey) {
          value = (row as any)[col.accessorKey];
        } else {
          value = '';
        }
        
        if (value === null || value === undefined) return '';
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTableToExcel<TData>(
  data: TData[],
  columns: AdvancedColumnDef<TData>[],
  filename: string,
  options: {
    sheetName?: string;
    selectedRowsOnly?: TData[];
    visibleColumnsOnly?: Record<string, boolean>;
  } = {}
): void {
  if (!data || data.length === 0) {
    return;
  }

  const { sheetName = 'Sheet1', selectedRowsOnly, visibleColumnsOnly } = options;
  const exportData = selectedRowsOnly && selectedRowsOnly.length > 0 ? selectedRowsOnly : data;
  
  const visibleColumns = columns.filter(col => {
    if (visibleColumnsOnly) {
      return visibleColumnsOnly[col.key] !== false;
    }
    return !col.defaultHidden;
  });

  const headers = visibleColumns.map(col => col.header);
  
  const excelData = [
    headers,
    ...exportData.map(row => 
      visibleColumns.map(col => {
        let value: any;
        
        if (col.accessorFn) {
          value = col.accessorFn(row);
        } else if (col.accessorKey) {
          value = (row as any)[col.accessorKey];
        } else {
          value = '';
        }
        
        return value ?? '';
      })
    )
  ];

  const ws = XLSX.utils.aoa_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  const excelFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, excelFilename);
}
