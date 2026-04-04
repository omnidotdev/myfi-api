CREATE TABLE "accounting_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp(6) with time zone,
	"closed_by" text,
	"reopened_at" timestamp(6) with time zone,
	"blockers" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categorization_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"match_field" text NOT NULL,
	"match_type" text NOT NULL,
	"match_value" text NOT NULL,
	"amount_min" numeric(19, 4),
	"amount_max" numeric(19, 4),
	"debit_account_id" uuid NOT NULL,
	"credit_account_id" uuid NOT NULL,
	"confidence" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ADD COLUMN "categorization_source" text;--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ADD COLUMN "confidence" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ADD COLUMN "suggested_debit_account_id" uuid;--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ADD COLUMN "suggested_credit_account_id" uuid;--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ADD COLUMN "period_year" integer;--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ADD COLUMN "period_month" integer;--> statement-breakpoint
ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD CONSTRAINT "categorization_rule_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD CONSTRAINT "categorization_rule_debit_account_id_account_id_fk" FOREIGN KEY ("debit_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD CONSTRAINT "categorization_rule_credit_account_id_account_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_period_id_index" ON "accounting_period" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_period_book_year_month_idx" ON "accounting_period" USING btree ("book_id","year","month");--> statement-breakpoint
CREATE INDEX "accounting_period_status_idx" ON "accounting_period" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "categorization_rule_id_index" ON "categorization_rule" USING btree ("id");--> statement-breakpoint
CREATE INDEX "categorization_rule_book_id_idx" ON "categorization_rule" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "categorization_rule_match_field_idx" ON "categorization_rule" USING btree ("book_id","match_field");--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ADD CONSTRAINT "reconciliation_queue_suggested_debit_account_id_account_id_fk" FOREIGN KEY ("suggested_debit_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ADD CONSTRAINT "reconciliation_queue_suggested_credit_account_id_account_id_fk" FOREIGN KEY ("suggested_credit_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;