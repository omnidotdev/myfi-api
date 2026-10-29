CREATE TABLE "custom_field_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"value" text,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_field_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text DEFAULT 'text' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "custom_field_value" ADD CONSTRAINT "custom_field_value_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_value" ADD CONSTRAINT "custom_field_value_definition_id_custom_field_definition_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."custom_field_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definition" ADD CONSTRAINT "custom_field_definition_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_value_id_index" ON "custom_field_value" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_value_def_entity_idx" ON "custom_field_value" USING btree ("definition_id","entity_id");--> statement-breakpoint
CREATE INDEX "custom_field_value_entity_idx" ON "custom_field_value" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "custom_field_value_book_id_idx" ON "custom_field_value" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_definition_id_index" ON "custom_field_definition" USING btree ("id");--> statement-breakpoint
CREATE INDEX "custom_field_definition_book_entity_idx" ON "custom_field_definition" USING btree ("book_id","entity_type");