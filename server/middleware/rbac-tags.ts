/**
 * RBAC Tagging System
 * 
 * Mark endpoints that need RBAC without implementing it yet.
 * This allows us to fix core logic first, then apply RBAC uniformly at the end.
 */

export interface RBACTag {
  endpoint: string;
  method: string;
  permissions: string[];
  status: 'TAGGED' | 'READY_FOR_RBAC' | 'RBAC_APPLIED';
  notes?: string;
}

class RBACTagger {
  private tags: Map<string, RBACTag> = new Map();

  tag(endpoint: string, method: string, permissions: string[], notes?: string) {
    const key = `${method.toUpperCase()} ${endpoint}`;
    this.tags.set(key, {
      endpoint,
      method: method.toUpperCase(),
      permissions,
      status: 'TAGGED',
      notes
    });
  }

  getReport() {
    const report = {
      total: this.tags.size,
      byStatus: {
        TAGGED: 0,
        READY_FOR_RBAC: 0,
        RBAC_APPLIED: 0
      },
      endpoints: Array.from(this.tags.values())
        .sort((a, b) => a.endpoint.localeCompare(b.endpoint))
    };

    report.endpoints.forEach(ep => {
      report.byStatus[ep.status]++;
    });

    return report;
  }

  saveReport(filePath: string) {
    const fs = require('fs');
    fs.writeFileSync(filePath, JSON.stringify(this.getReport(), null, 2));
  }
}

export const rbacTagger = new RBACTagger();

// Tags for endpoints needing RBAC
// Format: rbacTagger.tag(endpoint, method, permissions, notes)

// CUSTOMERS
rbacTagger.tag('/api/customers', 'GET', ['customers.read']);
rbacTagger.tag('/api/customers', 'POST', ['customers.create']);
rbacTagger.tag('/api/customers/:id', 'DELETE', ['customers.delete']);

// VENDORS
rbacTagger.tag('/api/vendors', 'GET', ['vendors.read']);
rbacTagger.tag('/api/vendors', 'POST', ['vendors.create']);
rbacTagger.tag('/api/vendors/:id', 'DELETE', ['vendors.delete']);

// INVOICES
rbacTagger.tag('/api/invoices', 'GET', ['invoices.read']);
rbacTagger.tag('/api/invoices', 'POST', ['invoices.create']);
rbacTagger.tag('/api/invoices/:id', 'PATCH', ['invoices.update']);
rbacTagger.tag('/api/invoices/:id', 'DELETE', ['invoices.delete']);
rbacTagger.tag('/api/invoices/:id/send', 'POST', ['invoices.send']);
rbacTagger.tag('/api/invoices/:id/void', 'POST', ['invoices.void']);

// BILLS
rbacTagger.tag('/api/bills', 'GET', ['bills.read']);
rbacTagger.tag('/api/bills', 'POST', ['bills.create']);
rbacTagger.tag('/api/bills/:id', 'PATCH', ['bills.update']);
rbacTagger.tag('/api/bills/:id', 'DELETE', ['bills.delete']);

// PAYMENTS
rbacTagger.tag('/api/payments', 'GET', ['payments.read']);
rbacTagger.tag('/api/payments', 'POST', ['payments.create']);
rbacTagger.tag('/api/payments/:id', 'DELETE', ['payments.delete']);

// ACCOUNTS
rbacTagger.tag('/api/accounts', 'GET', ['accounts.read']);
rbacTagger.tag('/api/accounts', 'POST', ['accounts.create']);
rbacTagger.tag('/api/accounts/:id', 'DELETE', ['accounts.delete']);

// JOURNAL ENTRIES
rbacTagger.tag('/api/journal-entries', 'GET', ['journal_entries.read']);
rbacTagger.tag('/api/journal-entries', 'POST', ['journal_entries.create']);
rbacTagger.tag('/api/journal-entries/:id/approve', 'POST', ['journal_entries.approve']);
rbacTagger.tag('/api/journal-entries/:id', 'DELETE', ['journal_entries.delete']);

// ITEMS
rbacTagger.tag('/api/items', 'GET', ['items.read']);
rbacTagger.tag('/api/items', 'POST', ['items.create']);
rbacTagger.tag('/api/items/:id', 'DELETE', ['items.delete']);

// TAXES
rbacTagger.tag('/api/taxes', 'GET', ['taxes.read']);
rbacTagger.tag('/api/taxes', 'POST', ['taxes.create']);
rbacTagger.tag('/api/taxes/:id', 'DELETE', ['taxes.delete']);

// REPORTS
rbacTagger.tag('/api/reports/profit-loss', 'GET', ['reports.read']);
rbacTagger.tag('/api/reports/balance-sheet', 'GET', ['reports.read']);
rbacTagger.tag('/api/reports/cash-flow', 'GET', ['reports.read']);

// SETTINGS
rbacTagger.tag('/api/company-profile', 'GET', ['settings:read']);
rbacTagger.tag('/api/company-profile', 'POST', ['settings:update']);
rbacTagger.tag('/api/company-profile', 'PATCH', ['settings:update']);

// Export the tagger for use in route files
export default rbacTagger;