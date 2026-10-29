CREATE TABLE "vendor_credit_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"vendor_credit_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendor_credit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"date" text NOT NULL,
	"subtotal" numeric(19, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"total" numeric(19, 4) DEFAULT '0' NOT NULL,
	"amount_applied" numeric(19, 4) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"exchange_rate" numeric(19, 8) DEFAULT '1' NOT NULL,
	"memo" text,
	"journal_entry_id" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendor_credit_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_credit_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(19, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(19, 4) DEFAULT '0' NOT NULL,
	"amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(9, 6),
	"expense_account_id" uuid NOT NULL,
	"tax_jurisdiction_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_credit_application" ADD CONSTRAINT "vendor_credit_application_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit_application" ADD CONSTRAINT "vendor_credit_application_vendor_credit_id_vendor_credit_id_fk" FOREIGN KEY ("vendor_credit_id") REFERENCES "public"."vendor_credit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit_application" ADD CONSTRAINT "vendor_credit_application_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit" ADD CONSTRAINT "vendor_credit_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit" ADD CONSTRAINT "vendor_credit_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit" ADD CONSTRAINT "vendor_credit_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit_line" ADD CONSTRAINT "vendor_credit_line_vendor_credit_id_vendor_credit_id_fk" FOREIGN KEY ("vendor_credit_id") REFERENCES "public"."vendor_credit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit_line" ADD CONSTRAINT "vendor_credit_line_expense_account_id_account_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit_line" ADD CONSTRAINT "vendor_credit_line_tax_jurisdiction_id_tax_jurisdiction_id_fk" FOREIGN KEY ("tax_jurisdiction_id") REFERENCES "public"."tax_jurisdiction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_credit_application_id_index" ON "vendor_credit_application" USING btree ("id");--> statement-breakpoint
CREATE INDEX "vendor_credit_application_vendor_credit_id_idx" ON "vendor_credit_application" USING btree ("vendor_credit_id");--> statement-breakpoint
CREATE INDEX "vendor_credit_application_bill_id_idx" ON "vendor_credit_application" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_credit_id_index" ON "vendor_credit" USING btree ("id");--> statement-breakpoint
CREATE INDEX "vendor_credit_book_id_idx" ON "vendor_credit" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "vendor_credit_vendor_id_idx" ON "vendor_credit" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_credit_status_idx" ON "vendor_credit" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_credit_book_number_idx" ON "vendor_credit" USING btree ("book_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_credit_line_id_index" ON "vendor_credit_line" USING btree ("id");--> statement-breakpoint
CREATE INDEX "vendor_credit_line_vendor_credit_id_idx" ON "vendor_credit_line" USING btree ("vendor_credit_id");