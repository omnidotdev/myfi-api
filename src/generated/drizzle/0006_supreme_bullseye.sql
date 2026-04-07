CREATE TABLE "journal_line_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_line_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tag_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD COLUMN "tag_id" uuid;--> statement-breakpoint
ALTER TABLE "journal_line_tag" ADD CONSTRAINT "journal_line_tag_journal_line_id_journal_line_id_fk" FOREIGN KEY ("journal_line_id") REFERENCES "public"."journal_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line_tag" ADD CONSTRAINT "journal_line_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_tag_group_id_tag_group_id_fk" FOREIGN KEY ("tag_group_id") REFERENCES "public"."tag_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_group" ADD CONSTRAINT "tag_group_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "journal_line_tag_id_index" ON "journal_line_tag" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_line_tag_line_tag_idx" ON "journal_line_tag" USING btree ("journal_line_id","tag_id");--> statement-breakpoint
CREATE INDEX "journal_line_tag_tag_id_idx" ON "journal_line_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_id_index" ON "tag" USING btree ("id");--> statement-breakpoint
CREATE INDEX "tag_tag_group_id_idx" ON "tag" USING btree ("tag_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_group_id_index" ON "tag_group" USING btree ("id");--> statement-breakpoint
CREATE INDEX "tag_group_book_id_idx" ON "tag_group" USING btree ("book_id");--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD CONSTRAINT "categorization_rule_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE no action ON UPDATE no action;