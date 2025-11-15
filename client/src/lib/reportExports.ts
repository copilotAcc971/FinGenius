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
