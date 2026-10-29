CREATE TABLE "tracking_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journal_line_tracking_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_line_id" uuid NOT NULL,
	"tracking_category_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracking_category" ADD CONSTRAINT "tracking_category_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line_tracking_category" ADD CONSTRAINT "journal_line_tracking_category_journal_line_id_journal_line_id_fk" FOREIGN KEY ("journal_line_id") REFERENCES "public"."journal_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line_tracking_category" ADD CONSTRAINT "journal_line_tracking_category_tracking_category_id_tracking_category_id_fk" FOREIGN KEY ("tracking_category_id") REFERENCES "public"."tracking_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_category_id_index" ON "tracking_category" USING btree ("id");--> statement-breakpoint
CREATE INDEX "tracking_category_book_id_idx" ON "tracking_category" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "tracking_category_book_kind_idx" ON "tracking_category" USING btree ("book_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_line_tracking_category_id_index" ON "journal_line_tracking_category" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_line_tracking_category_line_cat_idx" ON "journal_line_tracking_category" USING btree ("journal_line_id","tracking_category_id");--> statement-breakpoint
CREATE INDEX "journal_line_tracking_category_cat_id_idx" ON "journal_line_tracking_category" USING btree ("tracking_category_id");