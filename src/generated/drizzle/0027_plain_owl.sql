CREATE TABLE "amortization_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"due_date" text NOT NULL,
	"payment_amount" numeric(19, 4) NOT NULL,
	"principal_amount" numeric(19, 4) NOT NULL,
	"interest_amount" numeric(19, 4) NOT NULL,
	"extra_principal" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"balance_after" numeric(19, 4) NOT NULL,
	"journal_entry_id" uuid,
	"status" text DEFAULT 'scheduled' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"journal_entry_id" uuid,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"upload_status" text DEFAULT 'pending' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categorization_rule_split" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"side" text NOT NULL,
	"percentage" numeric(7, 4),
	"fixed_amount" numeric(19, 4),
	"memo" text,
	"tag_id" uuid,
	"project_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_line_project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_line_id" uuid NOT NULL,
	"project_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"liability_account_id" uuid NOT NULL,
	"interest_account_id" uuid NOT NULL,
	"payment_account_id" uuid NOT NULL,
	"original_principal" numeric(19, 4) NOT NULL,
	"annual_rate" numeric(7, 4) NOT NULL,
	"term_months" integer NOT NULL,
	"start_date" text NOT NULL,
	"payment_day" integer NOT NULL,
	"payment_amount" numeric(19, 4),
	"extra_principal" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"status" text DEFAULT 'active' NOT NULL,
	"budget_amount" numeric(19, 4),
	"start_date" timestamp(6) with time zone,
	"end_date" timestamp(6) with time zone,
	"notes" text,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "amortization_entry" ADD CONSTRAINT "amortization_entry_loan_id_loan_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amortization_entry" ADD CONSTRAINT "amortization_entry_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule_split" ADD CONSTRAINT "categorization_rule_split_rule_id_categorization_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."categorization_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule_split" ADD CONSTRAINT "categorization_rule_split_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule_split" ADD CONSTRAINT "categorization_rule_split_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule_split" ADD CONSTRAINT "categorization_rule_split_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line_project" ADD CONSTRAINT "journal_line_project_journal_line_id_journal_line_id_fk" FOREIGN KEY ("journal_line_id") REFERENCES "public"."journal_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line_project" ADD CONSTRAINT "journal_line_project_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_liability_account_id_account_id_fk" FOREIGN KEY ("liability_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_interest_account_id_account_id_fk" FOREIGN KEY ("interest_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_payment_account_id_account_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amortization_entry_id_index" ON "amortization_entry" USING btree ("id");--> statement-breakpoint
CREATE INDEX "amortization_entry_loan_id_idx" ON "amortization_entry" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "amortization_entry_status_idx" ON "amortization_entry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "amortization_entry_due_date_idx" ON "amortization_entry" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "attachment_id_index" ON "attachment" USING btree ("id");--> statement-breakpoint
CREATE INDEX "attachment_book_id_idx" ON "attachment" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "attachment_journal_entry_id_idx" ON "attachment" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "attachment_upload_status_idx" ON "attachment" USING btree ("upload_status");--> statement-breakpoint
CREATE UNIQUE INDEX "categorization_rule_split_id_index" ON "categorization_rule_split" USING btree ("id");--> statement-breakpoint
CREATE INDEX "cat_rule_split_rule_id_idx" ON "categorization_rule_split" USING btree ("rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_line_project_id_index" ON "journal_line_project" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_line_project_line_project_idx" ON "journal_line_project" USING btree ("journal_line_id","project_id");--> statement-breakpoint
CREATE INDEX "journal_line_project_project_id_idx" ON "journal_line_project" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_id_index" ON "loan" USING btree ("id");--> statement-breakpoint
CREATE INDEX "loan_book_id_idx" ON "loan" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "loan_status_idx" ON "loan" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "project_id_index" ON "project" USING btree ("id");--> statement-breakpoint
CREATE INDEX "project_book_id_idx" ON "project" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "project_status_idx" ON "project" USING btree ("status");--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD CONSTRAINT "categorization_rule_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;