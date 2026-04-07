CREATE TABLE "vendor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"business_name" text,
	"tax_id_type" text,
	"tax_id" text,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"email" text,
	"is_1099_eligible" boolean DEFAULT true NOT NULL,
	"threshold" numeric(19, 4),
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "journal_entry" ADD COLUMN "vendor_id" uuid;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_id_index" ON "vendor" USING btree ("id");--> statement-breakpoint
CREATE INDEX "vendor_book_id_idx" ON "vendor" USING btree ("book_id");--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE set null ON UPDATE no action;