ALTER TABLE "quickbooks_account_map" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quickbooks_cutover" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quickbooks_migration" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quickbooks_reconciliation" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quickbooks_reconciliation_line" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "quickbooks_account_map" CASCADE;--> statement-breakpoint
DROP TABLE "quickbooks_cutover" CASCADE;--> statement-breakpoint
DROP TABLE "quickbooks_migration" CASCADE;--> statement-breakpoint
DROP TABLE "quickbooks_reconciliation" CASCADE;--> statement-breakpoint
DROP TABLE "quickbooks_reconciliation_line" CASCADE;--> statement-breakpoint
DROP INDEX "connected_account_book_quickbooks_idx";--> statement-breakpoint
ALTER TABLE "connected_account" DROP COLUMN "refresh_token";--> statement-breakpoint
ALTER TABLE "connected_account" DROP COLUMN "realm_id";