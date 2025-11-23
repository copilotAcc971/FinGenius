/**
 * Report Filters Component
 * Date pickers and comparison options for reports
 */

import { useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { CalendarIcon, Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/utils/utils';

interface DateRangeFilters {
  startDate: Date;
  endDate: Date;
  compareWith?: 'year' | 'quarter' | 'month';
}

interface AsOfDateFilters {
  asOfDate: Date;
}

interface ReportFiltersProps {
  filterType: 'dateRange' | 'asOfDate';
  onFiltersChange: (filters: DateRangeFilters | AsOfDateFilters) => void;
  onRefresh: () => void;
  isLoading?: boolean;
  showComparison?: boolean;
  className?: string;
}

export function ReportFilters({
  filterType,
  onFiltersChange,
  onRefresh,
  isLoading = false,
  showComparison = false,
  className = ''
}: ReportFiltersProps) {
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState<Date>(startOfMonth);
  const [endDate, setEndDate] = useState<Date>(endOfMonth);
  const [asOfDate, setAsOfDate] = useState<Date>(currentDate);
  const [compareWith, setCompareWith] = useState<'year' | 'quarter' | 'month' | ''>('');

  const handleApplyFilters = () => {
    if (filterType === 'dateRange') {
      onFiltersChange({
        startDate,
        endDate,
        ...(compareWith && { compareWith })
      });
    } else {
      onFiltersChange({ asOfDate });
    }
  };

  const handleQuickSelect = (period: string) => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (period) {
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisQuarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'lastYear':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        return;
    }

    setStartDate(start);
    setEndDate(end);
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-4">
          {filterType === 'dateRange' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="startDate"
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !startDate && 'text-gray-500 dark:text-gray-400'
                        )}
                        data-testid="button-start-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="endDate"
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !endDate && 'text-gray-500 dark:text-gray-400'
                        )}
                        data-testid="button-end-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Quick select buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect('thisMonth')}
                  data-testid="button-this-month"
                >
                  This Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect('lastMonth')}
                  data-testid="button-last-month"
                >
                  Last Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect('thisQuarter')}
                  data-testid="button-this-quarter"
                >
                  This Quarter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect('thisYear')}
                  data-testid="button-this-year"
                >
                  This Year
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect('lastYear')}
                  data-testid="button-last-year"
                >
                  Last Year
                </Button>
              </div>
            </>
          ) : (
            <div>
              <Label htmlFor="asOfDate">As of Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="asOfDate"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !asOfDate && 'text-gray-500 dark:text-gray-400'
                    )}
                    data-testid="button-as-of-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {asOfDate ? format(asOfDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={asOfDate}
                    onSelect={(date) => date && setAsOfDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {showComparison && filterType === 'dateRange' && (
            <div>
              <Label htmlFor="compareWith">Compare With</Label>
              <Select value={compareWith} onValueChange={(value: any) => setCompareWith(value)}>
                <SelectTrigger id="compareWith" data-testid="select-compare-with">
                  <SelectValue placeholder="Select comparison period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Comparison</SelectItem>
                  <SelectItem value="year">Previous Year</SelectItem>
                  <SelectItem value="quarter">Previous Quarter</SelectItem>
                  <SelectItem value="month">Previous Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleApplyFilters}
              disabled={isLoading}
              className="flex-1"
              data-testid="button-apply-filters"
            >
              <Search className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={isLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}