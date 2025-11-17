CREATE TABLE "project_cost_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"cost_category" varchar(50) NOT NULL,
	"account_id" varchar NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_project_cost_category" UNIQUE("tenant_id","project_id","cost_category")
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "project_id" varchar;--> statement-breakpoint
ALTER TABLE "journal_entry_legs" ADD COLUMN "project_id" varchar;--> statement-breakpoint
ALTER TABLE "project_budgets" ADD COLUMN "labor_budget" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "project_budgets" ADD COLUMN "materials_budget" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "project_budgets" ADD COLUMN "overhead_budget" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "project_budgets" ADD COLUMN "other_budget" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "revenue_account_id" varchar;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "default_cost_account_id" varchar;--> statement-breakpoint
ALTER TABLE "project_cost_accounts" ADD CONSTRAINT "project_cost_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_accounts" ADD CONSTRAINT "project_cost_accounts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_accounts" ADD CONSTRAINT "project_cost_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_cost_accounts_tenant_idx" ON "project_cost_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "project_cost_accounts_project_idx" ON "project_cost_accounts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_cost_accounts_account_idx" ON "project_cost_accounts" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_legs" ADD CONSTRAINT "journal_entry_legs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_revenue_account_id_accounts_id_fk" FOREIGN KEY ("revenue_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_cost_account_id_accounts_id_fk" FOREIGN KEY ("default_cost_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_entry_legs_project_idx" ON "journal_entry_legs" USING btree ("project_id");