/**
 * Standardized Route Factory
 * 
 * This factory ensures all financial endpoints have:
 * - Authentication
 * - Tenant verification
 * - RBAC permission checks
 * - Request validation (Zod)
 * - Audit logging
 * - Error handling
 * - Response formatting
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuditLogger } from '../audit/audit-logger';
import { verifyTenantAccess, loadAuthContext, requirePermission } from './rbac';

interface RouteConfig<TBody = any, TParams = any, TQuery = any> {
  // Validation schemas
  bodySchema?: z.ZodSchema<TBody>;
  paramsSchema?: z.ZodSchema<TParams>;
  querySchema?: z.ZodSchema<TQuery>;
  
  // Security
  permission?: string;
  permissions?: string[]; // Multiple permissions (ANY)
  allPermissions?: string[]; // Multiple permissions (ALL)
  skipTenantCheck?: boolean;
  
  // Audit
  auditAction: string;
  auditModule: string;
  skipAudit?: boolean;
  
  // Handler
  handler: (req: AuthenticatedRequest<TBody, TParams, TQuery>, res: Response) => Promise<void>;
}

interface AuthenticatedRequest<TBody = any, TParams = any, TQuery = any> extends Request {
  user: { claims: { sub: string } };
  tenantId: string;
  permissions: string[];
  roles: any[];
  body: TBody;
  params: TParams;
  query: TQuery;
}

class RouteFactory {
  private auditLogger = new AuditLogger();

  /**
   * Creates a standardized route handler with all middleware applied
   */
  create<TBody = any, TParams = any, TQuery = any>(config: RouteConfig<TBody, TParams, TQuery>) {
    // Build middleware chain
    const middlewares: any[] = [];
    
    // 1. Authentication (always required)
    middlewares.push(async (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    });
    
    // 2. Tenant verification (unless explicitly skipped)
    if (!config.skipTenantCheck) {
      middlewares.push(verifyTenantAccess);
    }
    
    // 3. Load auth context (permissions/roles)
    middlewares.push(loadAuthContext);
    
    // 4. Permission checks
    if (config.permission) {
      middlewares.push(requirePermission(config.permission));
    }
    if (config.permissions) {
      // ANY of these permissions
      middlewares.push((req: any, res: any, next: any) => {
        const hasAny = config.permissions!.some(p => 
          req.permissions?.includes(p) || req.roles?.some((r: any) => r.name === 'Owner')
        );
        if (!hasAny) {
          return res.status(403).json({ 
            error: 'Forbidden',
            required: config.permissions,
            message: `Requires one of: ${config.permissions.join(', ')}`
          });
        }
        next();
      });
    }
    if (config.allPermissions) {
      // ALL of these permissions
      middlewares.push((req: any, res: any, next: any) => {
        const hasAll = config.allPermissions!.every(p => 
          req.permissions?.includes(p) || req.roles?.some((r: any) => r.name === 'Owner')
        );
        if (!hasAll) {
          return res.status(403).json({ 
            error: 'Forbidden',
            required: config.allPermissions,
            message: `Requires all of: ${config.allPermissions.join(', ')}`
          });
        }
        next();
      });
    }
    
    // 5. Request validation
    middlewares.push((req: any, res: any, next: any) => {
      try {
        // Validate body
        if (config.bodySchema) {
          const parsed = config.bodySchema.parse(req.body);
          req.body = parsed;
        }
        
        // Validate params
        if (config.paramsSchema) {
          const parsed = config.paramsSchema.parse(req.params);
          req.params = parsed;
        }
        
        // Validate query
        if (config.querySchema) {
          const parsed = config.querySchema.parse(req.query);
          req.query = parsed;
        }
        
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: 'Validation failed',
            details: error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message
            }))
          });
        }
        next(error);
      }
    });
    
    // 6. Main handler with audit logging
    middlewares.push(async (req: AuthenticatedRequest<TBody, TParams, TQuery>, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const originalSend = res.send;
      let responseData: any;
      let statusCode = 200;
      
      // Capture response
      res.send = function(data: any) {
        responseData = data;
        statusCode = res.statusCode;
        return originalSend.call(this, data);
      };
      
      try {
        // Log request (unless skipped)
        if (!config.skipAudit) {
          await this.auditLogger.log({
            userId: req.user.claims.sub,
            tenantId: req.tenantId,
            action: config.auditAction,
            module: config.auditModule,
            metadata: {
              method: req.method,
              path: req.path,
              params: req.params,
              query: req.query,
              bodyKeys: req.body ? Object.keys(req.body) : [],
              ip: req.ip,
              userAgent: req.headers['user-agent']
            }
          });
        }
        
        // Execute handler
        await config.handler(req, res);
        
        // Log success (unless skipped)
        if (!config.skipAudit && statusCode < 400) {
          await this.auditLogger.log({
            userId: req.user.claims.sub,
            tenantId: req.tenantId,
            action: `${config.auditAction}_success`,
            module: config.auditModule,
            metadata: {
              duration: Date.now() - startTime,
              statusCode
            }
          });
        }
      } catch (error: any) {
        // Log failure (unless skipped)
        if (!config.skipAudit) {
          await this.auditLogger.log({
            userId: req.user.claims.sub,
            tenantId: req.tenantId,
            action: `${config.auditAction}_failed`,
            module: config.auditModule,
            metadata: {
              error: error.message,
              stack: error.stack,
              duration: Date.now() - startTime
            }
          });
        }
        
        // Handle error
        if (!res.headersSent) {
          const statusCode = error.statusCode || 500;
          res.status(statusCode).json({
            error: error.message || 'Internal server error',
            code: error.code,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
          });
        }
      }
    });
    
    return middlewares;
  }

  /**
   * Creates a CRUD endpoint set with standard operations
   */
  createCRUD(entity: string, config: {
    permissions: {
      read: string;
      create: string;
      update: string;
      delete: string;
    };
    schemas: {
      create?: z.ZodSchema;
      update?: z.ZodSchema;
      list?: z.ZodSchema;
    };
    handlers: {
      list: (req: AuthenticatedRequest) => Promise<any[]>;
      get: (req: AuthenticatedRequest) => Promise<any>;
      create: (req: AuthenticatedRequest) => Promise<any>;
      update: (req: AuthenticatedRequest) => Promise<any>;
      delete: (req: AuthenticatedRequest) => Promise<void>;
    };
  }) {
    return {
      list: this.create({
        permission: config.permissions.read,
        querySchema: config.schemas.list,
        auditAction: `list_${entity}`,
        auditModule: entity,
        handler: async (req, res) => {
          const items = await config.handlers.list(req);
          res.json(items);
        }
      }),
      
      get: this.create({
        permission: config.permissions.read,
        paramsSchema: z.object({ id: z.string() }),
        auditAction: `get_${entity}`,
        auditModule: entity,
        handler: async (req, res) => {
          const item = await config.handlers.get(req);
          if (!item) {
            res.status(404).json({ error: `${entity} not found` });
            return;
          }
          res.json(item);
        }
      }),
      
      create: this.create({
        permission: config.permissions.create,
        bodySchema: config.schemas.create,
        auditAction: `create_${entity}`,
        auditModule: entity,
        handler: async (req, res) => {
          const created = await config.handlers.create(req);
          res.status(201).json(created);
        }
      }),
      
      update: this.create({
        permission: config.permissions.update,
        paramsSchema: z.object({ id: z.string() }),
        bodySchema: config.schemas.update,
        auditAction: `update_${entity}`,
        auditModule: entity,
        handler: async (req, res) => {
          const updated = await config.handlers.update(req);
          if (!updated) {
            res.status(404).json({ error: `${entity} not found` });
            return;
          }
          res.json(updated);
        }
      }),
      
      delete: this.create({
        permission: config.permissions.delete,
        paramsSchema: z.object({ id: z.string() }),
        auditAction: `delete_${entity}`,
        auditModule: entity,
        handler: async (req, res) => {
          await config.handlers.delete(req);
          res.status(204).send();
        }
      })
    };
  }
}

export const routeFactory = new RouteFactory();
export type { RouteConfig, AuthenticatedRequest };