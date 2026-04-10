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
ALTER TABLE "amortization_entry" ADD CONSTRAINT "amortization_entry_loan_id_loan_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amortization_entry" ADD CONSTRAINT "amortization_entry_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_liability_account_id_account_id_fk" FOREIGN KEY ("liability_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_interest_account_id_account_id_fk" FOREIGN KEY ("interest_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_payment_account_id_account_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amortization_entry_id_index" ON "amortization_entry" USING btree ("id");--> statement-breakpoint
CREATE INDEX "amortization_entry_loan_id_idx" ON "amortization_entry" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "amortization_entry_status_idx" ON "amortization_entry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "amortization_entry_due_date_idx" ON "amortization_entry" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_id_index" ON "loan" USING btree ("id");--> statement-breakpoint
CREATE INDEX "loan_book_id_idx" ON "loan" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "loan_status_idx" ON "loan" USING btree ("status");