export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  functionCall?: {
    name: string;
    args: any;
  };
}

export type CopilotStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

export type CopilotMode = 'push-to-talk' | 'always-listening' | 'chat' | 'voice-note';

export interface CopilotAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  extractionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  extractedData?: {
    documentType?: string;
    confidence?: 'high' | 'medium' | 'low';
    total?: number;
    date?: string;
    vendorName?: string;
    customerName?: string;
    lineItems?: Array<{
      description: string;
      amount: number;
    }>;
    warnings?: string[];
  };
  thumbnail?: string; // Base64 encoded thumbnail
}
