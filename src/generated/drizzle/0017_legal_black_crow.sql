CREATE TABLE "quickbooks_reconciliation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"connected_account_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"period_start" timestamp(6) with time zone NOT NULL,
	"period_end" timestamp(6) with time zone NOT NULL,
	"total_variance" numeric(19, 4),
	"mismatch_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quickbooks_reconciliation_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"myfi_account_id" uuid,
	"qbo_account_id" text,
	"account_name" text NOT NULL,
	"qbo_balance" numeric(19, 4) DEFAULT '0' NOT NULL,
	"myfi_balance" numeric(19, 4) DEFAULT '0' NOT NULL,
	"variance" numeric(19, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "quickbooks_reconciliation" ADD CONSTRAINT "quickbooks_reconciliation_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_reconciliation" ADD CONSTRAINT "quickbooks_reconciliation_connected_account_id_connected_account_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_reconciliation_line" ADD CONSTRAINT "quickbooks_reconciliation_line_reconciliation_id_quickbooks_reconciliation_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."quickbooks_reconciliation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_reconciliation_line" ADD CONSTRAINT "quickbooks_reconciliation_line_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_reconciliation_line" ADD CONSTRAINT "quickbooks_reconciliation_line_myfi_account_id_account_id_fk" FOREIGN KEY ("myfi_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quickbooks_reconciliation_id_index" ON "quickbooks_reconciliation" USING btree ("id");--> statement-breakpoint
CREATE INDEX "quickbooks_reconciliation_book_id_idx" ON "quickbooks_reconciliation" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quickbooks_reconciliation_line_id_index" ON "quickbooks_reconciliation_line" USING btree ("id");--> statement-breakpoint
CREATE INDEX "quickbooks_reconciliation_line_recon_id_idx" ON "quickbooks_reconciliation_line" USING btree ("reconciliation_id");--> statement-breakpoint
CREATE INDEX "quickbooks_reconciliation_line_book_id_idx" ON "quickbooks_reconciliation_line" USING btree ("book_id");