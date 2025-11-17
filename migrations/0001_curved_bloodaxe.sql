CREATE TABLE "account_balance_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"period_key" varchar(50) NOT NULL,
	"currency_code" varchar(3) NOT NULL,
	"opening_balance" numeric(20, 10) NOT NULL,
	"debit_movements" numeric(20, 10) DEFAULT '0' NOT NULL,
	"credit_movements" numeric(20, 10) DEFAULT '0' NOT NULL,
	"closing_balance" numeric(20, 10) NOT NULL,
	"base_currency_closing_balance" numeric(20, 10) NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_snapshot_per_account_period_currency" UNIQUE("tenant_id","account_id","period_key","currency_code")
);
--> statement-breakpoint
CREATE TABLE "account_sequences" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"prefix" varchar(20) DEFAULT 'ACC-',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "account_transaction_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"journal_entry_id" varchar,
	"journal_entry_leg_id" varchar,
	"transaction_date" timestamp NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"source_document_type" varchar(50),
	"source_document_id" varchar,
	"debit_amount" numeric(15, 2) DEFAULT '0',
	"credit_amount" numeric(15, 2) DEFAULT '0',
	"running_balance" numeric(15, 2) NOT NULL,
	"currency_code" varchar(3) DEFAULT 'USD' NOT NULL,
	"exchange_rate" numeric(20, 10) DEFAULT '1.0' NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "approval_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"approval_request_id" varchar NOT NULL,
	"step_order" integer NOT NULL,
	"approver_user_id" varchar NOT NULL,
	"decision" varchar(20) NOT NULL,
	"comments" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"workflow_id" varchar,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar NOT NULL,
	"requested_by" varchar NOT NULL,
	"current_step" integer DEFAULT 1,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"approval_deadline" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "approval_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"workflow_id" varchar NOT NULL,
	"step_order" integer NOT NULL,
	"approver_role" varchar(100),
	"approver_user_id" varchar,
	"requires_all" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "approval_workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"conditions" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar NOT NULL,
	"changes" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"was_successful" boolean DEFAULT true,
	"error_message" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"connection_id" varchar NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"account_name" varchar(255),
	"account_type" varchar(50),
	"currency" varchar(3) DEFAULT 'AED' NOT NULL,
	"balance" numeric(15, 2),
	"available_balance" numeric(15, 2),
	"balance_as_of" timestamp,
	"account_mask" varchar(10),
	"iban" varchar(34),
	"bank_code" varchar(50),
	"branch_code" varchar(50),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_connection_account" UNIQUE("connection_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"connection_id" varchar NOT NULL,
	"bank_account_id" varchar NOT NULL,
	"provider_transaction_id" varchar(255) NOT NULL,
	"date" timestamp NOT NULL,
	"description" text NOT NULL,
	"enriched_description" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'AED' NOT NULL,
	"transaction_currency_code" varchar(3),
	"transaction_rate_value" numeric(20, 10),
	"transaction_amount" numeric(20, 10),
	"exchange_rate_id" varchar,
	"type" varchar(50) NOT NULL,
	"pending" boolean DEFAULT false,
	"account_id" varchar(255) NOT NULL,
	"extracted_vendor" varchar(255),
	"extracted_reference" varchar(255),
	"extracted_location" varchar(255),
	"suggested_vendor_id" varchar,
	"suggested_customer_id" varchar,
	"suggested_account_id" varchar,
	"category" varchar(100),
	"account_code" varchar(50),
	"taxable_amount" numeric(12, 2),
	"vat_amount" numeric(12, 2),
	"vat_rate" numeric(5, 2) DEFAULT '5.00',
	"vat_status" varchar(50),
	"reconciliation_status" varchar(50) DEFAULT 'unmatched',
	"matched_invoice_id" varchar,
	"matched_bill_id" varchar,
	"matched_payment_id" varchar,
	"matched_journal_entry_id" varchar,
	"match_confidence" numeric(5, 2),
	"matched_at" timestamp,
	"matched_by" varchar,
	"user_reviewed" boolean DEFAULT false,
	"user_ignored" boolean DEFAULT false,
	"user_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_provider_transaction" UNIQUE("tenant_id","account_id","provider_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "bill_payment_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"payment_id" varchar NOT NULL,
	"bill_id" varchar NOT NULL,
	"amount_applied" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"code" varchar(3) NOT NULL,
	"name" varchar(100) NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"decimal_places" integer DEFAULT 2 NOT NULL,
	"is_base_currency" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_currency_per_tenant" UNIQUE("tenant_id","code")
);
--> statement-breakpoint
CREATE TABLE "custom_report_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"selected_columns" jsonb NOT NULL,
	"filters" jsonb NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_payment_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"payment_id" varchar NOT NULL,
	"invoice_id" varchar NOT NULL,
	"amount_applied" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debit_note_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"debit_note_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"transaction_currency_code" varchar(3),
	"transaction_rate_value" numeric(20, 10),
	"transaction_amount" numeric(20, 10),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debit_note_sequences" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"prefix" varchar(20) DEFAULT 'DN-',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debit_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"vendor_id" varchar NOT NULL,
	"bill_id" varchar,
	"debit_note_number" varchar(100),
	"debit_note_date" timestamp NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"applied_amount" numeric(12, 2) DEFAULT '0',
	"currency_code" varchar(3) DEFAULT 'USD' NOT NULL,
	"exchange_rate" numeric(20, 10) DEFAULT '1.0' NOT NULL,
	"base_currency_amount" numeric(15, 2),
	"transaction_currency_code" varchar(3),
	"transaction_rate_source" varchar(50),
	"transaction_rate_value" numeric(20, 10),
	"exchange_rate_id" varchar,
	"transaction_total_amount" numeric(20, 10),
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_debit_note_number_tenant" UNIQUE("tenant_id","debit_note_number")
);
--> statement-breakpoint
CREATE TABLE "exchange_difference_journals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"journal_entry_id" varchar NOT NULL,
	"difference_type" varchar(20) NOT NULL,
	"source_transaction_id" varchar,
	"source_transaction_type" varchar(50),
	"account_id" varchar NOT NULL,
	"currency_code" varchar(3) NOT NULL,
	"original_amount" numeric(20, 10) NOT NULL,
	"original_rate" numeric(20, 10) NOT NULL,
	"revaluation_rate" numeric(20, 10) NOT NULL,
	"gain_loss_amount" numeric(20, 10) NOT NULL,
	"period_key" varchar(50) NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"from_currency_code" varchar(3) NOT NULL,
	"to_currency_code" varchar(3) NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"effective_date" timestamp NOT NULL,
	"source" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "fiscal_periods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"period_key" varchar(50) NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"lock_state" varchar(20) DEFAULT 'unlocked' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_period_per_tenant" UNIQUE("tenant_id","period_key")
);
--> statement-breakpoint
CREATE TABLE "fx_configs" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"auto_refresh_enabled" boolean DEFAULT true NOT NULL,
	"source_strategy" varchar DEFAULT 'api' NOT NULL,
	"primary_rate_source" varchar DEFAULT 'cbuae' NOT NULL,
	"primary_source_provider" varchar DEFAULT 'github' NOT NULL,
	"fallback_rate_source" varchar,
	"last_refresh_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_balances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"opening_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"closing_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency_code" varchar(3) DEFAULT 'USD' NOT NULL,
	"exchange_rate" numeric(20, 10) DEFAULT '1.0' NOT NULL,
	CONSTRAINT "unique_historical_balance_period" UNIQUE("tenant_id","account_id","period_start","period_end")
);
--> statement-breakpoint
CREATE TABLE "open_banking_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50),
	"resource_id" varchar,
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "open_banking_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"provider" varchar(50) NOT NULL,
	"entity_id" varchar(255),
	"customer_id" varchar(255),
	"account_id" varchar(255),
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"encryption_iv" varchar(255),
	"encryption_auth_tag" varchar(255),
	"encryption_key_version" varchar(50),
	"refresh_token_iv" varchar(255),
	"refresh_token_auth_tag" varchar(255),
	"refresh_token_key_version" varchar(50) DEFAULT 'v1',
	"bank_identifier" varchar(100),
	"bank_name" varchar(255),
	"account_type" varchar(50),
	"account_mask" varchar(10),
	"currency" varchar(3) DEFAULT 'AED',
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"connected_at" timestamp DEFAULT now(),
	"last_sync_at" timestamp,
	"last_successful_sync_at" timestamp,
	"sync_errors" integer DEFAULT 0,
	"last_sync_error" text,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"disconnected_at" timestamp,
	"disconnected_by" varchar
);
--> statement-breakpoint
CREATE TABLE "open_banking_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"connection_id" varchar NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_payment_id" varchar NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'AED' NOT NULL,
	"recipient_account_id" varchar NOT NULL,
	"reference" text,
	"status" varchar(50) NOT NULL,
	"invoice_id" varchar,
	"bill_id" varchar,
	"initiated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_provider_payment" UNIQUE("tenant_id","provider","provider_payment_id")
);
--> statement-breakpoint
CREATE TABLE "opening_balances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"currency_code" varchar(3) NOT NULL,
	"amount" numeric(20, 10) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"source" varchar(50) NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"captured_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"batch_number" varchar(100),
	"total_amount" numeric(12, 2) NOT NULL,
	"payment_count" integer NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"executed_by" varchar,
	"executed_at" timestamp,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_payment_batch_number_tenant" UNIQUE("tenant_id","batch_number")
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"connection_id" varchar NOT NULL,
	"bank_account_id" varchar NOT NULL,
	"provider_payment_id" varchar(255),
	"bill_id" varchar,
	"vendor_id" varchar,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'AED' NOT NULL,
	"reference" varchar(255),
	"description" text,
	"beneficiary_name" varchar(255),
	"beneficiary_account" varchar(255),
	"beneficiary_bank_code" varchar(50),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"initiated_at" timestamp DEFAULT now(),
	"authorized_at" timestamp,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"error_code" varchar(100),
	"error_message" text,
	"initiated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "period_closures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"period_key" varchar(50) NOT NULL,
	"fiscal_period_id" varchar NOT NULL,
	"closed_by" varchar NOT NULL,
	"closed_at" timestamp DEFAULT now() NOT NULL,
	"closing_rate_set_id" varchar,
	"reopened_by" varchar,
	"reopened_at" timestamp,
	"reopen_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "project_budgets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"category" varchar(100) NOT NULL,
	"budgeted_amount" numeric(15, 2) NOT NULL,
	"actual_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"expense_id" varchar,
	"amount" numeric(15, 2) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(100),
	"is_billable" boolean DEFAULT true NOT NULL,
	"is_invoiced" boolean DEFAULT false NOT NULL,
	"invoice_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_invoice_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"project_invoice_id" varchar NOT NULL,
	"milestone_id" varchar NOT NULL,
	"invoiced_amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_project_invoice_milestone" UNIQUE("tenant_id","project_invoice_id","milestone_id")
);
--> statement-breakpoint
CREATE TABLE "project_invoice_time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"project_invoice_id" varchar NOT NULL,
	"time_entry_id" varchar NOT NULL,
	"hours" numeric(10, 2) NOT NULL,
	"rate" numeric(10, 2) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_project_invoice_time_entry" UNIQUE("tenant_id","project_invoice_id","time_entry_id")
);
--> statement-breakpoint
CREATE TABLE "project_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"invoice_id" varchar NOT NULL,
	"billing_mode" varchar(50) NOT NULL,
	"milestone_id" varchar,
	"percentage_complete" numeric(5, 2),
	"source_summary" text,
	"period_start" date,
	"period_end" date,
	"total_hours" numeric(10, 2),
	"total_amount" numeric(15, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_project_invoice" UNIQUE("tenant_id","invoice_id")
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar(100),
	"billable_rate" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"left_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_project_member" UNIQUE("tenant_id","project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"due_date" date NOT NULL,
	"completed_date" date,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"billing_percentage" numeric(5, 2),
	"invoiceable_amount" numeric(15, 2),
	"invoiced_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_fully_invoiced" boolean DEFAULT false NOT NULL,
	"invoice_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'not_started' NOT NULL,
	"priority" varchar(50) DEFAULT 'medium' NOT NULL,
	"assigned_to" varchar,
	"estimated_hours" numeric(10, 2),
	"actual_hours" numeric(10, 2) DEFAULT '0' NOT NULL,
	"due_date" date,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"project_number" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"billing_type" varchar(50) DEFAULT 'time_and_materials' NOT NULL,
	"budget_amount" numeric(15, 2),
	"budget_hours" numeric(10, 2),
	"start_date" date,
	"end_date" date,
	"project_manager_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_project_number_per_tenant" UNIQUE("tenant_id","project_number")
);
--> statement-breakpoint
CREATE TABLE "reconciliation_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"priority" integer DEFAULT 100,
	"transaction_type" varchar(50),
	"amount_min" numeric(12, 2),
	"amount_max" numeric(12, 2),
	"description_pattern" text,
	"vendor_id" varchar,
	"customer_id" varchar,
	"category_pattern" varchar(255),
	"action" varchar(50) NOT NULL,
	"target_account_id" varchar,
	"apply_vat" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"match_count" integer DEFAULT 0,
	"last_matched_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_role_permission" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_role_per_tenant" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "scheduled_report_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"scheduled_report_id" varchar NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"report_data" jsonb,
	"email_sent" boolean DEFAULT false NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"custom_report_id" varchar,
	"schedule" varchar(100) NOT NULL,
	"recipients" text[] NOT NULL,
	"email_subject" varchar(500) NOT NULL,
	"email_body" text,
	"include_comparison" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_run_at" timestamp,
	"next_run_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tenant_member_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_member_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_member_role" UNIQUE("tenant_member_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"task_id" varchar,
	"user_id" varchar NOT NULL,
	"description" text NOT NULL,
	"date" date NOT NULL,
	"hours" numeric(10, 2) NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"is_billable" boolean DEFAULT true NOT NULL,
	"billable_rate" numeric(10, 2),
	"billable_amount" numeric(15, 2),
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"invoice_id" varchar,
	"project_invoice_id" varchar,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"provider" varchar(50) NOT NULL,
	"webhook_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"headers" jsonb,
	"status" varchar(50) DEFAULT 'received' NOT NULL,
	"signature_valid" boolean,
	"error_message" text,
	"error_stack" text,
	"retry_count" integer DEFAULT 0,
	"received_at" timestamp DEFAULT now(),
	"processed_at" timestamp,
	"processing_duration" integer
);
--> statement-breakpoint
ALTER TABLE "bill_line_items" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "bill_line_items" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "bill_line_items" ADD COLUMN "transaction_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "project_name" varchar(255);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "ai_extraction_status" varchar(50) DEFAULT 'pending_review';--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "ai_confidence_score" integer;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "ai_suggested_accounts" jsonb;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "reviewed_by" varchar;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "review_notes" text;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "ai_corrections_made" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "currency_code" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "exchange_rate" numeric(20, 10) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "base_currency_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "transaction_rate_source" varchar(50);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "exchange_rate_id" varchar;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "transaction_total_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "credit_note_line_items" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "credit_note_line_items" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "credit_note_line_items" ADD COLUMN "transaction_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "currency_code" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "exchange_rate" numeric(20, 10) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "base_currency_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "transaction_rate_source" varchar(50);--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "exchange_rate_id" varchar;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "transaction_total_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "customer_payments" ADD COLUMN "currency_code" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD COLUMN "exchange_rate" numeric(20, 10) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD COLUMN "base_currency_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "customer_payments" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "customer_payments" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "customer_payments" ADD COLUMN "transaction_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "customer_payments" ADD COLUMN "base_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "customer_payments" ADD COLUMN "exchange_rate_id" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "currency_code" varchar(3) DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "transaction_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "exchange_rate_id" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "employee_id" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "submitted_by" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "approval_workflow_id" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "approval_request_id" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "approved_by" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "rejected_by" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "reimbursement_status" varchar(50) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "reimbursed_by" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "reimbursed_at" timestamp;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "payment_reference" varchar(200);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "payment_method" varchar(50);--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "transaction_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "project_name" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "currency_code" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "exchange_rate" numeric(20, 10) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "base_currency_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "transaction_rate_source" varchar(50);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "exchange_rate_id" varchar;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "transaction_total_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "currency_code" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "exchange_rate" numeric(20, 10) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "base_currency_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "source_document_type" varchar(50);--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "source_document_id" varchar;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "is_auto_generated" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "modification_locked" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "reversed_entry_id" varchar;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "reversal_reason" text;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "workflow_request_id" varchar;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "prepared_by" varchar;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "prepared_at" timestamp;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "posted_by" varchar;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "posted_at" timestamp;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "last_modified_by" varchar;--> statement-breakpoint
ALTER TABLE "journal_entry_legs" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "journal_entry_legs" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "journal_entry_legs" ADD COLUMN "transaction_amount_debit" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "journal_entry_legs" ADD COLUMN "transaction_amount_credit" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "currency_code" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "exchange_rate" numeric(20, 10) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "base_currency_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "transaction_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "base_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "exchange_rate_id" varchar;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "approval_status" varchar(50) DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "approval_workflow_id" varchar;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "approval_chain" jsonb;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "approved_by" jsonb;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "approved_at" jsonb;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "authorization_status" varchar(50) DEFAULT 'not_required';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "authorized_by" varchar;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "authorized_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "executed_by" varchar;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "executed_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fraud_check_status" varchar(50) DEFAULT 'not_checked';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fraud_flags" jsonb;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_batch_id" varchar;--> statement-breakpoint
ALTER TABLE "purchase_order_line_items" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "purchase_order_line_items" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "purchase_order_line_items" ADD COLUMN "transaction_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "currency_code" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "exchange_rate" numeric(20, 10) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "base_currency_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "transaction_rate_source" varchar(50);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "exchange_rate_id" varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "transaction_total_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "approved_by" varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "converted_to_bill_id" varchar;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "converted_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD COLUMN "transaction_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "currency_code" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "exchange_rate" numeric(20, 10) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "base_currency_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "transaction_rate_source" varchar(50);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "exchange_rate_id" varchar;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "transaction_total_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "sales_order_line_items" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "sales_order_line_items" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "sales_order_line_items" ADD COLUMN "transaction_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "currency_code" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "exchange_rate" numeric(20, 10) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "base_currency_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "transaction_currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "transaction_rate_source" varchar(50);--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "transaction_rate_value" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "exchange_rate_id" varchar;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "transaction_total_amount" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "tenant_company_profiles" ADD COLUMN "ifrs_compliance_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_company_profiles" ADD COLUMN "fx_translation_standard" varchar(20) DEFAULT 'ifrs-sme';--> statement-breakpoint
ALTER TABLE "tenant_company_profiles" ADD COLUMN "fx_income_expense_method" varchar(20) DEFAULT 'transaction-date';--> statement-breakpoint
ALTER TABLE "tenant_company_profiles" ADD COLUMN "fx_gain_account_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenant_company_profiles" ADD COLUMN "fx_loss_account_id" varchar(255);--> statement-breakpoint
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "account_balance_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "account_balance_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_sequences" ADD CONSTRAINT "account_sequences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transaction_history" ADD CONSTRAINT "account_transaction_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transaction_history" ADD CONSTRAINT "account_transaction_history_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transaction_history" ADD CONSTRAINT "account_transaction_history_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transaction_history" ADD CONSTRAINT "account_transaction_history_journal_entry_leg_id_journal_entry_legs_id_fk" FOREIGN KEY ("journal_entry_leg_id") REFERENCES "public"."journal_entry_legs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workflow_id_approval_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."approval_workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_workflow_id_approval_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."approval_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_connection_id_open_banking_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."open_banking_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_connection_id_open_banking_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."open_banking_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_suggested_vendor_id_vendors_id_fk" FOREIGN KEY ("suggested_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_suggested_customer_id_customers_id_fk" FOREIGN KEY ("suggested_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_suggested_account_id_accounts_id_fk" FOREIGN KEY ("suggested_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_invoice_id_invoices_id_fk" FOREIGN KEY ("matched_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_bill_id_bills_id_fk" FOREIGN KEY ("matched_bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("matched_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_by_users_id_fk" FOREIGN KEY ("matched_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payment_applications" ADD CONSTRAINT "bill_payment_applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payment_applications" ADD CONSTRAINT "bill_payment_applications_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payment_applications" ADD CONSTRAINT "bill_payment_applications_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_report_configs" ADD CONSTRAINT "custom_report_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_report_configs" ADD CONSTRAINT "custom_report_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_applications" ADD CONSTRAINT "customer_payment_applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_applications" ADD CONSTRAINT "customer_payment_applications_payment_id_customer_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."customer_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_applications" ADD CONSTRAINT "customer_payment_applications_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_line_items" ADD CONSTRAINT "debit_note_line_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_line_items" ADD CONSTRAINT "debit_note_line_items_debit_note_id_debit_notes_id_fk" FOREIGN KEY ("debit_note_id") REFERENCES "public"."debit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_line_items" ADD CONSTRAINT "debit_note_line_items_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_sequences" ADD CONSTRAINT "debit_note_sequences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_difference_journals" ADD CONSTRAINT "exchange_difference_journals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_difference_journals" ADD CONSTRAINT "exchange_difference_journals_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_difference_journals" ADD CONSTRAINT "exchange_difference_journals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_configs" ADD CONSTRAINT "fx_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_balances" ADD CONSTRAINT "historical_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_balances" ADD CONSTRAINT "historical_balances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_banking_audit_logs" ADD CONSTRAINT "open_banking_audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_banking_audit_logs" ADD CONSTRAINT "open_banking_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_banking_connections" ADD CONSTRAINT "open_banking_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_banking_connections" ADD CONSTRAINT "open_banking_connections_disconnected_by_users_id_fk" FOREIGN KEY ("disconnected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_banking_payments" ADD CONSTRAINT "open_banking_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_banking_payments" ADD CONSTRAINT "open_banking_payments_connection_id_open_banking_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."open_banking_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_banking_payments" ADD CONSTRAINT "open_banking_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_banking_payments" ADD CONSTRAINT "open_banking_payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_captured_by_users_id_fk" FOREIGN KEY ("captured_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_connection_id_open_banking_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."open_banking_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_closures" ADD CONSTRAINT "period_closures_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_closures" ADD CONSTRAINT "period_closures_fiscal_period_id_fiscal_periods_id_fk" FOREIGN KEY ("fiscal_period_id") REFERENCES "public"."fiscal_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_closures" ADD CONSTRAINT "period_closures_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_closures" ADD CONSTRAINT "period_closures_reopened_by_users_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoice_milestones" ADD CONSTRAINT "project_invoice_milestones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoice_milestones" ADD CONSTRAINT "project_invoice_milestones_project_invoice_id_project_invoices_id_fk" FOREIGN KEY ("project_invoice_id") REFERENCES "public"."project_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoice_milestones" ADD CONSTRAINT "project_invoice_milestones_milestone_id_project_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."project_milestones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoice_time_entries" ADD CONSTRAINT "project_invoice_time_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoice_time_entries" ADD CONSTRAINT "project_invoice_time_entries_project_invoice_id_project_invoices_id_fk" FOREIGN KEY ("project_invoice_id") REFERENCES "public"."project_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoice_time_entries" ADD CONSTRAINT "project_invoice_time_entries_time_entry_id_time_entries_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoices" ADD CONSTRAINT "project_invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoices" ADD CONSTRAINT "project_invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoices" ADD CONSTRAINT "project_invoices_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoices" ADD CONSTRAINT "project_invoices_milestone_id_project_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."project_milestones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_manager_id_users_id_fk" FOREIGN KEY ("project_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_target_account_id_accounts_id_fk" FOREIGN KEY ("target_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_report_runs" ADD CONSTRAINT "scheduled_report_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_report_runs" ADD CONSTRAINT "scheduled_report_runs_scheduled_report_id_scheduled_reports_id_fk" FOREIGN KEY ("scheduled_report_id") REFERENCES "public"."scheduled_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_custom_report_id_custom_report_configs_id_fk" FOREIGN KEY ("custom_report_id") REFERENCES "public"."custom_report_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_member_roles" ADD CONSTRAINT "tenant_member_roles_tenant_member_id_tenant_members_id_fk" FOREIGN KEY ("tenant_member_id") REFERENCES "public"."tenant_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_member_roles" ADD CONSTRAINT "tenant_member_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_invoice_id_project_invoices_id_fk" FOREIGN KEY ("project_invoice_id") REFERENCES "public"."project_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_balance_snapshots_tenant_idx" ON "account_balance_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "account_balance_snapshots_account_idx" ON "account_balance_snapshots" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_balance_snapshots_period_idx" ON "account_balance_snapshots" USING btree ("period_key");--> statement-breakpoint
CREATE INDEX "account_transaction_history_account_idx" ON "account_transaction_history" USING btree ("tenant_id","account_id");--> statement-breakpoint
CREATE INDEX "account_transaction_history_date_idx" ON "account_transaction_history" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "account_transaction_history_source_idx" ON "account_transaction_history" USING btree ("source_document_type","source_document_id");--> statement-breakpoint
CREATE INDEX "account_transaction_history_journal_entry_idx" ON "account_transaction_history" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "idx_account_tx_history_tenant_account_date" ON "account_transaction_history" USING btree ("tenant_id","account_id","transaction_date");--> statement-breakpoint
CREATE INDEX "approval_history_request_idx" ON "approval_history" USING btree ("approval_request_id");--> statement-breakpoint
CREATE INDEX "approval_requests_entity_idx" ON "approval_requests" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "approval_requests_status_idx" ON "approval_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "approval_steps_workflow_idx" ON "approval_steps" USING btree ("workflow_id","step_order");--> statement-breakpoint
CREATE INDEX "approval_workflows_entity_type_idx" ON "approval_workflows" USING btree ("tenant_id","entity_type","is_active");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_entity_idx" ON "audit_logs" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_bank_accounts_tenant" ON "bank_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_bank_accounts_connection" ON "bank_accounts" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_bank_accounts_status" ON "bank_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bt_tenant_connection" ON "bank_transactions" USING btree ("tenant_id","connection_id");--> statement-breakpoint
CREATE INDEX "idx_bt_bank_account" ON "bank_transactions" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "idx_bt_date" ON "bank_transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_bt_reconciliation" ON "bank_transactions" USING btree ("reconciliation_status");--> statement-breakpoint
CREATE INDEX "idx_bt_matched_invoice" ON "bank_transactions" USING btree ("matched_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_bt_matched_bill" ON "bank_transactions" USING btree ("matched_bill_id");--> statement-breakpoint
CREATE INDEX "idx_bt_pending" ON "bank_transactions" USING btree ("pending");--> statement-breakpoint
CREATE INDEX "bill_payment_applications_payment_idx" ON "bill_payment_applications" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "bill_payment_applications_bill_idx" ON "bill_payment_applications" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "currencies_tenant_idx" ON "currencies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "currencies_code_idx" ON "currencies" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_base_currency_per_tenant" ON "currencies" USING btree ("tenant_id") WHERE "currencies"."is_base_currency" = true;--> statement-breakpoint
CREATE INDEX "custom_report_configs_tenant_idx" ON "custom_report_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "custom_report_configs_created_by_idx" ON "custom_report_configs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "customer_payment_applications_payment_idx" ON "customer_payment_applications" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "customer_payment_applications_invoice_idx" ON "customer_payment_applications" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "debit_notes_vendor_idx" ON "debit_notes" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "debit_notes_bill_idx" ON "debit_notes" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "exchange_difference_journals_tenant_idx" ON "exchange_difference_journals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "exchange_difference_journals_journal_idx" ON "exchange_difference_journals" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "exchange_difference_journals_period_idx" ON "exchange_difference_journals" USING btree ("period_key");--> statement-breakpoint
CREATE INDEX "exchange_difference_journals_account_idx" ON "exchange_difference_journals" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "exchange_rates_tenant_idx" ON "exchange_rates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "exchange_rates_from_currency_idx" ON "exchange_rates" USING btree ("from_currency_code");--> statement-breakpoint
CREATE INDEX "exchange_rates_to_currency_idx" ON "exchange_rates" USING btree ("to_currency_code");--> statement-breakpoint
CREATE INDEX "exchange_rates_effective_date_idx" ON "exchange_rates" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "fiscal_periods_tenant_idx" ON "fiscal_periods" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "fiscal_periods_status_idx" ON "fiscal_periods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "historical_balances_account_idx" ON "historical_balances" USING btree ("tenant_id","account_id");--> statement-breakpoint
CREATE INDEX "historical_balances_period_idx" ON "historical_balances" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_historical_balances_tenant_account_period" ON "historical_balances" USING btree ("tenant_id","account_id","period_start");--> statement-breakpoint
CREATE INDEX "idx_ob_audit_tenant" ON "open_banking_audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ob_audit_user" ON "open_banking_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ob_audit_action" ON "open_banking_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_ob_audit_timestamp" ON "open_banking_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_obc_tenant_provider" ON "open_banking_connections" USING btree ("tenant_id","provider");--> statement-breakpoint
CREATE INDEX "idx_obc_entity_id" ON "open_banking_connections" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_obc_status" ON "open_banking_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_obc_tenant_status" ON "open_banking_connections" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "open_banking_payments_tenant_idx" ON "open_banking_payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "open_banking_payments_connection_idx" ON "open_banking_payments" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "open_banking_payments_status_idx" ON "open_banking_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "opening_balances_tenant_idx" ON "opening_balances" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "opening_balances_account_idx" ON "opening_balances" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "opening_balances_period_idx" ON "opening_balances" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "payment_batches_status_idx" ON "payment_batches" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_payment_intents_tenant" ON "payment_intents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_payment_intents_connection" ON "payment_intents" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_payment_intents_bank_account" ON "payment_intents" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "idx_payment_intents_bill" ON "payment_intents" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "idx_payment_intents_status" ON "payment_intents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_intents_provider" ON "payment_intents" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE INDEX "period_closures_tenant_idx" ON "period_closures" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "period_closures_period_idx" ON "period_closures" USING btree ("fiscal_period_id");--> statement-breakpoint
CREATE INDEX "permissions_module_idx" ON "permissions" USING btree ("module");--> statement-breakpoint
CREATE INDEX "permissions_action_idx" ON "permissions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "project_budgets_tenant_idx" ON "project_budgets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "project_budgets_project_idx" ON "project_budgets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_expenses_tenant_idx" ON "project_expenses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "project_expenses_project_idx" ON "project_expenses" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_expenses_expense_idx" ON "project_expenses" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "project_expenses_invoice_idx" ON "project_expenses" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "project_invoice_milestones_tenant_idx" ON "project_invoice_milestones" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "project_invoice_milestones_project_invoice_idx" ON "project_invoice_milestones" USING btree ("project_invoice_id");--> statement-breakpoint
CREATE INDEX "project_invoice_time_entries_tenant_idx" ON "project_invoice_time_entries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "project_invoice_time_entries_project_invoice_idx" ON "project_invoice_time_entries" USING btree ("project_invoice_id");--> statement-breakpoint
CREATE INDEX "project_invoices_tenant_idx" ON "project_invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "project_invoices_project_idx" ON "project_invoices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_invoices_invoice_idx" ON "project_invoices" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "project_invoices_milestone_idx" ON "project_invoices" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "project_members_tenant_idx" ON "project_members" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "project_members_project_idx" ON "project_members" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_members_user_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_milestones_tenant_idx" ON "project_milestones" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "project_milestones_project_idx" ON "project_milestones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_milestones_status_idx" ON "project_milestones" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_milestones_due_date_idx" ON "project_milestones" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "project_tasks_tenant_idx" ON "project_tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "project_tasks_project_idx" ON "project_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_tasks_assigned_to_idx" ON "project_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "project_tasks_status_idx" ON "project_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_tasks_due_date_idx" ON "project_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "projects_tenant_idx" ON "projects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "projects_customer_idx" ON "projects" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "projects_project_manager_idx" ON "projects" USING btree ("project_manager_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_recon_rules_tenant" ON "reconciliation_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_recon_rules_priority" ON "reconciliation_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_recon_rules_active" ON "reconciliation_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "role_permissions_role_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "roles_tenant_idx" ON "roles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "scheduled_report_runs_tenant_idx" ON "scheduled_report_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "scheduled_report_runs_scheduled_report_id_idx" ON "scheduled_report_runs" USING btree ("scheduled_report_id");--> statement-breakpoint
CREATE INDEX "scheduled_report_runs_run_at_idx" ON "scheduled_report_runs" USING btree ("run_at");--> statement-breakpoint
CREATE INDEX "scheduled_report_runs_status_idx" ON "scheduled_report_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scheduled_reports_tenant_idx" ON "scheduled_reports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "scheduled_reports_created_by_idx" ON "scheduled_reports" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "scheduled_reports_is_active_idx" ON "scheduled_reports" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "tenant_member_roles_member_idx" ON "tenant_member_roles" USING btree ("tenant_member_id");--> statement-breakpoint
CREATE INDEX "tenant_member_roles_role_idx" ON "tenant_member_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "time_entries_tenant_idx" ON "time_entries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "time_entries_project_idx" ON "time_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "time_entries_user_idx" ON "time_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "time_entries_task_idx" ON "time_entries" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "time_entries_date_idx" ON "time_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "time_entries_status_idx" ON "time_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "time_entries_invoice_idx" ON "time_entries" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "time_entries_project_invoice_idx" ON "time_entries" USING btree ("project_invoice_id");--> statement-breakpoint
CREATE INDEX "time_entries_tenant_status_idx" ON "time_entries" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_tenant" ON "webhook_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_provider" ON "webhook_logs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_status" ON "webhook_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_received" ON "webhook_logs" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_type" ON "webhook_logs" USING btree ("webhook_type");--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approval_workflow_id_approval_workflows_id_fk" FOREIGN KEY ("approval_workflow_id") REFERENCES "public"."approval_workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_reimbursed_by_users_id_fk" FOREIGN KEY ("reimbursed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversed_entry_id_journal_entries_id_fk" FOREIGN KEY ("reversed_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_prepared_by_users_id_fk" FOREIGN KEY ("prepared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_last_modified_by_users_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_approval_workflow_id_approval_workflows_id_fk" FOREIGN KEY ("approval_workflow_id") REFERENCES "public"."approval_workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_authorized_by_users_id_fk" FOREIGN KEY ("authorized_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_batch_id_payment_batches_id_fk" FOREIGN KEY ("payment_batch_id") REFERENCES "public"."payment_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_converted_to_bill_id_bills_id_fk" FOREIGN KEY ("converted_to_bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bills_ai_extraction_status_idx" ON "bills" USING btree ("ai_extraction_status");--> statement-breakpoint
CREATE INDEX "bills_reviewed_by_idx" ON "bills" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX "journal_entries_source_document_idx" ON "journal_entries" USING btree ("source_document_type","source_document_id");--> statement-breakpoint
CREATE INDEX "journal_entries_tenant_date_idx" ON "journal_entries" USING btree ("tenant_id","entry_date");--> statement-breakpoint
CREATE INDEX "journal_entries_reversed_entry_idx" ON "journal_entries" USING btree ("reversed_entry_id");--> statement-breakpoint
CREATE INDEX "journal_entries_workflow_request_idx" ON "journal_entries" USING btree ("workflow_request_id");--> statement-breakpoint
CREATE INDEX "payments_approval_status_idx" ON "payments" USING btree ("tenant_id","approval_status");--> statement-breakpoint
CREATE INDEX "payments_batch_idx" ON "payments" USING btree ("payment_batch_id");