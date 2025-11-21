import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { db } from '../db';
import { mcpServers } from '@shared/schema';
import { eq } from 'drizzle-orm';

export type MCPServerStatus = 'running' | 'stopped' | 'error' | 'initializing';

interface MCPServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  status: MCPServerStatus;
  process?: ChildProcess;
  lastError?: string;
  restartCount: number;
  maxRestarts: number;
}

export class MCPServerManager extends EventEmitter {
  private servers: Map<string, MCPServer> = new Map();
  private maxRestarts = 5;
  private restartDelay = 3000; // 3 seconds

  async initializeFromDatabase(): Promise<void> {
    try {
      const dbServers = await db.select().from(mcpServers);
      
      for (const dbServer of dbServers) {
        if (dbServer.isEnabled) {
          const args = dbServer.args ? JSON.parse(dbServer.args) : [];
          const server: MCPServer = {
            id: dbServer.id,
            name: dbServer.name,
            command: dbServer.command,
            args,
            status: 'stopped',
            restartCount: 0,
            maxRestarts: this.maxRestarts,
          };
          this.servers.set(dbServer.id, server);
        }
      }
      
      console.log(`[MCP Manager] Initialized ${this.servers.size} MCP servers from database`);
    } catch (error) {
      console.error('[MCP Manager] Failed to initialize from database:', error);
    }
  }

  async startServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) {
      console.error(`[MCP Manager] Server ${serverId} not found`);
      return false;
    }

    if (server.process && server.status === 'running') {
      console.log(`[MCP Manager] Server ${serverId} already running`);
      return true;
    }

    try {
      server.status = 'initializing';
      this.emit('status-change', { serverId, status: 'initializing' });

      server.process = spawn(server.command, server.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
      });

      server.process.on('error', (error) => {
        console.error(`[MCP Manager] Process error for ${serverId}:`, error);
        server.lastError = error.message;
        server.status = 'error';
        this.emit('status-change', { serverId, status: 'error', error: error.message });
      });

      server.process.on('exit', (code) => {
        console.log(`[MCP Manager] Server ${serverId} exited with code ${code}`);
        server.status = 'stopped';
        server.process = undefined;
        this.emit('status-change', { serverId, status: 'stopped' });

        // Auto-restart if under limit
        if (server.restartCount < server.maxRestarts) {
          server.restartCount++;
          console.log(
            `[MCP Manager] Restarting ${serverId} (attempt ${server.restartCount}/${server.maxRestarts})`
          );
          setTimeout(() => this.startServer(serverId), this.restartDelay);
        }
      });

      server.status = 'running';
      server.restartCount = 0;
      this.emit('status-change', { serverId, status: 'running' });

      console.log(`[MCP Manager] Started server ${serverId}`);
      return true;
    } catch (error: any) {
      console.error(`[MCP Manager] Failed to start ${serverId}:`, error);
      server.status = 'error';
      server.lastError = error.message;
      this.emit('status-change', { serverId, status: 'error', error: error.message });
      return false;
    }
  }

  async stopServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server || !server.process) {
      return false;
    }

    try {
      server.process.kill();
      server.status = 'stopped';
      server.process = undefined;
      this.emit('status-change', { serverId, status: 'stopped' });
      console.log(`[MCP Manager] Stopped server ${serverId}`);
      return true;
    } catch (error) {
      console.error(`[MCP Manager] Failed to stop ${serverId}:`, error);
      return false;
    }
  }

  async restartServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) return false;

    server.restartCount = 0;
    await this.stopServer(serverId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return this.startServer(serverId);
  }

  getServerStatus(serverId: string): MCPServerStatus | undefined {
    return this.servers.get(serverId)?.status;
  }

  getAllServers() {
    return Array.from(this.servers.values()).map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      lastError: s.lastError,
      restartCount: s.restartCount,
    }));
  }

  async startAll(): Promise<void> {
    console.log('[MCP Manager] Starting all MCP servers...');
    for (const serverId of this.servers.keys()) {
      await this.startServer(serverId);
    }
  }

  async stopAll(): Promise<void> {
    console.log('[MCP Manager] Stopping all MCP servers...');
    for (const serverId of this.servers.keys()) {
      await this.stopServer(serverId);
    }
  }
}

export const mcpServerManager = new MCPServerManager();
