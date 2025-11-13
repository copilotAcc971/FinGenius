import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ExtractedBillData {
  vendorName: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  notes?: string;
}

export async function extractBillData(base64Image: string): Promise<ExtractedBillData> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting structured data from bill/invoice images. Extract vendor name, bill number, dates, line items, and totals. Respond ONLY with valid JSON.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract bill data and return JSON with this structure:
{
  "vendorName": "string",
  "billNumber": "string", 
  "billDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "subtotal": 0,
  "taxAmount": 0,
  "total": 0,
  "lineItems": [{"description": "", "quantity": 0, "unitPrice": 0, "amount": 0}],
  "notes": ""
}`
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
      max_completion_tokens: 2048,
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
    
    return result;
  } catch (error: any) {
    console.error("AI extraction error:", error);
    throw new Error(`Failed to extract bill data: ${error.message}`);
  }
}
