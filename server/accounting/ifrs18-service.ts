import { type Account } from "@shared/schema";

export interface Ifrs18ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface Ifrs18Subtotal {
  subtotal: string;
  amount: string;
  accounts: Account[];
}

export interface Ifrs18Metadata {
  categorization: {
    operating_income: Account[];
    operating_expense: Account[];
    investing_income: Account[];
    investing_expense: Account[];
    financing_income: Account[];
    financing_expense: Account[];
  };
  subtotals: {
    operatingProfit: string;
    profitBeforeFinancing: string;
    netProfit: string;
  };
  completeness: {
    totalIncomeAccounts: number;
    categorizedIncomeAccounts: number;
    totalExpenseAccounts: number;
    categorizedExpenseAccounts: number;
    missingTags: Account[];
  };
  effectiveDate: string;
}

/**
 * Validates IFRS 18 categorization for an account
 * Rules:
 * - Income accounts: operating_income, investing_income, financing_income, none
 * - Expense accounts: operating_expense, investing_expense, financing_expense, none
 * - Asset/liability/equity accounts: must be 'none'
 */
export function validateIfrs18Tags(account: Account): Ifrs18ValidationResult {
  const errors: string[] = [];

  // Validate based on account type
  if (account.type === 'income') {
    const validCategories = ['operating_income', 'investing_income', 'financing_income', 'none'];
    if (!validCategories.includes(account.ifrs18Category)) {
      errors.push(`Income accounts must have IFRS 18 category: ${validCategories.join(', ')}`);
    }
  } else if (account.type === 'expense') {
    const validCategories = ['operating_expense', 'investing_expense', 'financing_expense', 'none'];
    if (!validCategories.includes(account.ifrs18Category)) {
      errors.push(`Expense accounts must have IFRS 18 category: ${validCategories.join(', ')}`);
    }
  } else if (['asset', 'liability', 'equity'].includes(account.type)) {
    if (account.ifrs18Category !== 'none') {
      errors.push(`${account.type.charAt(0).toUpperCase() + account.type.slice(1)} accounts must have IFRS 18 category 'none'`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates required IFRS 18 subtotals from accounts
 * Returns: Operating Profit, Profit Before Financing, Net Profit
 */
export function getRequiredSubtotals(accounts: Account[]): Ifrs18Subtotal[] {
  const operatingIncome = accounts.filter(a => a.ifrs18Category === 'operating_income');
  const operatingExpense = accounts.filter(a => a.ifrs18Category === 'operating_expense');
  const investingIncome = accounts.filter(a => a.ifrs18Category === 'investing_income');
  const investingExpense = accounts.filter(a => a.ifrs18Category === 'investing_expense');
  const financingIncome = accounts.filter(a => a.ifrs18Category === 'financing_income');
  const financingExpense = accounts.filter(a => a.ifrs18Category === 'financing_expense');

  const sumBalance = (accts: Account[]) => 
    accts.reduce((sum, a) => sum + parseFloat(a.currentBalance || "0"), 0);

  const operatingIncomeTotal = sumBalance(operatingIncome);
  const operatingExpenseTotal = sumBalance(operatingExpense);
  const investingIncomeTotal = sumBalance(investingIncome);
  const investingExpenseTotal = sumBalance(investingExpense);
  const financingIncomeTotal = sumBalance(financingIncome);
  const financingExpenseTotal = sumBalance(financingExpense);

  const operatingProfit = operatingIncomeTotal - operatingExpenseTotal;
  const profitBeforeFinancing = operatingProfit + investingIncomeTotal - investingExpenseTotal;
  const netProfit = profitBeforeFinancing + financingIncomeTotal - financingExpenseTotal;

  return [
    {
      subtotal: 'Operating Profit',
      amount: operatingProfit.toFixed(2),
      accounts: [...operatingIncome, ...operatingExpense],
    },
    {
      subtotal: 'Profit Before Financing',
      amount: profitBeforeFinancing.toFixed(2),
      accounts: [...operatingIncome, ...operatingExpense, ...investingIncome, ...investingExpense],
    },
    {
      subtotal: 'Net Profit',
      amount: netProfit.toFixed(2),
      accounts: [...operatingIncome, ...operatingExpense, ...investingIncome, ...investingExpense, ...financingIncome, ...financingExpense],
    },
  ];
}

/**
 * Generates comprehensive IFRS 18 metadata for export/audit
 */
export function generateIfrs18Metadata(accounts: Account[]): Ifrs18Metadata {
  const incomeAccounts = accounts.filter(a => a.type === 'income');
  const expenseAccounts = accounts.filter(a => a.type === 'expense');

  const categorizedIncome = incomeAccounts.filter(a => a.ifrs18Category !== 'none');
  const categorizedExpense = expenseAccounts.filter(a => a.ifrs18Category !== 'none');

  const missingTags = [
    ...incomeAccounts.filter(a => a.ifrs18Category === 'none'),
    ...expenseAccounts.filter(a => a.ifrs18Category === 'none'),
  ];

  const categorization = {
    operating_income: accounts.filter(a => a.ifrs18Category === 'operating_income'),
    operating_expense: accounts.filter(a => a.ifrs18Category === 'operating_expense'),
    investing_income: accounts.filter(a => a.ifrs18Category === 'investing_income'),
    investing_expense: accounts.filter(a => a.ifrs18Category === 'investing_expense'),
    financing_income: accounts.filter(a => a.ifrs18Category === 'financing_income'),
    financing_expense: accounts.filter(a => a.ifrs18Category === 'financing_expense'),
  };

  const sumBalance = (accts: Account[]) => 
    accts.reduce((sum, a) => sum + parseFloat(a.currentBalance || "0"), 0);

  const operatingProfit = sumBalance(categorization.operating_income) - sumBalance(categorization.operating_expense);
  const profitBeforeFinancing = operatingProfit + 
    sumBalance(categorization.investing_income) - 
    sumBalance(categorization.investing_expense);
  const netProfit = profitBeforeFinancing + 
    sumBalance(categorization.financing_income) - 
    sumBalance(categorization.financing_expense);

  return {
    categorization,
    subtotals: {
      operatingProfit: operatingProfit.toFixed(2),
      profitBeforeFinancing: profitBeforeFinancing.toFixed(2),
      netProfit: netProfit.toFixed(2),
    },
    completeness: {
      totalIncomeAccounts: incomeAccounts.length,
      categorizedIncomeAccounts: categorizedIncome.length,
      totalExpenseAccounts: expenseAccounts.length,
      categorizedExpenseAccounts: categorizedExpense.length,
      missingTags,
    },
    effectiveDate: "2027-01-01",
  };
}
