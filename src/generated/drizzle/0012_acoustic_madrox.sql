CREATE TABLE "reconciliation_statement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"statement_date" text NOT NULL,
	"statement_balance" numeric(19, 4) NOT NULL,
	"beginning_balance" numeric(19, 4) NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"completed_at" timestamp(6) with time zone,
	"discrepancy" numeric(19, 4),
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "journal_line" ADD COLUMN "cleared" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reconciliation_statement" ADD CONSTRAINT "reconciliation_statement_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_statement" ADD CONSTRAINT "reconciliation_statement_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reconciliation_statement_id_index" ON "reconciliation_statement" USING btree ("id");--> statement-breakpoint
CREATE INDEX "recon_stmt_book_id_idx" ON "reconciliation_statement" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "recon_stmt_account_id_idx" ON "reconciliation_statement" USING btree ("account_id");