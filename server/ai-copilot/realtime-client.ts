import WebSocket from 'ws';
import type { ChatCompletionTool } from "openai/resources/chat/completions";

interface RealtimeClientConfig {
  apiKey: string;
  model?: string;
  voice?: 'alloy' | 'echo' | 'shimmer';
  instructions?: string;
  tools?: ChatCompletionTool[];
  temperature?: number;
}

interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private config: RealtimeClientConfig;
  private eventHandlers: Map<string, Set<(event: any) => void>> = new Map();
  private isConnected: boolean = false;

  constructor(config: RealtimeClientConfig) {
    this.apiKey = config.apiKey;
    this.config = {
      model: config.model || 'gpt-4o-realtime-preview-2024-10-01',
      voice: config.voice || 'alloy',
      instructions: config.instructions || '',
      tools: config.tools || [],
      temperature: config.temperature || 0.8,
      ...config
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = 'wss://api.openai.com/v1/realtime?model=' + this.config.model;
      
      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.ws.on('open', () => {
        console.log('[RealtimeClient] Connected to OpenAI Realtime API');
        this.isConnected = true;
        
        this.sendEvent({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: this.config.instructions,
            voice: this.config.voice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            },
            tools: this.config.tools,
            tool_choice: 'auto',
            temperature: this.config.temperature
          }
        });
        
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const event = JSON.parse(data.toString()) as RealtimeEvent;
          this.handleEvent(event);
        } catch (error) {
          console.error('[RealtimeClient] Error parsing message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('[RealtimeClient] WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('[RealtimeClient] Disconnected from OpenAI Realtime API');
        this.isConnected = false;
        this.emit('disconnected', {});
      });
    });
  }

  private handleEvent(event: RealtimeEvent): void {
    console.log('[RealtimeClient] Event:', event.type);
    this.emit(event.type, event);
  }

  sendAudio(audioData: Buffer): void {
    if (!this.isConnected || !this.ws) {
      console.warn('[RealtimeClient] Cannot send audio: not connected');
      return;
    }

    this.sendEvent({
      type: 'input_audio_buffer.append',
      audio: audioData.toString('base64')
    });
  }

  sendEvent(event: RealtimeEvent): void {
    if (!this.ws) {
      console.warn('[RealtimeClient] Cannot send event: WebSocket not initialized');
      return;
    }

    try {
      this.ws.send(JSON.stringify(event));
    } catch (error) {
      console.error('[RealtimeClient] Error sending event:', error);
    }
  }

  createResponse(): void {
    this.sendEvent({
      type: 'response.create'
    });
  }

  on(eventType: string, handler: (event: any) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: (event: any) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(eventType: string, event: any): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`[RealtimeClient] Error in event handler for ${eventType}:`, error);
        }
      });
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  isActive(): boolean {
    return this.isConnected && this.ws !== null;
  }
}
