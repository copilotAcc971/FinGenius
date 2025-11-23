import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Users, DollarSign, CreditCard, Receipt, Zap } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface QuickCreateOption {
  label: string;
  icon: React.ReactNode;
  route: string;
  description: string;
  category: 'transactions' | 'contacts';
}

const quickCreateOptions: QuickCreateOption[] = [
  // Income & Transactions
  {
    label: 'Invoice',
    icon: <FileText className="w-4 h-4" />,
    route: '/income/invoices/new',
    description: 'Create a new invoice',
    category: 'transactions',
  },
  {
    label: 'Payment',
    icon: <DollarSign className="w-4 h-4" />,
    route: '/money/customer-payments/new',
    description: 'Record a customer payment',
    category: 'transactions',
  },
  {
    label: 'Credit Note',
    icon: <CreditCard className="w-4 h-4" />,
    route: '/income/credit-notes/new',
    description: 'Create a credit note',
    category: 'transactions',
  },
  {
    label: 'Expense',
    icon: <Receipt className="w-4 h-4" />,
    route: '/expenses/expenses/new',
    description: 'Record an expense',
    category: 'transactions',
  },
  // Contacts
  {
    label: 'Customer',
    icon: <Users className="w-4 h-4" />,
    route: '/contacts/customers/new',
    description: 'Add a new customer',
    category: 'contacts',
  },
  {
    label: 'Vendor',
    icon: <Users className="w-4 h-4" />,
    route: '/contacts/vendors/new',
    description: 'Add a new vendor',
    category: 'contacts',
  },
  {
    label: 'Bill',
    icon: <FileText className="w-4 h-4" />,
    route: '/expenses/bills/new',
    description: 'Create a new bill',
    category: 'transactions',
  },
  {
    label: 'Journal Entry',
    icon: <Zap className="w-4 h-4" />,
    route: '/accounting/journal-entries/new',
    description: 'Create a journal entry',
    category: 'transactions',
  },
];

export function QuickCreateFAB() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  const handleCreate = (route: string) => {
    navigate(route);
    setOpen(false);
  };

  const transactionOptions = quickCreateOptions.filter(opt => opt.category === 'transactions');
  const contactOptions = quickCreateOptions.filter(opt => opt.category === 'contacts');

  return (
    <div className="fixed bottom-6 right-6 z-40" data-testid="button-quick-create-fab">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className={cn(
              "h-14 w-14 rounded-full shadow-lg transition-all",
              "bg-primary hover:bg-primary/90",
              "relative",
              open && "scale-110"
            )}
            data-testid="button-fab-toggle"
          >
            <Plus className={cn(
              "w-6 h-6 transition-transform",
              open && "rotate-45"
            )} />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56" side="top">
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
            Transactions
          </DropdownMenuLabel>

          {transactionOptions.map(option => (
            <DropdownMenuItem
              key={option.route}
              onClick={() => handleCreate(option.route)}
              className="cursor-pointer"
              data-testid={`button-quick-create-${option.label.toLowerCase().replace(' ', '-')}`}
            >
              <div className="flex items-center gap-2 w-full">
                {option.icon}
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </div>
              </div>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
            Contacts
          </DropdownMenuLabel>

          {contactOptions.map(option => (
            <DropdownMenuItem
              key={option.route}
              onClick={() => handleCreate(option.route)}
              className="cursor-pointer"
              data-testid={`button-quick-create-${option.label.toLowerCase().replace(' ', '-')}`}
            >
              <div className="flex items-center gap-2 w-full">
                {option.icon}
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
