CREATE TABLE "fixed_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"asset_account_id" uuid NOT NULL,
	"depreciation_expense_account_id" uuid NOT NULL,
	"accumulated_depreciation_account_id" uuid NOT NULL,
	"acquisition_date" text NOT NULL,
	"acquisition_cost" numeric(19, 4) NOT NULL,
	"salvage_value" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"useful_life_months" integer NOT NULL,
	"depreciation_method" text NOT NULL,
	"macrs_class" text,
	"disposed_at" text,
	"disposal_proceeds" numeric(19, 4),
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "fixed_asset" ADD CONSTRAINT "fixed_asset_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_asset" ADD CONSTRAINT "fixed_asset_asset_account_id_account_id_fk" FOREIGN KEY ("asset_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_asset" ADD CONSTRAINT "fixed_asset_depreciation_expense_account_id_account_id_fk" FOREIGN KEY ("depreciation_expense_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_asset" ADD CONSTRAINT "fixed_asset_accumulated_depreciation_account_id_account_id_fk" FOREIGN KEY ("accumulated_depreciation_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_asset_id_index" ON "fixed_asset" USING btree ("id");--> statement-breakpoint
CREATE INDEX "fixed_asset_book_id_idx" ON "fixed_asset" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "fixed_asset_disposed_idx" ON "fixed_asset" USING btree ("disposed_at");