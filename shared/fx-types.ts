import { z } from 'zod';

export const fxConfigSchema = z.object({
  tenantId: z.string(),
  autoRefreshEnabled: z.boolean().default(true),
  sourceStrategy: z.enum(['api', 'manual', 'hybrid']).default('api'),
  primaryRateSource: z.enum(['cbuae', 'ecb', 'sama', 'boe', 'fed', 'manual']).default('cbuae'),
  primarySourceProvider: z.enum(['github', 'api', 'fluentax', 'manual']).default('github'),
  fallbackRateSource: z.enum(['cbuae', 'ecb', 'sama', 'boe', 'fed']).nullable().optional(),
  lastRefreshAt: z.date().nullable(),
});

export type FXConfig = z.infer<typeof fxConfigSchema>;

export const insertFXConfigSchema = fxConfigSchema.omit({ tenantId: true });
export type InsertFXConfig = z.infer<typeof insertFXConfigSchema>;
