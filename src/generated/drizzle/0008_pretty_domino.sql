CREATE TABLE "tax_jurisdiction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"filing_frequency" text NOT NULL,
	"tax_payable_account_id" uuid NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tax_jurisdiction" ADD CONSTRAINT "tax_jurisdiction_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_jurisdiction" ADD CONSTRAINT "tax_jurisdiction_tax_payable_account_id_account_id_fk" FOREIGN KEY ("tax_payable_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_jurisdiction_id_index" ON "tax_jurisdiction" USING btree ("id");--> statement-breakpoint
CREATE INDEX "tax_jurisdiction_book_id_idx" ON "tax_jurisdiction" USING btree ("book_id");