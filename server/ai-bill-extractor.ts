import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ExtractedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  suggestedCategory?: string; // AI-suggested expense category
  suggestedAccountType?: string; // AI-suggested account type (e.g., "office_supplies", "utilities")
}

export interface ExtractedBillData {
  vendorName: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  lineItems: ExtractedLineItem[];
  notes?: string;
  suggestedCategories?: string[]; // Overall bill categories for classification
  primaryCategory?: string; // Primary expense category
}

// Common expense categories for AI classification
const EXPENSE_CATEGORIES = [
  "Office Supplies",
  "Utilities",
  "Rent",
  "Software & Subscriptions",
  "Professional Services",
  "Marketing & Advertising",
  "Travel & Entertainment",
  "Equipment & Hardware",
  "Telecommunications",
  "Insurance",
  "Maintenance & Repairs",
  "Shipping & Delivery",
  "Legal & Accounting",
  "Employee Benefits",
  "Training & Development",
  "Printing & Copying",
  "Other Operating Expenses"
];

export async function extractBillData(base64Image: string): Promise<ExtractedBillData> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting structured data from bill/invoice images and classifying expenses. 
Extract vendor name, bill number, dates, line items with detailed information, and totals.
Classify each line item into appropriate expense categories and suggest account types.
Analyze the overall bill to determine the primary expense category.
Respond ONLY with valid JSON.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract bill data and classify expenses. Return JSON with this structure:
{
  "vendorName": "string",
  "billNumber": "string", 
  "billDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "subtotal": 0,
  "taxAmount": 0,
  "total": 0,
  "lineItems": [
    {
      "description": "detailed item description",
      "quantity": 1,
      "unitPrice": 0,
      "amount": 0,
      "suggestedCategory": "pick from: ${EXPENSE_CATEGORIES.join(", ")}",
      "suggestedAccountType": "e.g., office_supplies, utilities, rent, software, professional_services, marketing, travel, equipment, telecom, insurance, maintenance, shipping, legal_accounting, employee_benefits, training, printing, other"
    }
  ],
  "notes": "any additional information from the bill",
  "suggestedCategories": ["array of relevant categories from the bill"],
  "primaryCategory": "the most relevant category from: ${EXPENSE_CATEGORIES.join(", ")}"
}

Important:
- Extract ALL line items with complete details
- Classify each line item accurately based on its description
- If multiple line items exist, extract them all
- Determine the primary category based on the main purpose of the bill
- Set suggestedAccountType to a short identifier (lowercase with underscores)`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 3000,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in AI response");
    }
    
    const result = JSON.parse(content);
    
    // Validate required fields
    if (!result.vendorName || !result.billNumber || !result.billDate) {
      throw new Error("AI extraction failed: missing required fields");
    }
    
    // Ensure lineItems is an array
    if (!Array.isArray(result.lineItems)) {
      result.lineItems = [];
    }
    
    // Validate and clean line items
    result.lineItems = result.lineItems.map((item: any) => ({
      description: item.description || "Unknown Item",
      quantity: parseFloat(item.quantity) || 1,
      unitPrice: parseFloat(item.unitPrice) || 0,
      amount: parseFloat(item.amount) || 0,
      suggestedCategory: item.suggestedCategory || "Other Operating Expenses",
      suggestedAccountType: item.suggestedAccountType || "other",
    }));
    
    return result;
  } catch (error: any) {
    console.error("AI extraction error:", error);
    throw new Error(`Failed to extract bill data: ${error.message}`);
  }
}
