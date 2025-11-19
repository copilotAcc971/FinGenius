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
      name: "create_invoice",
      description: "Create a new invoice for a customer. This action requires confirmation from the user.",
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
      name: "record_payment",
      description: "Record a payment received from a customer. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          invoiceId: {
            type: "string",
            description: "Invoice ID to apply payment to"
          },
          amount: {
            type: "number",
            description: "Payment amount"
          },
          paymentDate: {
            type: "string",
            description: "Payment date in YYYY-MM-DD format (defaults to today)"
          },
          paymentMethod: {
            type: "string",
            enum: ["cash", "check", "bank_transfer", "credit_card"],
            description: "Method of payment"
          }
        },
        required: ["invoiceId", "amount"]
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
- Create invoices (with confirmation)
- Record payments (with confirmation)

**Important Rules:**
1. Always confirm before executing destructive or financial actions (creating invoices, recording payments)
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
