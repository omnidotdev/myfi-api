CREATE TABLE "bill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"bill_date" text NOT NULL,
	"due_date" text NOT NULL,
	"subtotal" numeric(19, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"total" numeric(19, 4) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(19, 4) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"memo" text,
	"journal_entry_id" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bill_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(19, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(19, 4) DEFAULT '0' NOT NULL,
	"amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"expense_account_id" uuid NOT NULL,
	"tax_jurisdiction_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"date" text NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"payment_account_id" uuid NOT NULL,
	"method" text,
	"reference" text,
	"journal_entry_id" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_line" ADD CONSTRAINT "bill_line_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_line" ADD CONSTRAINT "bill_line_expense_account_id_account_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_line" ADD CONSTRAINT "bill_line_tax_jurisdiction_id_tax_jurisdiction_id_fk" FOREIGN KEY ("tax_jurisdiction_id") REFERENCES "public"."tax_jurisdiction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payment" ADD CONSTRAINT "bill_payment_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payment" ADD CONSTRAINT "bill_payment_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payment" ADD CONSTRAINT "bill_payment_payment_account_id_account_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payment" ADD CONSTRAINT "bill_payment_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_id_index" ON "bill" USING btree ("id");--> statement-breakpoint
CREATE INDEX "bill_book_id_idx" ON "bill" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "bill_vendor_id_idx" ON "bill" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "bill_status_idx" ON "bill" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_book_number_idx" ON "bill" USING btree ("book_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_line_id_index" ON "bill_line" USING btree ("id");--> statement-breakpoint
CREATE INDEX "bill_line_bill_id_idx" ON "bill_line" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_payment_id_index" ON "bill_payment" USING btree ("id");--> statement-breakpoint
CREATE INDEX "bill_payment_book_id_idx" ON "bill_payment" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "bill_payment_bill_id_idx" ON "bill_payment" USING btree ("bill_id");