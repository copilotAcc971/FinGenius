import { z } from 'zod';

export const fxConfigSchema = z.object({
  tenantId: z.string(),
  autoRefreshEnabled: z.boolean().default(true),
  sourceStrategy: z.enum(['api', 'manual', 'hybrid']).default('api'),
  cbuaeSource: z.enum(['github', 'ocr', 'both', 'fluentax', 'manual']).default('github'),
  lastRefreshAt: z.date().nullable(),
});

export type FXConfig = z.infer<typeof fxConfigSchema>;

export const insertFXConfigSchema = fxConfigSchema.omit({ tenantId: true });
export type InsertFXConfig = z.infer<typeof insertFXConfigSchema>;
