import axios from 'axios';

export interface QwenMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class QwenProvider {
  private apiKey: string;
  private baseUrl = 'https://dashscope.aliyuncs.com/api/v1';
  private model = 'qwen-max';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.QWEN_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[Qwen] API key not configured - Qwen provider will be unavailable');
    }
  }

  async chat(messages: QwenMessage[]): Promise<{
    content: string;
    tokens: { input: number; output: number };
    cost: number;
  }> {
    if (!this.apiKey) {
      throw new Error('Qwen API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/services/aigc/text-generation/generation`,
        {
          model: this.model,
          messages,
          parameters: {
            temperature: 0.3,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.output?.text || '';
      const inputTokens = response.data.usage?.input_tokens || 0;
      const outputTokens = response.data.usage?.output_tokens || 0;

      return {
        content,
        tokens: { input: inputTokens, output: outputTokens },
        cost: 0, // Qwen free tier
      };
    } catch (error: any) {
      console.error('[Qwen] API error:', error.response?.data || error.message);
      throw error;
    }
  }

  async extractText(imageUrl: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Qwen API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/services/aigc/multimodal-generation/generation`,
        {
          model: 'qwen-vl-max',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  image: imageUrl,
                },
                {
                  type: 'text',
                  text: 'Extract all text from this image. Return only the extracted text.',
                },
              ],
            },
          ],
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.output?.text || '';
    } catch (error: any) {
      console.error('[Qwen] Vision API error:', error.response?.data || error.message);
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const qwenProvider = new QwenProvider();
