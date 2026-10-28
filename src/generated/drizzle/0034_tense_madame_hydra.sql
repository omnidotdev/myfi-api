CREATE TABLE "credit_memo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"date" text NOT NULL,
	"subtotal" numeric(19, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"total" numeric(19, 4) DEFAULT '0' NOT NULL,
	"amount_applied" numeric(19, 4) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"memo" text,
	"journal_entry_id" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_memo_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"credit_memo_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_memo_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_memo_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(19, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(19, 4) DEFAULT '0' NOT NULL,
	"amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(9, 6),
	"income_account_id" uuid NOT NULL,
	"tax_jurisdiction_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_memo" ADD CONSTRAINT "credit_memo_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_memo" ADD CONSTRAINT "credit_memo_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_memo" ADD CONSTRAINT "credit_memo_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_memo_application" ADD CONSTRAINT "credit_memo_application_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_memo_application" ADD CONSTRAINT "credit_memo_application_credit_memo_id_credit_memo_id_fk" FOREIGN KEY ("credit_memo_id") REFERENCES "public"."credit_memo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_memo_application" ADD CONSTRAINT "credit_memo_application_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_memo_line" ADD CONSTRAINT "credit_memo_line_credit_memo_id_credit_memo_id_fk" FOREIGN KEY ("credit_memo_id") REFERENCES "public"."credit_memo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_memo_line" ADD CONSTRAINT "credit_memo_line_income_account_id_account_id_fk" FOREIGN KEY ("income_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_memo_line" ADD CONSTRAINT "credit_memo_line_tax_jurisdiction_id_tax_jurisdiction_id_fk" FOREIGN KEY ("tax_jurisdiction_id") REFERENCES "public"."tax_jurisdiction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_memo_id_index" ON "credit_memo" USING btree ("id");--> statement-breakpoint
CREATE INDEX "credit_memo_book_id_idx" ON "credit_memo" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "credit_memo_customer_id_idx" ON "credit_memo" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "credit_memo_status_idx" ON "credit_memo" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_memo_book_number_idx" ON "credit_memo" USING btree ("book_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_memo_application_id_index" ON "credit_memo_application" USING btree ("id");--> statement-breakpoint
CREATE INDEX "credit_memo_application_credit_memo_id_idx" ON "credit_memo_application" USING btree ("credit_memo_id");--> statement-breakpoint
CREATE INDEX "credit_memo_application_invoice_id_idx" ON "credit_memo_application" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_memo_line_id_index" ON "credit_memo_line" USING btree ("id");--> statement-breakpoint
CREATE INDEX "credit_memo_line_credit_memo_id_idx" ON "credit_memo_line" USING btree ("credit_memo_id");