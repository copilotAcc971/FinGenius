import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface FunctionCallConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  functionCall: { name: string; args: any; callId: string } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const FUNCTION_DESCRIPTIONS: Record<string, { title: string; description: string; isCritical: boolean }> = {
  get_outstanding_invoices: {
    title: 'View Outstanding Invoices',
    description: 'Retrieve a list of unpaid invoices',
    isCritical: false
  },
  create_invoice: {
    title: 'Create New Invoice',
    description: 'Create a new invoice in your accounting system',
    isCritical: true
  },
  record_payment: {
    title: 'Record Payment',
    description: 'Record a payment transaction',
    isCritical: true
  },
  get_customer_info: {
    title: 'View Customer Information',
    description: 'Retrieve customer details',
    isCritical: false
  },
  get_financial_summary: {
    title: 'View Financial Summary',
    description: 'Get an overview of your financial data',
    isCritical: false
  }
};

export function FunctionConfirmationDialog({
  open,
  onOpenChange,
  functionCall,
  onConfirm,
  onCancel
}: FunctionCallConfirmationProps) {
  if (!functionCall) return null;

  const functionInfo = FUNCTION_DESCRIPTIONS[functionCall.name] || {
    title: functionCall.name,
    description: 'Perform an action',
    isCritical: false
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-ai-function-confirm" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Confirm AI Action</DialogTitle>
          <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
            The AI assistant wants to perform the following action
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="rounded-md border border-gray-200 dark:border-neutral-800 p-4 bg-gray-50 dark:bg-neutral-900">
            <div className="font-semibold text-base text-gray-900 dark:text-white mb-2">
              {functionInfo.title}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {functionInfo.description}
            </div>
            <div className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-white dark:bg-black p-2 rounded border border-gray-200 dark:border-neutral-800 overflow-x-auto">
              {JSON.stringify(functionCall.args, null, 2)}
            </div>
          </div>
          
          {functionInfo.isCritical && (
            <Alert variant="destructive" className="border-red-200 dark:border-red-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                This is a critical action that will modify your accounting data.
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={onCancel}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            data-testid="button-confirm"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
