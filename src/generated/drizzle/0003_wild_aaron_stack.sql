ALTER TABLE "book" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "connected_account" ALTER COLUMN "provider" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "connected_account" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "connected_account" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "journal_entry" ALTER COLUMN "source" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "journal_entry" ALTER COLUMN "source" SET DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "reconciliation_queue" ALTER COLUMN "status" SET DEFAULT 'pending_review';--> statement-breakpoint
DROP TYPE "public"."book_type";--> statement-breakpoint
DROP TYPE "public"."connected_account_provider";--> statement-breakpoint
DROP TYPE "public"."connected_account_status";--> statement-breakpoint
DROP TYPE "public"."journal_entry_source";--> statement-breakpoint
DROP TYPE "public"."reconciliation_status";