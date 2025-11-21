import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  type: 'text' | 'error' | 'image';
  content: string;
}

export class MCPClient extends EventEmitter {
  private client: AxiosInstance;
  private serverId: string;
  private serverUrl: string;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(serverId: string, serverUrl: string = `http://localhost:${3000 + Math.random() * 1000}`) {
    super();
    this.serverId = serverId;
    this.serverUrl = serverUrl;
    this.client = axios.create({
      baseURL: serverUrl,
      timeout: 30000,
    });
  }

  async callTool(tool: MCPToolCall): Promise<MCPToolResult> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.client.post('/api/mcp/tool-call', {
          tool: tool.name,
          input: tool.arguments,
        });

        console.log(
          `[MCP Client] ${this.serverId} tool call succeeded:`,
          tool.name
        );

        return {
          type: 'text',
          content: response.data.result || '',
        };
      } catch (error: any) {
        console.error(
          `[MCP Client] ${this.serverId} attempt ${attempt + 1}/${this.maxRetries}:`,
          error.message
        );

        if (attempt < this.maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        } else {
          return {
            type: 'error',
            content: error.message || 'Tool call failed after retries',
          };
        }
      }
    }

    return {
      type: 'error',
      content: 'Tool call failed',
    };
  }

  async listTools(): Promise<{ name: string; description: string }[]> {
    try {
      const response = await this.client.get('/api/mcp/tools');
      return response.data.tools || [];
    } catch (error: any) {
      console.error(`[MCP Client] Failed to list tools:`, error.message);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error(`[MCP Client] Health check failed:`, error);
      return false;
    }
  }
}

export async function createMCPClient(serverId: string): Promise<MCPClient> {
  const client = new MCPClient(serverId);
  const isHealthy = await client.healthCheck();
  if (!isHealthy) {
    throw new Error(`MCP server ${serverId} is not healthy`);
  }
  return client;
}
