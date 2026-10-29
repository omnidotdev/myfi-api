ALTER TYPE "public"."account_sub_type" ADD VALUE 'fx_gain_loss' BEFORE 'other_expense';--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "exchange_rate" numeric(19, 8) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD COLUMN "exchange_rate" numeric(19, 8) DEFAULT '1' NOT NULL;