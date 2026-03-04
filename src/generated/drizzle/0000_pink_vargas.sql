CREATE TYPE "public"."account_sub_type" AS ENUM('cash', 'bank', 'accounts_receivable', 'inventory', 'crypto_wallet', 'investment', 'fixed_asset', 'other_asset', 'credit_card', 'accounts_payable', 'loan', 'mortgage', 'other_liability', 'owners_equity', 'retained_earnings', 'other_equity', 'sales', 'service_revenue', 'interest_income', 'crypto_gains', 'other_revenue', 'cost_of_goods', 'operating_expense', 'payroll', 'tax_expense', 'crypto_losses', 'other_expense');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."book_type" AS ENUM('business', 'personal');--> statement-breakpoint
CREATE TYPE "public"."budget_period" AS ENUM('monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."connected_account_provider" AS ENUM('plaid', 'mx', 'wallet_connect', 'exchange_api', 'manual');--> statement-breakpoint
CREATE TYPE "public"."connected_account_status" AS ENUM('active', 'disconnected', 'error');--> statement-breakpoint
CREATE TYPE "public"."cost_basis_method" AS ENUM('fifo', 'lifo', 'hifo', 'acb');--> statement-breakpoint
CREATE TYPE "public"."journal_entry_source" AS ENUM('manual', 'mantle_sync', 'plaid_import', 'crypto_sync', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('pending_review', 'approved', 'adjusted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."recurring_frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"code" text,
	"type" "account_type" NOT NULL,
	"sub_type" "account_sub_type",
	"is_placeholder" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "account_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"debit_account_id" uuid NOT NULL,
	"credit_account_id" uuid NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "book_type" NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"fiscal_year_start_month" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"period" "budget_period" DEFAULT 'monthly' NOT NULL,
	"rollover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "connected_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"provider" "connected_account_provider" NOT NULL,
	"provider_account_id" text,
	"account_id" uuid,
	"institution_name" text,
	"mask" text,
	"status" "connected_account_status" DEFAULT 'active' NOT NULL,
	"access_token" text,
	"last_synced_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crypto_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"wallet_address" text,
	"network" text,
	"balance" numeric(28, 18) DEFAULT '0' NOT NULL,
	"cost_basis_method" "cost_basis_method" DEFAULT 'fifo' NOT NULL,
	"last_synced_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crypto_lot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crypto_asset_id" uuid NOT NULL,
	"acquired_at" timestamp(6) with time zone NOT NULL,
	"quantity" numeric(28, 18) NOT NULL,
	"cost_per_unit" numeric(19, 4) NOT NULL,
	"remaining_quantity" numeric(28, 18) NOT NULL,
	"disposed_at" timestamp(6) with time zone,
	"proceeds_per_unit" numeric(19, 4),
	"journal_entry_id" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journal_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"date" timestamp(6) with time zone NOT NULL,
	"memo" text,
	"source" "journal_entry_source" DEFAULT 'manual' NOT NULL,
	"source_reference_id" text,
	"is_reviewed" boolean DEFAULT false NOT NULL,
	"is_reconciled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journal_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit" numeric(19, 4) DEFAULT '0' NOT NULL,
	"credit" numeric(19, 4) DEFAULT '0' NOT NULL,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "net_worth_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"date" timestamp(6) with time zone NOT NULL,
	"total_assets" numeric(19, 4) NOT NULL,
	"total_liabilities" numeric(19, 4) NOT NULL,
	"net_worth" numeric(19, 4) NOT NULL,
	"breakdown" text,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reconciliation_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"status" "reconciliation_status" DEFAULT 'pending_review' NOT NULL,
	"reviewed_at" timestamp(6) with time zone,
	"reviewed_by" text,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recurring_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"frequency" "recurring_frequency" NOT NULL,
	"account_id" uuid NOT NULL,
	"counter_account_id" uuid,
	"is_auto_detected" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"next_expected_date" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "savings_goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_amount" numeric(19, 4) NOT NULL,
	"target_date" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_parent_id_account_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_mapping" ADD CONSTRAINT "account_mapping_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_mapping" ADD CONSTRAINT "account_mapping_debit_account_id_account_id_fk" FOREIGN KEY ("debit_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_mapping" ADD CONSTRAINT "account_mapping_credit_account_id_account_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_account" ADD CONSTRAINT "connected_account_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_account" ADD CONSTRAINT "connected_account_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_asset" ADD CONSTRAINT "crypto_asset_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_lot" ADD CONSTRAINT "crypto_lot_crypto_asset_id_crypto_asset_id_fk" FOREIGN KEY ("crypto_asset_id") REFERENCES "public"."crypto_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_lot" ADD CONSTRAINT "crypto_lot_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "net_worth_snapshot" ADD CONSTRAINT "net_worth_snapshot_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ADD CONSTRAINT "reconciliation_queue_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ADD CONSTRAINT "reconciliation_queue_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction" ADD CONSTRAINT "recurring_transaction_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction" ADD CONSTRAINT "recurring_transaction_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction" ADD CONSTRAINT "recurring_transaction_counter_account_id_account_id_fk" FOREIGN KEY ("counter_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goal" ADD CONSTRAINT "savings_goal_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goal" ADD CONSTRAINT "savings_goal_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_id_index" ON "account" USING btree ("id");--> statement-breakpoint
CREATE INDEX "account_book_id_idx" ON "account" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "account_parent_id_idx" ON "account" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "account_type_idx" ON "account" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "account_mapping_id_index" ON "account_mapping" USING btree ("id");--> statement-breakpoint
CREATE INDEX "account_mapping_book_id_idx" ON "account_mapping" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "account_mapping_event_type_idx" ON "account_mapping" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "book_id_index" ON "book" USING btree ("id");--> statement-breakpoint
CREATE INDEX "book_organization_id_idx" ON "book" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_id_index" ON "budget" USING btree ("id");--> statement-breakpoint
CREATE INDEX "budget_book_id_idx" ON "budget" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "budget_account_id_idx" ON "budget" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connected_account_id_index" ON "connected_account" USING btree ("id");--> statement-breakpoint
CREATE INDEX "connected_account_book_id_idx" ON "connected_account" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "connected_account_provider_idx" ON "connected_account" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "crypto_asset_id_index" ON "crypto_asset" USING btree ("id");--> statement-breakpoint
CREATE INDEX "crypto_asset_book_id_idx" ON "crypto_asset" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "crypto_asset_symbol_idx" ON "crypto_asset" USING btree ("symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "crypto_lot_id_index" ON "crypto_lot" USING btree ("id");--> statement-breakpoint
CREATE INDEX "crypto_lot_crypto_asset_id_idx" ON "crypto_lot" USING btree ("crypto_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entry_id_index" ON "journal_entry" USING btree ("id");--> statement-breakpoint
CREATE INDEX "journal_entry_book_id_idx" ON "journal_entry" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "journal_entry_date_idx" ON "journal_entry" USING btree ("date");--> statement-breakpoint
CREATE INDEX "journal_entry_source_idx" ON "journal_entry" USING btree ("source");--> statement-breakpoint
CREATE INDEX "journal_entry_source_ref_idx" ON "journal_entry" USING btree ("source","source_reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_line_id_index" ON "journal_line" USING btree ("id");--> statement-breakpoint
CREATE INDEX "journal_line_entry_id_idx" ON "journal_line" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "journal_line_account_id_idx" ON "journal_line" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "net_worth_snapshot_id_index" ON "net_worth_snapshot" USING btree ("id");--> statement-breakpoint
CREATE INDEX "net_worth_snapshot_book_id_idx" ON "net_worth_snapshot" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "net_worth_snapshot_date_idx" ON "net_worth_snapshot" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "reconciliation_queue_id_index" ON "reconciliation_queue" USING btree ("id");--> statement-breakpoint
CREATE INDEX "reconciliation_queue_book_id_idx" ON "reconciliation_queue" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "reconciliation_queue_status_idx" ON "reconciliation_queue" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_transaction_id_index" ON "recurring_transaction" USING btree ("id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_book_id_idx" ON "recurring_transaction" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "savings_goal_id_index" ON "savings_goal" USING btree ("id");--> statement-breakpoint
CREATE INDEX "savings_goal_book_id_idx" ON "savings_goal" USING btree ("book_id");