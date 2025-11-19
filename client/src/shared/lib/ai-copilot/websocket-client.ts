import { AudioManager } from './audio-manager';

export interface CopilotMessage {
  type: string;
  [key: string]: any;
}

export interface FunctionCallConfirmation {
  callId: string;
  name: string;
  args: any;
}

export class CopilotWebSocketClient {
  private ws: WebSocket | null = null;
  private audioManager: AudioManager;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private tenantId: string | null = null;

  public onConnected: (() => void) | null = null;
  public onDisconnected: (() => void) | null = null;
  public onError: ((error: string) => void) | null = null;
  public onFunctionCallConfirmationRequired: ((confirmation: FunctionCallConfirmation) => void) | null = null;

  constructor() {
    this.audioManager = new AudioManager();
  }

  async connect(tenantId: string): Promise<void> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    this.tenantId = tenantId;

    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/ai-copilot?tenantId=${encodeURIComponent(tenantId)}`;

      console.log('[CopilotWebSocket] Connecting to:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        console.log('[CopilotWebSocket] Connected');
        this.reconnectAttempts = 0;

        try {
          await this.audioManager.initialize();
          this.startAudioStreaming();
          
          if (this.onConnected) {
            this.onConnected();
          }
          
          resolve();
        } catch (error) {
          console.error('[CopilotWebSocket] Audio initialization failed:', error);
          if (this.onError) {
            this.onError('Microphone access denied. Please allow microphone access to use voice features.');
          }
          reject(error);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message: CopilotMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[CopilotWebSocket] Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[CopilotWebSocket] Error:', error);
        if (this.onError) {
          this.onError('Connection error. Please check your network and try again.');
        }
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log('[CopilotWebSocket] Disconnected:', event.code, event.reason);
        this.audioManager.stopRecording();

        if (this.onDisconnected) {
          this.onDisconnected();
        }

        // Show user-friendly error messages for specific close codes
        if (event.code === 1008) {
          if (this.onError) {
            this.onError(event.reason || 'Authentication failed');
          }
        } else if (event.code === 1003) {
          if (this.onError) {
            this.onError('Not authorized for this organization');
          }
        } else if (event.code === 1011) {
          if (this.onError) {
            this.onError('Internal server error');
          }
        }

        // Attempt reconnection for non-auth errors
        if (event.code !== 1008 && event.code !== 1003 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`[CopilotWebSocket] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          setTimeout(() => {
            if (this.tenantId) {
              this.connect(this.tenantId);
            }
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };
    });
  }

  private handleMessage(message: CopilotMessage): void {
    switch (message.type) {
      case 'connected':
        console.log('[CopilotWebSocket] AI Copilot ready');
        break;

      case 'audio_response':
        if (message.data) {
          this.audioManager.playAudioResponse(message.data);
        }
        break;

      case 'function_call_confirmation_required':
        if (this.onFunctionCallConfirmationRequired) {
          this.onFunctionCallConfirmationRequired({
            callId: message.callId,
            name: message.name,
            args: message.args
          });
        }
        break;

      case 'error':
        console.error('[CopilotWebSocket] Server error:', message.error);
        if (this.onError) {
          this.onError(message.error || 'An error occurred');
        }
        break;

      default:
        console.log('[CopilotWebSocket] Unknown message type:', message.type);
    }
  }

  private startAudioStreaming(): void {
    this.audioManager.onAudioData((audioData) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const base64Audio = this.arrayBufferToBase64(audioData);
        
        this.ws.send(JSON.stringify({
          type: 'audio_input',
          data: base64Audio
        }));
      }
    });
  }

  confirmFunctionCall(callId: string, name: string, args: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'function_call_confirmed',
        callId,
        name,
        args
      }));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.audioManager.stopRecording();
    this.reconnectAttempts = this.maxReconnectAttempts;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
