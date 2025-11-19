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

export type CopilotMode = 'push-to-talk' | 'always-listening';
