ALTER TYPE "public"."account_sub_type" ADD VALUE 'undeposited_funds' BEFORE 'accounts_receivable';--> statement-breakpoint
CREATE TABLE "bank_deposit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"date" text NOT NULL,
	"status" text DEFAULT 'recorded' NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"memo" text,
	"total" numeric(19, 4) NOT NULL,
	"journal_entry_id" uuid,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD COLUMN "bank_deposit_id" uuid;--> statement-breakpoint
ALTER TABLE "bank_deposit" ADD CONSTRAINT "bank_deposit_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_deposit" ADD CONSTRAINT "bank_deposit_bank_account_id_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_deposit" ADD CONSTRAINT "bank_deposit_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_deposit_id_index" ON "bank_deposit" USING btree ("id");--> statement-breakpoint
CREATE INDEX "bank_deposit_book_id_idx" ON "bank_deposit" USING btree ("book_id");--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_bank_deposit_id_bank_deposit_id_fk" FOREIGN KEY ("bank_deposit_id") REFERENCES "public"."bank_deposit"("id") ON DELETE set null ON UPDATE no action;