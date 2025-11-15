-- Migration: Update FX Configuration to support multi-regional central bank sources
-- Date: 2025-01-15
-- Description: Replace CBUAE-specific configuration with flexible multi-regional approach

-- Add new columns for multi-regional support
ALTER TABLE fx_configs 
ADD COLUMN IF NOT EXISTS primary_rate_source VARCHAR DEFAULT 'cbuae' NOT NULL,
ADD COLUMN IF NOT EXISTS primary_source_provider VARCHAR DEFAULT 'github' NOT NULL,
ADD COLUMN IF NOT EXISTS fallback_rate_source VARCHAR;

-- Migrate existing cbuaeSource data to new schema
-- Map old values to new structure:
-- - 'github' -> primaryRateSource='cbuae', primarySourceProvider='github'
-- - 'ocr' -> primaryRateSource='cbuae', primarySourceProvider='github' (OCR no longer separate option)
-- - 'both' -> primaryRateSource='cbuae', primarySourceProvider='github'
-- - 'fluentax' -> primaryRateSource='cbuae', primarySourceProvider='fluentax'
-- - 'manual' -> primaryRateSource='manual', primarySourceProvider='manual'

UPDATE fx_configs
SET 
  primary_rate_source = 
    CASE 
      WHEN cbuae_source = 'manual' THEN 'manual'
      ELSE 'cbuae'
    END,
  primary_source_provider = 
    CASE 
      WHEN cbuae_source = 'fluentax' THEN 'fluentax'
      WHEN cbuae_source = 'manual' THEN 'manual'
      ELSE 'github'
    END
WHERE cbuae_source IS NOT NULL;

-- Drop the old column after data migration
ALTER TABLE fx_configs DROP COLUMN IF EXISTS cbuae_source;

-- Add comments for documentation
COMMENT ON COLUMN fx_configs.primary_rate_source IS 'Primary central bank source: cbuae, ecb, sama, boe, fed, manual';
COMMENT ON COLUMN fx_configs.primary_source_provider IS 'Provider for fetching rates: github, api, fluentax, manual';
COMMENT ON COLUMN fx_configs.fallback_rate_source IS 'Optional fallback source if primary fails';
