CREATE TABLE "form_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"document_type" text DEFAULT 'invoice' NOT NULL,
	"accent_color" text DEFAULT '#0f172a' NOT NULL,
	"footer_text" text,
	"terms" text,
	"show_logo" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "form_template" ADD CONSTRAINT "form_template_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_template_id_index" ON "form_template" USING btree ("id");--> statement-breakpoint
CREATE INDEX "form_template_book_type_idx" ON "form_template" USING btree ("book_id","document_type");