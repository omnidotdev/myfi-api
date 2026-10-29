CREATE TABLE "price_level" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"adjustment_percent" numeric(19, 4) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "price_level_id" uuid;--> statement-breakpoint
ALTER TABLE "price_level" ADD CONSTRAINT "price_level_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "price_level_id_index" ON "price_level" USING btree ("id");--> statement-breakpoint
CREATE INDEX "price_level_book_id_idx" ON "price_level" USING btree ("book_id");--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_price_level_id_price_level_id_fk" FOREIGN KEY ("price_level_id") REFERENCES "public"."price_level"("id") ON DELETE set null ON UPDATE no action;