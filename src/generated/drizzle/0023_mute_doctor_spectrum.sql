CREATE TABLE "estimate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"estimate_date" text NOT NULL,
	"expiry_date" text,
	"subtotal" numeric(19, 4) DEFAULT '0' NOT NULL,
	"total" numeric(19, 4) DEFAULT '0' NOT NULL,
	"memo" text,
	"terms" text,
	"converted_invoice_id" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "estimate_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estimate_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(19, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(19, 4) DEFAULT '0' NOT NULL,
	"amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"income_account_id" uuid NOT NULL,
	"tax_jurisdiction_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_converted_invoice_id_invoice_id_fk" FOREIGN KEY ("converted_invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_line" ADD CONSTRAINT "estimate_line_estimate_id_estimate_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_line" ADD CONSTRAINT "estimate_line_income_account_id_account_id_fk" FOREIGN KEY ("income_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_line" ADD CONSTRAINT "estimate_line_tax_jurisdiction_id_tax_jurisdiction_id_fk" FOREIGN KEY ("tax_jurisdiction_id") REFERENCES "public"."tax_jurisdiction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "estimate_id_index" ON "estimate" USING btree ("id");--> statement-breakpoint
CREATE INDEX "estimate_book_id_idx" ON "estimate" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "estimate_customer_id_idx" ON "estimate" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "estimate_status_idx" ON "estimate" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "estimate_book_number_idx" ON "estimate" USING btree ("book_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "estimate_line_id_index" ON "estimate_line" USING btree ("id");--> statement-breakpoint
CREATE INDEX "estimate_line_estimate_id_idx" ON "estimate_line" USING btree ("estimate_id");