-- Migration: Create system_config table for VAPID keys and other system settings
-- Date: 2025-11-20
-- Purpose: Store system-wide configuration (VAPID keys, feature flags, etc.)

CREATE TABLE IF NOT EXISTS system_config (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups by key
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Add comment for documentation
COMMENT ON TABLE system_config IS 'System-wide configuration storage for VAPID keys, feature flags, and other settings';
COMMENT ON COLUMN system_config.key IS 'Unique configuration key (e.g., vapid-keys, feature-flags)';
COMMENT ON COLUMN system_config.value IS 'Configuration value stored as JSON for flexibility';
