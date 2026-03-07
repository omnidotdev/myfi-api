ALTER TYPE "public"."connected_account_provider" ADD VALUE 'ofx_direct' BEFORE 'manual';--> statement-breakpoint
ALTER TYPE "public"."journal_entry_source" ADD VALUE 'csv_import' BEFORE 'crypto_sync';--> statement-breakpoint
ALTER TYPE "public"."journal_entry_source" ADD VALUE 'ofx_import' BEFORE 'crypto_sync';