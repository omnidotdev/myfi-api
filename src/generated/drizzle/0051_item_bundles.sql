CREATE TABLE "item_bundle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bundle_component" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity" numeric(19, 4) DEFAULT '1' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_bundle" ADD CONSTRAINT "item_bundle_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_component" ADD CONSTRAINT "bundle_component_bundle_id_item_bundle_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."item_bundle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_component" ADD CONSTRAINT "bundle_component_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "item_bundle_id_index" ON "item_bundle" USING btree ("id");--> statement-breakpoint
CREATE INDEX "item_bundle_book_id_idx" ON "item_bundle" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bundle_component_id_index" ON "bundle_component" USING btree ("id");--> statement-breakpoint
CREATE INDEX "bundle_component_bundle_id_idx" ON "bundle_component" USING btree ("bundle_id");