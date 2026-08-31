DROP INDEX "journal_entry_source_ref_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entry_source_ref_idx" ON "journal_entry" USING btree ("book_id","source","source_reference_id");