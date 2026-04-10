CREATE TABLE "categorization_rule_split" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"side" text NOT NULL,
	"percentage" numeric(7, 4),
	"fixed_amount" numeric(19, 4),
	"memo" text,
	"tag_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categorization_rule_split" ADD CONSTRAINT "categorization_rule_split_rule_id_categorization_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."categorization_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule_split" ADD CONSTRAINT "categorization_rule_split_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule_split" ADD CONSTRAINT "categorization_rule_split_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categorization_rule_split_id_index" ON "categorization_rule_split" USING btree ("id");--> statement-breakpoint
CREATE INDEX "cat_rule_split_rule_id_idx" ON "categorization_rule_split" USING btree ("rule_id");