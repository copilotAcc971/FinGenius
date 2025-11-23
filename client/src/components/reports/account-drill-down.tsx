/**
 * Account Drill-Down Component
 * Modal to show transaction details for an account
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/shared/lib/api/queryClient';
import { useQuery } from '@tanstack/react-query';

interface JournalEntryLine {
  entryId: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  debit: string | null;
  credit: string | null;
  legDescription: string | null;
}

interface AccountDrillDownProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
  accountCode: string;
  startDate?: Date;
  endDate?: Date;
  tenantId: string;
}

export function AccountDrillDown({
  isOpen,
  onClose,
  accountId,
  accountName,
  accountCode,
  startDate,
  endDate,
  tenantId
}: AccountDrillDownProps) {
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  // Fetch journal entries for the account
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/reports/trial-balance/account', accountId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      
      const response = await apiRequest(
        `GET`,
        `/api/reports/trial-balance/account/${accountId}?${params.toString()}`
      );
      return response as JournalEntryLine[];
    },
    enabled: isOpen && !!accountId
  });

  // Calculate totals
  const totals = data?.reduce(
    (acc, entry) => {
      if (entry.debit) acc.debit += parseFloat(entry.debit);
      if (entry.credit) acc.credit += parseFloat(entry.credit);
      return acc;
    },
    { debit: 0, credit: 0 }
  ) || { debit: 0, credit: 0 };

  // Pagination
  const totalPages = Math.ceil((data?.length || 0) / itemsPerPage);
  const paginatedData = data?.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const formatCurrency = (amount: string | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(parseFloat(amount));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            Account Transactions: {accountCode} - {accountName}
          </DialogTitle>
          <DialogDescription>
            {startDate && endDate ? (
              <>
                Showing journal entries from {format(startDate, 'MMM dd, yyyy')} to{' '}
                {format(endDate, 'MMM dd, yyyy')}
              </>
            ) : (
              'Showing all journal entries for this account'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              Failed to load journal entries
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No journal entries found for this account
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entry #</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData?.map((entry) => (
                      <TableRow key={`${entry.entryId}-${entry.debit}-${entry.credit}`}>
                        <TableCell>
                          {format(new Date(entry.entryDate), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {entry.entryNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{entry.description}</p>
                            {entry.legDescription && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {entry.legDescription}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(entry.debit)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(entry.credit)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              // Navigate to journal entry detail
                              window.open(`/accounting/journal-entries/${entry.entryId}`, '_blank');
                            }}
                            data-testid={`button-view-entry-${entry.entryId}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="font-semibold border-t-2">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totals.debit.toString())}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totals.credit.toString())}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {((page - 1) * itemsPerPage) + 1} to{' '}
                    {Math.min(page * itemsPerPage, data.length)} of {data.length} entries
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}