CREATE TABLE "inventory_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"sale_price" numeric(19, 4) DEFAULT '0' NOT NULL,
	"quantity_on_hand" numeric(19, 4) DEFAULT '0' NOT NULL,
	"average_cost" numeric(19, 4) DEFAULT '0' NOT NULL,
	"asset_account_id" uuid NOT NULL,
	"cogs_account_id" uuid NOT NULL,
	"income_account_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"date" text NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(19, 4) NOT NULL,
	"unit_cost" numeric(19, 4) DEFAULT '0' NOT NULL,
	"note" text,
	"journal_entry_id" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_asset_account_id_account_id_fk" FOREIGN KEY ("asset_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_cogs_account_id_account_id_fk" FOREIGN KEY ("cogs_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_income_account_id_account_id_fk" FOREIGN KEY ("income_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transaction" ADD CONSTRAINT "inventory_transaction_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transaction" ADD CONSTRAINT "inventory_transaction_item_id_inventory_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transaction" ADD CONSTRAINT "inventory_transaction_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_item_id_index" ON "inventory_item" USING btree ("id");--> statement-breakpoint
CREATE INDEX "inventory_item_book_id_idx" ON "inventory_item" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_transaction_id_index" ON "inventory_transaction" USING btree ("id");--> statement-breakpoint
CREATE INDEX "inventory_transaction_book_id_idx" ON "inventory_transaction" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "inventory_transaction_item_id_idx" ON "inventory_transaction" USING btree ("item_id");