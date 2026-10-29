CREATE TABLE "time_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"customer_id" uuid,
	"service_item_id" uuid,
	"date" text NOT NULL,
	"hours" numeric(19, 4) DEFAULT '0' NOT NULL,
	"rate" numeric(19, 4) DEFAULT '0' NOT NULL,
	"description" text,
	"billable" boolean DEFAULT true NOT NULL,
	"invoice_id" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_service_item_id_inventory_item_id_fk" FOREIGN KEY ("service_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "time_entry_id_index" ON "time_entry" USING btree ("id");--> statement-breakpoint
CREATE INDEX "time_entry_book_id_idx" ON "time_entry" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "time_entry_customer_id_idx" ON "time_entry" USING btree ("customer_id");