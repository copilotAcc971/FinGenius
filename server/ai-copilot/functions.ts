import type { ChatCompletionTool } from "openai/resources/chat/completions";

export interface AccountingFunctionHandler {
  (args: any, context: { tenantId: string; userId: string }): Promise<any>;
}

export const accountingFunctions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "show_outstanding_invoices",
      description: "Retrieve and display all outstanding (unpaid) invoices. Can be filtered by customer.",
      parameters: {
        type: "object",
        properties: {
          customerId: {
            type: "string",
            description: "Optional customer ID to filter invoices for a specific customer"
          },
          limit: {
            type: "number",
            description: "Maximum number of invoices to return (default: 10)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "show_overdue_invoices",
      description: "Retrieve and display all overdue invoices that are past their due date",
      parameters: {
        type: "object",
        properties: {
          customerId: {
            type: "string",
            description: "Optional customer ID to filter invoices"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_customer_balance",
      description: "Get the current balance for a specific customer (total outstanding amount)",
      parameters: {
        type: "object",
        properties: {
          customerId: {
            type: "string",
            description: "The customer ID"
          }
        },
        required: ["customerId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_customers",
      description: "List all customers in the system",
      parameters: {
        type: "object",
        properties: {
          search: {
            type: "string",
            description: "Optional search term to filter customers by name or email"
          },
          limit: {
            type: "number",
            description: "Maximum number of customers to return (default: 20)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_profit_loss_report",
      description: "Generate a Profit & Loss (P&L) report for a specified date range",
      parameters: {
        type: "object",
        properties: {
          startDate: {
            type: "string",
            description: "Start date in YYYY-MM-DD format"
          },
          endDate: {
            type: "string",
            description: "End date in YYYY-MM-DD format"
          }
        },
        required: ["startDate", "endDate"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_balance_sheet",
      description: "Generate a Balance Sheet as of a specific date",
      parameters: {
        type: "object",
        properties: {
          asOfDate: {
            type: "string",
            description: "Date for the balance sheet in YYYY-MM-DD format (defaults to today)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "show_recent_transactions",
      description: "Show recent accounting transactions (journal entries)",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of transactions to show (default: 10)"
          },
          accountId: {
            type: "string",
            description: "Optional account ID to filter transactions"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_cash_flow_summary",
      description: "Get a summary of cash flow for a date range",
      parameters: {
        type: "object",
        properties: {
          startDate: {
            type: "string",
            description: "Start date in YYYY-MM-DD format"
          },
          endDate: {
            type: "string",
            description: "End date in YYYY-MM-DD format"
          }
        },
        required: ["startDate", "endDate"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_bills",
      description: "List bills (payables) filtered by status",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["unpaid", "paid", "overdue", "all"],
            description: "Filter bills by payment status"
          },
          vendorId: {
            type: "string",
            description: "Optional vendor ID to filter bills"
          },
          limit: {
            type: "number",
            description: "Maximum number of bills to return (default: 10)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "draft_journal_entry",
      description: "Create a draft journal entry that can be reviewed before posting. Saves with status='draft' and has no financial impact until posted. Requires 'journal_entries.create' permission.",
      parameters: {
        type: "object",
        properties: {
          entryDate: {
            type: "string",
            description: "Entry date in YYYY-MM-DD format"
          },
          description: {
            type: "string",
            description: "Description of the journal entry"
          },
          legs: {
            type: "array",
            description: "Journal entry legs (debits and credits must balance)",
            items: {
              type: "object",
              properties: {
                accountId: { type: "string", description: "Account ID" },
                type: { type: "string", enum: ["Debit", "Credit"], description: "Debit or Credit" },
                amount: { type: "number", description: "Amount" },
                description: { type: "string", description: "Optional line description" }
              },
              required: ["accountId", "type", "amount"]
            }
          },
          reference: {
            type: "string",
            description: "Optional reference number"
          }
        },
        required: ["entryDate", "description", "legs"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "post_journal_entry",
      description: "Post a draft journal entry to the ledger. This creates a permanent financial record and affects account balances. Requires 'journal_entries.post' permission (typically restricted to accountants/controllers).",
      parameters: {
        type: "object",
        properties: {
          journalEntryId: {
            type: "string",
            description: "The ID of the draft journal entry to post"
          }
        },
        required: ["journalEntryId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "draft_invoice",
      description: "Create a draft invoice that can be reviewed before posting. Saves with status='draft' and creates no journal entries. Requires 'invoices.create' permission.",
      parameters: {
        type: "object",
        properties: {
          customerId: {
            type: "string",
            description: "Customer ID"
          },
          items: {
            type: "array",
            description: "Line items for the invoice",
            items: {
              type: "object",
              properties: {
                itemId: { type: "string" },
                description: { type: "string" },
                quantity: { type: "number" },
                rate: { type: "number" }
              }
            }
          },
          invoiceDate: {
            type: "string",
            description: "Invoice date in YYYY-MM-DD format (defaults to today)"
          },
          dueDate: {
            type: "string",
            description: "Due date in YYYY-MM-DD format"
          },
          notes: {
            type: "string",
            description: "Optional notes for the invoice"
          }
        },
        required: ["customerId", "items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "post_invoice",
      description: "Post a draft invoice to the ledger. This creates journal entries for Accounts Receivable (debit) and Revenue (credit), making it a permanent financial record. Requires 'journal_entries.post' permission.",
      parameters: {
        type: "object",
        properties: {
          invoiceId: {
            type: "string",
            description: "The ID of the draft invoice to post"
          }
        },
        required: ["invoiceId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "draft_bill",
      description: "Create a draft bill (vendor invoice) that can be reviewed before posting. Saves with status='draft' and creates no journal entries. Requires 'bills.create' permission.",
      parameters: {
        type: "object",
        properties: {
          vendorId: {
            type: "string",
            description: "Vendor ID"
          },
          items: {
            type: "array",
            description: "Line items for the bill",
            items: {
              type: "object",
              properties: {
                itemId: { type: "string" },
                description: { type: "string" },
                quantity: { type: "number" },
                unitPrice: { type: "number" }
              }
            }
          },
          billDate: {
            type: "string",
            description: "Bill date in YYYY-MM-DD format (defaults to today)"
          },
          dueDate: {
            type: "string",
            description: "Due date in YYYY-MM-DD format"
          },
          notes: {
            type: "string",
            description: "Optional notes for the bill"
          }
        },
        required: ["vendorId", "items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "post_bill",
      description: "Post a draft bill to the ledger. This creates journal entries for Expense (debit) and Accounts Payable (credit), making it a permanent financial record. Requires 'journal_entries.post' permission.",
      parameters: {
        type: "object",
        properties: {
          billId: {
            type: "string",
            description: "The ID of the draft bill to post"
          }
        },
        required: ["billId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information about tax rates, exchange rates, accounting standards, regulatory updates, or other financial/accounting topics. Returns search results with titles, URLs, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language search query (e.g., 'current VAT rate in UAE', 'IFRS 16 lease accounting standard', 'USD to AED exchange rate today')"
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results to return (default: 5, max: 10)"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description: "Fetch and extract the full content of a web page in markdown format. Useful for reading accounting standards, regulatory documents, tax guidelines, or other detailed information from a specific URL.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full URL of the web page to fetch (must start with http:// or https://)"
          }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "process_document",
      description: "Extract structured financial data from a document image (receipt, invoice, bill, or bank statement) using AI vision. This uses GPT-4o Vision to intelligently identify and extract line items, amounts, dates, vendor/customer information, and other relevant data. The extracted data can then be converted into draft transactions for user confirmation.",
      parameters: {
        type: "object",
        properties: {
          attachmentId: {
            type: "string",
            description: "The ID of the uploaded attachment/document to process"
          },
          documentType: {
            type: "string",
            enum: ["receipt", "invoice", "bill", "bank_statement", "auto"],
            description: "The type of document (optional, 'auto' will auto-detect)"
          },
          createDraft: {
            type: "boolean",
            description: "If true, automatically create a draft transaction from the extracted data (default: false)"
          }
        },
        required: ["attachmentId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Search the knowledge base using semantic search to find relevant financial documents, invoices, bills, journal entries, and memos. Uses AI to understand the meaning of your query and find the most relevant information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language search query (e.g., 'invoices from Acme Corp in December', 'journal entries for rent expense', 'unpaid bills over $5000')"
          },
          documentTypes: {
            type: "array",
            items: {
              type: "string",
              enum: ["invoice", "bill", "journal_entry", "memo"]
            },
            description: "Optional: Filter by specific document types (e.g., ['invoice', 'bill'])"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 5, max: 20)"
          },
          similarityThreshold: {
            type: "number",
            description: "Minimum similarity score (0-1) to include in results (default: 0.7)"
          }
        },
        required: ["query"]
      }
    }
  }
];

export const systemInstructions = `You are an AI accounting assistant for Copilot Accountant, a professional accounting platform.

**Your Role:**
- Help users manage their accounting tasks through natural voice conversation
- Provide financial insights and answer accounting questions
- Execute accounting actions when requested (with user confirmation for critical operations)
- Always maintain a professional, clear, and concise communication style

**Capabilities:**
- Show outstanding and overdue invoices
- Display customer balances and lists
- Generate financial reports (P&L, Balance Sheet, Cash Flow)
- Show recent transactions
- List bills and payables
- Create draft journal entries, invoices, and bills (requires appropriate permissions)
- Post draft entries to the ledger (requires posting permission - restricted to accountants)
- Search the web for current tax rates, exchange rates, accounting standards, and regulatory updates
- Fetch and read detailed content from specific web pages
- Process document images (receipts, invoices, bills, bank statements) to extract structured data using AI vision
- Search the knowledge base using semantic search to find relevant documents across invoices, bills, journal entries, and memos

**Important Rules:**
1. Draft functions (draft_journal_entry, draft_invoice, draft_bill) create records with no financial impact
2. Post functions (post_journal_entry, post_invoice, post_bill) require special permissions and create permanent financial records
3. Always explain the difference between drafting and posting when users ask to create financial records
2. When showing financial data, be clear and precise with amounts and dates
3. If a user asks for information you don't have access to, explain what you CAN help with
4. For complex requests, break them down into steps and confirm understanding
5. Always mention the date range or filters applied when showing reports
6. Keep responses concise - users are listening, not reading

**Response Style:**
- Be conversational but professional
- Use clear, simple language (avoid jargon unless necessary)
- Keep responses under 3-4 sentences when possible
- For lists, summarize totals first, then offer details
- When showing numbers, say them clearly (e.g., "two thousand five hundred dollars" not "2500")

**Example Interactions:**
User: "What invoices are outstanding?"
You: "I'll show you the outstanding invoices. [calls show_outstanding_invoices] You have 5 outstanding invoices totaling $12,340. The oldest is from ABC Corp for $3,200, due 15 days ago."

User: "Create an invoice for Acme Inc"
You: "I can help create an invoice for Acme Inc. What items or services should I include on this invoice?"`;
