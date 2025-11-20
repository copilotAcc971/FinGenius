-- ================================================================
-- PHASE 8 SECURITY TRIGGERS (GDPR/SOX COMPLIANCE)
-- ================================================================
-- These triggers enforce critical security constraints that cannot
-- be expressed in Drizzle schema alone. They must be applied after
-- schema sync to ensure compliance.
--
-- Author: Phase 8 Schema Design
-- Date: 2025-01-20
-- Requirements: GDPR/SOX compliance, tamper-evident audit trails
-- ================================================================

-- ================================================================
-- TRIGGER 1: Enforce Encryption Metadata for AI Logs
-- ================================================================
-- PURPOSE: Ensure that if encrypted_payload is set, ALL KMS envelope
--          encryption fields are populated (no partial encryption)
-- COMPLIANCE: SOX 404 (internal controls), GDPR Art. 32 (security)
-- ================================================================

CREATE OR REPLACE FUNCTION check_ai_log_encryption_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- If encrypted_payload is set, ALL KMS fields must be set
  IF NEW.encrypted_payload IS NOT NULL THEN
    IF NEW.kms_key_alias IS NULL OR 
       NEW.encrypted_data_key IS NULL OR 
       NEW.encryption_iv IS NULL OR 
       NEW.encryption_auth_tag IS NULL OR 
       NEW.payload_integrity_hash IS NULL THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: All encryption metadata fields (kms_key_alias, encrypted_data_key, encryption_iv, encryption_auth_tag, payload_integrity_hash) must be set when encrypted_payload is present. This is required for KMS envelope encryption provenance.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotent migrations)
DROP TRIGGER IF EXISTS enforce_ai_log_encryption_metadata ON ai_interaction_logs;

-- Create trigger
CREATE TRIGGER enforce_ai_log_encryption_metadata
  BEFORE INSERT OR UPDATE ON ai_interaction_logs
  FOR EACH ROW
  EXECUTE FUNCTION check_ai_log_encryption_metadata();

COMMENT ON TRIGGER enforce_ai_log_encryption_metadata ON ai_interaction_logs IS 
  'SOX/GDPR compliance: Ensures complete KMS envelope encryption metadata when payload is encrypted';

-- ================================================================
-- TRIGGER 2: Enforce Encryption Metadata for Integration Tokens
-- ================================================================
-- PURPOSE: Ensure OAuth tokens are always encrypted with complete
--          KMS envelope encryption metadata (access + refresh)
-- COMPLIANCE: GDPR Art. 32, PCI-DSS 3.4 (protect stored credentials)
-- ================================================================

CREATE OR REPLACE FUNCTION check_integration_access_token_encryption()
RETURNS TRIGGER AS $$
BEGIN
  -- Access token encryption metadata is ALWAYS required (access token is NOT NULL)
  IF NEW.encrypted_access_token IS NOT NULL THEN
    IF NEW.access_token_kms_key_alias IS NULL OR 
       NEW.access_token_encrypted_dek IS NULL OR 
       NEW.access_token_iv IS NULL OR 
       NEW.access_token_auth_tag IS NULL THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: All access token encryption metadata fields (access_token_kms_key_alias, access_token_encrypted_dek, access_token_iv, access_token_auth_tag) must be set. OAuth tokens MUST use KMS envelope encryption.';
    END IF;
  END IF;
  
  -- Refresh token encryption metadata required if refresh token exists
  IF NEW.encrypted_refresh_token IS NOT NULL THEN
    IF NEW.refresh_token_kms_key_alias IS NULL OR 
       NEW.refresh_token_encrypted_dek IS NULL OR 
       NEW.refresh_token_iv IS NULL OR 
       NEW.refresh_token_auth_tag IS NULL THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: All refresh token encryption metadata fields must be set when encrypted_refresh_token is present.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotent migrations)
DROP TRIGGER IF EXISTS enforce_integration_token_encryption ON integration_connections;

-- Create trigger
CREATE TRIGGER enforce_integration_token_encryption
  BEFORE INSERT OR UPDATE ON integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION check_integration_access_token_encryption();

COMMENT ON TRIGGER enforce_integration_token_encryption ON integration_connections IS 
  'PCI-DSS/GDPR compliance: Ensures complete KMS envelope encryption for OAuth tokens';

-- ================================================================
-- TRIGGER 3 & 4: Append-Only Enforcement for AI Log Access Audits
-- ================================================================
-- PURPOSE: Make ai_log_access_audits table IMMUTABLE (append-only)
--          to create tamper-evident audit trail for "audit the auditors"
-- COMPLIANCE: SOX 302/404 (audit trail integrity), SOX 802 (immutable records)
-- ================================================================

CREATE OR REPLACE FUNCTION prevent_ai_log_access_audit_modifications()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'COMPLIANCE VIOLATION: AI log access audits are IMMUTABLE per SOX 802 requirements. UPDATE and DELETE operations are not allowed. This is a tamper-evident audit trail for "audit the auditors". If you need to correct an error, INSERT a new corrective entry.';
  RETURN NULL; -- Block the operation
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if exist (for idempotent migrations)
DROP TRIGGER IF EXISTS prevent_ai_log_access_audit_update ON ai_log_access_audits;
DROP TRIGGER IF EXISTS prevent_ai_log_access_audit_delete ON ai_log_access_audits;

-- Create triggers for both UPDATE and DELETE
CREATE TRIGGER prevent_ai_log_access_audit_update
  BEFORE UPDATE ON ai_log_access_audits
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ai_log_access_audit_modifications();

CREATE TRIGGER prevent_ai_log_access_audit_delete
  BEFORE DELETE ON ai_log_access_audits
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ai_log_access_audit_modifications();

COMMENT ON TRIGGER prevent_ai_log_access_audit_update ON ai_log_access_audits IS 
  'SOX 802 compliance: Prevents tampering with audit trail (UPDATE blocked)';

COMMENT ON TRIGGER prevent_ai_log_access_audit_delete ON ai_log_access_audits IS 
  'SOX 802 compliance: Prevents tampering with audit trail (DELETE blocked)';

-- ================================================================
-- VERIFICATION QUERIES (run these to verify triggers are active)
-- ================================================================
-- SELECT * FROM pg_trigger WHERE tgname LIKE '%ai_log%' OR tgname LIKE '%integration%';
-- SELECT proname, prosrc FROM pg_proc WHERE proname LIKE '%ai_log%' OR proname LIKE '%integration%';
-- ================================================================
