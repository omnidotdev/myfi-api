ALTER TABLE "bill_payment" ADD COLUMN "exchange_rate" numeric(19, 8) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "exchange_rate" numeric(19, 8) DEFAULT '1' NOT NULL;