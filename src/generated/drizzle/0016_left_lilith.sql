CREATE TABLE "quickbooks_account_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"qbo_account_id" text NOT NULL,
	"qbo_account_name" text,
	"qbo_account_type" text,
	"myfi_account_id" uuid NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quickbooks_migration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"connected_account_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"period_start" timestamp(6) with time zone,
	"period_end" timestamp(6) with time zone,
	"entries_imported" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "connected_account" ADD COLUMN "refresh_token" text;--> statement-breakpoint
ALTER TABLE "connected_account" ADD COLUMN "realm_id" text;--> statement-breakpoint
ALTER TABLE "quickbooks_account_map" ADD CONSTRAINT "quickbooks_account_map_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_account_map" ADD CONSTRAINT "quickbooks_account_map_myfi_account_id_account_id_fk" FOREIGN KEY ("myfi_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_migration" ADD CONSTRAINT "quickbooks_migration_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_migration" ADD CONSTRAINT "quickbooks_migration_connected_account_id_connected_account_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quickbooks_account_map_book_qbo_idx" ON "quickbooks_account_map" USING btree ("book_id","qbo_account_id");--> statement-breakpoint
CREATE INDEX "quickbooks_account_map_book_id_idx" ON "quickbooks_account_map" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quickbooks_migration_id_index" ON "quickbooks_migration" USING btree ("id");--> statement-breakpoint
CREATE INDEX "quickbooks_migration_book_id_idx" ON "quickbooks_migration" USING btree ("book_id");