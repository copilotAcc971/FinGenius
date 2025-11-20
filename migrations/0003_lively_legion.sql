CREATE TABLE "ai_copilot_uploads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"file_path" text NOT NULL,
	"virus_scan_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"virus_scan_details" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"rule_name" varchar(255) NOT NULL,
	"rule_type" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"severity" varchar(20) NOT NULL,
	"threshold_amount" numeric(15, 2),
	"threshold_currency" varchar(3),
	"threshold_period" varchar(50),
	"conditions" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" varchar(100) NOT NULL,
	"file_data" text NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"uploaded_by" varchar,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beneficial_owners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"date_of_birth" date,
	"nationality" varchar(100),
	"country_of_residence" varchar(100),
	"ownership_percentage" numeric(5, 2) NOT NULL,
	"ownership_type" varchar(50),
	"identification_type" varchar(50),
	"identification_number" varchar(100),
	"identification_expiry_date" date,
	"is_pep" boolean DEFAULT false,
	"pep_category" varchar(100),
	"pep_details" text,
	"verification_status" varchar(50) DEFAULT 'pending',
	"verified_at" timestamp,
	"verified_by" varchar,
	"last_screened_at" timestamp,
	"screening_status" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_deadlines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"compliance_area" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"due_date" date NOT NULL,
	"status" varchar(50) NOT NULL,
	"priority" varchar(50) NOT NULL,
	"assigned_to" varchar,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"compliance_area" varchar(50) NOT NULL,
	"metric_type" varchar(100) NOT NULL,
	"metric_value" varchar(255) NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "compliance_training" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"training_module" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"score" integer,
	"due_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_risk_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"overall_risk_level" varchar(20) NOT NULL,
	"risk_score" integer NOT NULL,
	"geographic_risk" integer DEFAULT 0,
	"industry_risk" integer DEFAULT 0,
	"product_service_risk" integer DEFAULT 0,
	"transaction_risk" integer DEFAULT 0,
	"customer_type_risk" integer DEFAULT 0,
	"high_risk_countries" jsonb DEFAULT '[]'::jsonb,
	"sanctioned_country_exposure" boolean DEFAULT false,
	"cash_intensive_business" boolean DEFAULT false,
	"politically_exposed" boolean DEFAULT false,
	"next_review_date" date NOT NULL,
	"review_frequency" varchar(20) DEFAULT 'annual',
	"last_reviewed_at" timestamp,
	"last_reviewed_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_statement_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"reporting_period_start" timestamp NOT NULL,
	"reporting_period_end" timestamp NOT NULL,
	"note_type" varchar(100) NOT NULL,
	"note_title" varchar(500) NOT NULL,
	"note_content" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"going_concern_status" varchar(50),
	"going_concern_assessment_date" timestamp,
	"going_concern_reviewed_by" varchar,
	"version_number" integer DEFAULT 1 NOT NULL,
	"previous_version_id" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fx_translation_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"run_date" timestamp NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" varchar(50) DEFAULT 'running' NOT NULL,
	"oci_amount" numeric(12, 2),
	"retained_earnings_amount" numeric(12, 2),
	"affected_accounts" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"status" varchar(50) NOT NULL,
	"risk_level" varchar(20) NOT NULL,
	"verification_method" varchar(100),
	"verified_at" timestamp,
	"verified_by" varchar,
	"expires_at" timestamp,
	"documents_collected" jsonb DEFAULT '[]'::jsonb,
	"documents_verified" boolean DEFAULT false,
	"lean_entity_id" varchar,
	"lean_verification_status" varchar(50),
	"lean_verification_date" timestamp,
	"edd_required" boolean DEFAULT false,
	"edd_completed" boolean DEFAULT false,
	"edd_completed_at" timestamp,
	"edd_notes" text,
	"review_notes" text,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nrv_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"assessment_date" timestamp NOT NULL,
	"cost_value" numeric(12, 2) NOT NULL,
	"nrv_value" numeric(12, 2) NOT NULL,
	"write_down_amount" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_permission_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"granted" boolean NOT NULL,
	"reason" text,
	"granted_by" varchar,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_permission_override" UNIQUE("tenant_id","user_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "sanctions_screenings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"entity_name" varchar(255) NOT NULL,
	"screening_type" varchar(50) NOT NULL,
	"screening_date" timestamp DEFAULT now() NOT NULL,
	"overall_result" varchar(50) NOT NULL,
	"ofac_result" varchar(50),
	"ofac_confidence" numeric(5, 2),
	"ofac_match_details" jsonb,
	"un_result" varchar(50),
	"un_confidence" numeric(5, 2),
	"un_match_details" jsonb,
	"eu_result" varchar(50),
	"eu_confidence" numeric(5, 2),
	"eu_match_details" jsonb,
	"uk_result" varchar(50),
	"uk_confidence" numeric(5, 2),
	"uk_match_details" jsonb,
	"pep_result" varchar(50),
	"pep_confidence" numeric(5, 2),
	"pep_match_details" jsonb,
	"requires_review" boolean DEFAULT false,
	"review_status" varchar(50) DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"action_taken" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suspicious_activity_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"sar_number" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"subject_type" varchar(50) NOT NULL,
	"subject_id" varchar(255) NOT NULL,
	"subject_name" varchar(255) NOT NULL,
	"customer_id" varchar,
	"activity_type" varchar(100) NOT NULL,
	"activity_description" text NOT NULL,
	"activity_start_date" date,
	"activity_end_date" date,
	"total_amount_involved" numeric(15, 2),
	"currency_code" varchar(3),
	"related_alert_ids" jsonb DEFAULT '[]'::jsonb,
	"related_transaction_ids" jsonb DEFAULT '[]'::jsonb,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"investigation_notes" text,
	"investigator_id" varchar,
	"investigation_start_date" timestamp,
	"investigation_completed_date" timestamp,
	"submitted_by" varchar,
	"submitted_at" timestamp,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"filed_to_authority" varchar(100),
	"filed_at" timestamp,
	"filing_confirmation" varchar(255),
	"filing_method" varchar(50),
	"follow_up_required" boolean DEFAULT false,
	"follow_up_date" date,
	"follow_up_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "suspicious_activity_reports_sar_number_unique" UNIQUE("sar_number")
);
--> statement-breakpoint
CREATE TABLE "transaction_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar,
	"alert_type" varchar(100) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"alert_date" timestamp DEFAULT now() NOT NULL,
	"transaction_type" varchar(50),
	"transaction_id" varchar(255),
	"transaction_amount" numeric(15, 2),
	"transaction_currency" varchar(3),
	"transaction_date" timestamp,
	"rule_id" varchar,
	"rule_name" varchar(255),
	"rule_threshold" jsonb,
	"pattern_description" text,
	"related_transactions" jsonb DEFAULT '[]'::jsonb,
	"risk_score" integer,
	"risk_factors" jsonb,
	"status" varchar(50) DEFAULT 'open',
	"assigned_to" varchar,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"resolution" varchar(100),
	"resolution_notes" text,
	"sar_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transaction_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar,
	"vendor_id" varchar,
	"transaction_type" varchar(50) NOT NULL,
	"transaction_id" varchar(255) NOT NULL,
	"amount" varchar NOT NULL,
	"currency" varchar(3) NOT NULL,
	"transaction_date" date NOT NULL,
	"metadata" jsonb,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "cash_flow_classification" varchar(50) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_cash_equivalent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "cash_equivalent_maturity_days" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "ifrs18_category" varchar(50) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "required_subtotal" varchar(100);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "presentation_order" integer;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "peppol_qr_code" text;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "peppol_transmission_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "peppol_transmitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "peppol_transmission_status" varchar(50);--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "peppol_asp_reference" varchar(255);--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "peppol_ubl_xml" text;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "zatca_uuid" varchar(255);--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "zatca_hash" varchar(512);--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "zatca_previous_invoice_hash" varchar(512);--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "zatca_qr_code" text;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "zatca_clearance_status" varchar(50);--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "zatca_cleared_at" timestamp;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "zatca_reported_at" timestamp;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "zatca_fatoorah_xml" text;--> statement-breakpoint
ALTER TABLE "fx_configs" ADD COLUMN "fx_translation_applied" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "peppol_qr_code" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "peppol_transmission_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "peppol_transmitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "peppol_transmission_status" varchar(50);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "peppol_asp_reference" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "peppol_ubl_xml" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "zatca_uuid" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "zatca_hash" varchar(512);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "zatca_previous_invoice_hash" varchar(512);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "zatca_qr_code" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "zatca_clearance_status" varchar(50);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "zatca_cleared_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "zatca_reported_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "zatca_fatoorah_xml" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "nrv_last_assessed" timestamp;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "nrv_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "total_write_downs" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "tenant_company_profiles" ADD COLUMN "jurisdiction" varchar(50);--> statement-breakpoint
ALTER TABLE "ai_copilot_uploads" ADD CONSTRAINT "ai_copilot_uploads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_copilot_uploads" ADD CONSTRAINT "ai_copilot_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficial_owners" ADD CONSTRAINT "beneficial_owners_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficial_owners" ADD CONSTRAINT "beneficial_owners_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_deadlines" ADD CONSTRAINT "compliance_deadlines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_deadlines" ADD CONSTRAINT "compliance_deadlines_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_metrics" ADD CONSTRAINT "compliance_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_training" ADD CONSTRAINT "compliance_training_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_training" ADD CONSTRAINT "compliance_training_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_risk_profiles" ADD CONSTRAINT "customer_risk_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_risk_profiles" ADD CONSTRAINT "customer_risk_profiles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement_notes" ADD CONSTRAINT "financial_statement_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement_notes" ADD CONSTRAINT "financial_statement_notes_going_concern_reviewed_by_users_id_fk" FOREIGN KEY ("going_concern_reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement_notes" ADD CONSTRAINT "financial_statement_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_translation_runs" ADD CONSTRAINT "fx_translation_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_translation_runs" ADD CONSTRAINT "fx_translation_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nrv_assessments" ADD CONSTRAINT "nrv_assessments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nrv_assessments" ADD CONSTRAINT "nrv_assessments_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nrv_assessments" ADD CONSTRAINT "nrv_assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission_overrides" ADD CONSTRAINT "role_permission_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission_overrides" ADD CONSTRAINT "role_permission_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission_overrides" ADD CONSTRAINT "role_permission_overrides_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission_overrides" ADD CONSTRAINT "role_permission_overrides_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions_screenings" ADD CONSTRAINT "sanctions_screenings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suspicious_activity_reports" ADD CONSTRAINT "suspicious_activity_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suspicious_activity_reports" ADD CONSTRAINT "suspicious_activity_reports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_alerts" ADD CONSTRAINT "transaction_alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_alerts" ADD CONSTRAINT "transaction_alerts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_copilot_uploads_tenant_idx" ON "ai_copilot_uploads" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ai_copilot_uploads_user_idx" ON "ai_copilot_uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_copilot_uploads_expires_at_idx" ON "ai_copilot_uploads" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "alert_rules_tenant_idx" ON "alert_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "alert_rules_is_active_idx" ON "alert_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "alert_rules_rule_type_idx" ON "alert_rules" USING btree ("rule_type");--> statement-breakpoint
CREATE INDEX "attachments_tenant_idx" ON "attachments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "beneficial_owners_tenant_idx" ON "beneficial_owners" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "beneficial_owners_customer_idx" ON "beneficial_owners" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "beneficial_owners_is_pep_idx" ON "beneficial_owners" USING btree ("is_pep");--> statement-breakpoint
CREATE INDEX "idx_compliance_deadlines_tenant" ON "compliance_deadlines" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_deadlines_due_date" ON "compliance_deadlines" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_compliance_deadlines_status" ON "compliance_deadlines" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_compliance_deadlines_assigned_to" ON "compliance_deadlines" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_compliance_metrics_tenant_area" ON "compliance_metrics" USING btree ("tenant_id","compliance_area");--> statement-breakpoint
CREATE INDEX "idx_compliance_metrics_calculated_at" ON "compliance_metrics" USING btree ("calculated_at");--> statement-breakpoint
CREATE INDEX "idx_compliance_training_tenant_user" ON "compliance_training" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_training_status" ON "compliance_training" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_compliance_training_due_date" ON "compliance_training" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "customer_risk_profiles_tenant_idx" ON "customer_risk_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customer_risk_profiles_customer_idx" ON "customer_risk_profiles" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_risk_profiles_risk_level_idx" ON "customer_risk_profiles" USING btree ("overall_risk_level");--> statement-breakpoint
CREATE INDEX "customer_risk_profiles_next_review_idx" ON "customer_risk_profiles" USING btree ("next_review_date");--> statement-breakpoint
CREATE INDEX "financial_statement_notes_tenant_period_idx" ON "financial_statement_notes" USING btree ("tenant_id","reporting_period_start","reporting_period_end");--> statement-breakpoint
CREATE INDEX "financial_statement_notes_tenant_type_idx" ON "financial_statement_notes" USING btree ("tenant_id","note_type");--> statement-breakpoint
CREATE INDEX "financial_statement_notes_tenant_active_idx" ON "financial_statement_notes" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "financial_statement_notes_created_by_idx" ON "financial_statement_notes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "fx_translation_runs_tenant_date_idx" ON "fx_translation_runs" USING btree ("tenant_id","run_date");--> statement-breakpoint
CREATE INDEX "kyc_verifications_tenant_idx" ON "kyc_verifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "kyc_verifications_customer_idx" ON "kyc_verifications" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "kyc_verifications_status_idx" ON "kyc_verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kyc_verifications_risk_level_idx" ON "kyc_verifications" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "nrv_assessments_tenant_item_idx" ON "nrv_assessments" USING btree ("tenant_id","item_id");--> statement-breakpoint
CREATE INDEX "nrv_assessments_tenant_date_idx" ON "nrv_assessments" USING btree ("tenant_id","assessment_date");--> statement-breakpoint
CREATE INDEX "role_permission_overrides_tenant_idx" ON "role_permission_overrides" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "role_permission_overrides_user_idx" ON "role_permission_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "role_permission_overrides_permission_idx" ON "role_permission_overrides" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "role_permission_overrides_expires_at_idx" ON "role_permission_overrides" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sanctions_screenings_tenant_idx" ON "sanctions_screenings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sanctions_screenings_entity_idx" ON "sanctions_screenings" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "sanctions_screenings_overall_result_idx" ON "sanctions_screenings" USING btree ("overall_result");--> statement-breakpoint
CREATE INDEX "sanctions_screenings_requires_review_idx" ON "sanctions_screenings" USING btree ("requires_review");--> statement-breakpoint
CREATE INDEX "suspicious_activity_reports_tenant_idx" ON "suspicious_activity_reports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "suspicious_activity_reports_customer_idx" ON "suspicious_activity_reports" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "suspicious_activity_reports_status_idx" ON "suspicious_activity_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "suspicious_activity_reports_sar_number_idx" ON "suspicious_activity_reports" USING btree ("sar_number");--> statement-breakpoint
CREATE INDEX "transaction_alerts_tenant_idx" ON "transaction_alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "transaction_alerts_customer_idx" ON "transaction_alerts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "transaction_alerts_status_idx" ON "transaction_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transaction_alerts_severity_idx" ON "transaction_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "transaction_alerts_alert_date_idx" ON "transaction_alerts" USING btree ("alert_date");--> statement-breakpoint
CREATE INDEX "transaction_history_tenant_idx" ON "transaction_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "transaction_history_tenant_customer_idx" ON "transaction_history" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "transaction_history_tenant_vendor_idx" ON "transaction_history" USING btree ("tenant_id","vendor_id");--> statement-breakpoint
CREATE INDEX "transaction_history_tenant_date_idx" ON "transaction_history" USING btree ("tenant_id","transaction_date");--> statement-breakpoint
CREATE INDEX "transaction_history_type_idx" ON "transaction_history" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "transaction_history_transaction_id_idx" ON "transaction_history" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "accounts_cash_flow_classification_idx" ON "accounts" USING btree ("tenant_id","cash_flow_classification");--> statement-breakpoint
CREATE INDEX "accounts_cash_equivalent_idx" ON "accounts" USING btree ("tenant_id","is_cash_equivalent");--> statement-breakpoint
CREATE INDEX "accounts_ifrs18_category_idx" ON "accounts" USING btree ("tenant_id","ifrs18_category");