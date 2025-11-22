/**
 * Report Export Component
 * Export buttons for CSV, Excel, and PDF formats
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, FileJson, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReportExportProps {
  reportType: 'profit-loss' | 'balance-sheet' | 'trial-balance' | 'cash-flow';
  reportData?: any;
  filters?: any;
  onExport: (format: 'csv' | 'xlsx' | 'json' | 'pdf') => Promise<void>;
  onPrint?: () => void;
  className?: string;
}

export function ReportExport({
  reportType,
  reportData,
  filters,
  onExport,
  onPrint,
  className = ''
}: ReportExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async (format: 'csv' | 'xlsx' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      await onExport(format);
      toast({
        title: 'Export Successful',
        description: `Report exported as ${format.toUpperCase()} successfully.`
      });
    } catch (error: any) {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export report',
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={!reportData || isExporting}
            data-testid="button-export"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Export Format</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
            data-testid="menu-item-export-excel"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            data-testid="menu-item-export-csv"
          >
            <FileText className="mr-2 h-4 w-4" />
            CSV (.csv)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport('json')}
            disabled={isExporting}
            data-testid="menu-item-export-json"
          >
            <FileJson className="mr-2 h-4 w-4" />
            JSON (.json)
          </DropdownMenuItem>
          {/* PDF export would require additional implementation */}
          {/* <DropdownMenuItem
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
            data-testid="menu-item-export-pdf"
          >
            <FileText className="mr-2 h-4 w-4" />
            PDF (.pdf)
          </DropdownMenuItem> */}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        onClick={handlePrint}
        disabled={!reportData}
        data-testid="button-print"
      >
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
    </div>
  );
}