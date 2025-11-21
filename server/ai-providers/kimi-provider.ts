import axios from 'axios';
import { AIProvider } from '../services/ai-consent';

export interface KimiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class KimiProvider {
  private apiKey: string;
  private baseUrl = 'https://api.moonshot.cn/v1';
  private model = 'moonshot-v1-8k';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.KIMI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[Kimi] API key not configured - Kimi provider will be unavailable');
    }
  }

  async chat(messages: KimiMessage[]): Promise<{
    content: string;
    tokens: { input: number; output: number };
    cost: number;
  }> {
    if (!this.apiKey) {
      throw new Error('Kimi API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: 0.3,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0]?.message?.content || '';
      const inputTokens = response.data.usage?.prompt_tokens || 0;
      const outputTokens = response.data.usage?.completion_tokens || 0;

      return {
        content,
        tokens: { input: inputTokens, output: outputTokens },
        cost: 0, // Kimi is free tier
      };
    } catch (error: any) {
      console.error('[Kimi] API error:', error.response?.data || error.message);
      throw error;
    }
  }

  async extractText(imageUrl: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Kimi API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl,
                  },
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

      return response.data.choices[0]?.message?.content || '';
    } catch (error: any) {
      console.error('[Kimi] Vision API error:', error.response?.data || error.message);
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const kimiProvider = new KimiProvider();
