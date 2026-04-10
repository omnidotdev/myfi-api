CREATE TABLE "attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"journal_entry_id" uuid,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"upload_status" text DEFAULT 'pending' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attachment_id_index" ON "attachment" USING btree ("id");--> statement-breakpoint
CREATE INDEX "attachment_book_id_idx" ON "attachment" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "attachment_journal_entry_id_idx" ON "attachment" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "attachment_upload_status_idx" ON "attachment" USING btree ("upload_status");