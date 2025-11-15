import * as XLSX from 'xlsx';

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadExcel(data: any[][], filename: string, sheetName: string) {
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  XLSX.writeFile(wb, filename);
}

export function formatPercentage(value: number | "Infinity" | "-Infinity" | undefined | null): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (value === "Infinity") {
    return "∞%";
  }
  if (value === "-Infinity") {
    return "-∞%";
  }
  if (typeof value === "number") {
    return `${value.toFixed(1)}%`;
  }
  return "";
}

export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    return;
  }
  
  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that need quoting (contain comma, quote, or newline)
        if (value === null || value === undefined) return '';
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(',')
    )
  ].join('\n');
  
  downloadCSV(csvContent, filename);
}

export function exportToExcel(data: any[], filename: string, sheetName: string = 'Report') {
  if (!data || data.length === 0) {
    return;
  }
  
  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Convert data to 2D array format
  const excelData = [
    headers,
    ...data.map(row => headers.map(header => row[header] ?? ''))
  ];
  
  // Add .xlsx extension if not present
  const excelFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  
  downloadExcel(excelData, excelFilename, sheetName);
}
