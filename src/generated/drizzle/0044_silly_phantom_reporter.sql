CREATE TABLE "recurring_invoice_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(19, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(19, 4) DEFAULT '0' NOT NULL,
	"income_account_id" uuid NOT NULL,
	"tax_jurisdiction_id" uuid,
	"discount_percent" numeric(9, 6),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"number_prefix" text DEFAULT 'INV-' NOT NULL,
	"frequency" text NOT NULL,
	"next_run_date" text NOT NULL,
	"due_in_days" integer DEFAULT 30 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"memo" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "recurring_invoice_line" ADD CONSTRAINT "recurring_invoice_line_recurring_invoice_id_recurring_invoice_id_fk" FOREIGN KEY ("recurring_invoice_id") REFERENCES "public"."recurring_invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_line" ADD CONSTRAINT "recurring_invoice_line_income_account_id_account_id_fk" FOREIGN KEY ("income_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_line" ADD CONSTRAINT "recurring_invoice_line_tax_jurisdiction_id_tax_jurisdiction_id_fk" FOREIGN KEY ("tax_jurisdiction_id") REFERENCES "public"."tax_jurisdiction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice" ADD CONSTRAINT "recurring_invoice_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice" ADD CONSTRAINT "recurring_invoice_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_invoice_line_id_index" ON "recurring_invoice_line" USING btree ("id");--> statement-breakpoint
CREATE INDEX "recurring_invoice_line_recurring_invoice_id_idx" ON "recurring_invoice_line" USING btree ("recurring_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_invoice_id_index" ON "recurring_invoice" USING btree ("id");--> statement-breakpoint
CREATE INDEX "recurring_invoice_book_id_idx" ON "recurring_invoice" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "recurring_invoice_customer_id_idx" ON "recurring_invoice" USING btree ("customer_id");