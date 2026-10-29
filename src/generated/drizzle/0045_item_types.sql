ALTER TABLE "inventory_item" ALTER COLUMN "asset_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_item" ALTER COLUMN "cogs_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD COLUMN "item_type" text DEFAULT 'inventory' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD COLUMN "reorder_point" numeric(19, 4);