CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"name" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"vendor_id" uuid,
	"year" integer,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_id_index" ON "document" USING btree ("id");--> statement-breakpoint
CREATE INDEX "document_book_id_idx" ON "document" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "document_category_idx" ON "document" USING btree ("book_id","category");--> statement-breakpoint
CREATE INDEX "document_vendor_id_idx" ON "document" USING btree ("vendor_id");