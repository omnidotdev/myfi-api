CREATE TABLE "quickbooks_cutover" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"connected_account_id" uuid NOT NULL,
	"reconciliation_id" uuid NOT NULL,
	"cutover_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "quickbooks_cutover" ADD CONSTRAINT "quickbooks_cutover_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_cutover" ADD CONSTRAINT "quickbooks_cutover_connected_account_id_connected_account_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_cutover" ADD CONSTRAINT "quickbooks_cutover_reconciliation_id_quickbooks_reconciliation_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."quickbooks_reconciliation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quickbooks_cutover_book_id_idx" ON "quickbooks_cutover" USING btree ("book_id");