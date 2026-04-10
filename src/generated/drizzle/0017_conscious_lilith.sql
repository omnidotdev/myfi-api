CREATE TABLE "journal_line_project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_line_id" uuid NOT NULL,
	"project_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"status" text DEFAULT 'active' NOT NULL,
	"budget_amount" numeric(19, 4),
	"start_date" timestamp(6) with time zone,
	"end_date" timestamp(6) with time zone,
	"notes" text,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "categorization_rule_split" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "journal_line_project" ADD CONSTRAINT "journal_line_project_journal_line_id_journal_line_id_fk" FOREIGN KEY ("journal_line_id") REFERENCES "public"."journal_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line_project" ADD CONSTRAINT "journal_line_project_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "journal_line_project_id_index" ON "journal_line_project" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_line_project_line_project_idx" ON "journal_line_project" USING btree ("journal_line_id","project_id");--> statement-breakpoint
CREATE INDEX "journal_line_project_project_id_idx" ON "journal_line_project" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_id_index" ON "project" USING btree ("id");--> statement-breakpoint
CREATE INDEX "project_book_id_idx" ON "project" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "project_status_idx" ON "project" USING btree ("status");--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD CONSTRAINT "categorization_rule_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule_split" ADD CONSTRAINT "categorization_rule_split_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;