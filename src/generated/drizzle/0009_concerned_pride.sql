CREATE TABLE "payroll_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"company_id" text,
	"last_synced_at" timestamp(6) with time zone,
	"sync_cursor" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "payroll_connection" ADD CONSTRAINT "payroll_connection_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_connection_id_index" ON "payroll_connection" USING btree ("id");--> statement-breakpoint
CREATE INDEX "payroll_connection_book_id_idx" ON "payroll_connection" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "payroll_connection_status_idx" ON "payroll_connection" USING btree ("status");