/**
 * Report Header Component
 * Displays company info, report title, and date range
 */

import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

interface ReportHeaderProps {
  companyName: string;
  reportTitle: string;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  asOfDate?: Date;
  currency?: string;
  className?: string;
}

export function ReportHeader({
  companyName,
  reportTitle,
  dateRange,
  asOfDate,
  currency = 'USD',
  className = ''
}: ReportHeaderProps) {
  return (
    <Card className={`p-6 ${className}`}>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {companyName}
        </h1>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {reportTitle}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {asOfDate ? (
            <>As of {format(asOfDate, 'MMMM dd, yyyy')}</>
          ) : dateRange ? (
            <>
              For the period {format(dateRange.startDate, 'MMM dd, yyyy')} to{' '}
              {format(dateRange.endDate, 'MMM dd, yyyy')}
            </>
          ) : null}
        </p>
        {currency && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All amounts in {currency}
          </p>
        )}
      </div>
      <Separator className="mt-4" />
      <div className="mt-4 flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}</span>
        <span>Page 1</span>
      </div>
    </Card>
  );
}