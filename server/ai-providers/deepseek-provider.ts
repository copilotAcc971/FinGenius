import axios from 'axios';

export interface DeepSeekMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class DeepSeekProvider {
  private apiKey: string;
  private baseUrl = 'https://api.deepseek.com/v1';
  private model = 'deepseek-chat';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DEEPSEEK_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[DeepSeek] API key not configured - DeepSeek provider will be unavailable');
    }
  }

  async chat(messages: DeepSeekMessage[]): Promise<{
    content: string;
    tokens: { input: number; output: number };
    cost: number;
  }> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key not configured');
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

      // DeepSeek pricing: approximately $0.14/$0.28 per million tokens
      const costPerMillion = { input: 0.14, output: 0.28 };
      const cost =
        (inputTokens / 1000000) * costPerMillion.input +
        (outputTokens / 1000000) * costPerMillion.output;

      return {
        content,
        tokens: { input: inputTokens, output: outputTokens },
        cost,
      };
    } catch (error: any) {
      console.error('[DeepSeek] API error:', error.response?.data || error.message);
      throw error;
    }
  }

  async thinkAndRespond(prompt: string): Promise<{
    thinking: string;
    response: string;
    tokens: { input: number; output: number };
    cost: number;
  }> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'deepseek-reasoner',
          messages: [
            {
              role: 'user',
              content: prompt,
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

      const content = response.data.choices[0]?.message?.content || '';
      const thinking = response.data.choices[0]?.message?.thinking || '';
      const inputTokens = response.data.usage?.prompt_tokens || 0;
      const outputTokens = response.data.usage?.completion_tokens || 0;

      const costPerMillion = { input: 0.55, output: 2.19 }; // Reasoner pricing
      const cost =
        (inputTokens / 1000000) * costPerMillion.input +
        (outputTokens / 1000000) * costPerMillion.output;

      return {
        thinking,
        response: content,
        tokens: { input: inputTokens, output: outputTokens },
        cost,
      };
    } catch (error: any) {
      console.error('[DeepSeek] Reasoning API error:', error.response?.data || error.message);
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const deepseekProvider = new DeepSeekProvider();
