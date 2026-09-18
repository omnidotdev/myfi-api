CREATE TABLE "rd_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"is_foreign" boolean DEFAULT false NOT NULL,
	"project_id" uuid,
	"notes" text,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "rd_expense" ADD CONSTRAINT "rd_expense_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_expense" ADD CONSTRAINT "rd_expense_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rd_expense_id_index" ON "rd_expense" USING btree ("id");--> statement-breakpoint
CREATE INDEX "rd_expense_book_id_idx" ON "rd_expense" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "rd_expense_book_year_idx" ON "rd_expense" USING btree ("book_id","year");--> statement-breakpoint
CREATE INDEX "rd_expense_project_id_idx" ON "rd_expense" USING btree ("project_id");