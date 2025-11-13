import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ExtractedBillData {
  vendorName: string;
  billNumber: string;
  billDate: string; // ISO date
  dueDate: string; // ISO date
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
  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are an expert at extracting structured data from bill/invoice images. 
Analyze the image and extract: vendor name, bill number, bill date, due date, line items (description, quantity, unit price, amount), subtotal, tax amount, total, and any notes.
Respond with JSON in this exact format:
{
  "vendorName": "string",
  "billNumber": "string",
  "billDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "subtotal": number,
  "taxAmount": number,
  "total": number,
  "lineItems": [
    {
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "amount": number
    }
  ],
  "notes": "string (optional)"
}`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all bill data from this image."
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

  const result = JSON.parse(response.choices[0].message.content!);
  return result;
}
