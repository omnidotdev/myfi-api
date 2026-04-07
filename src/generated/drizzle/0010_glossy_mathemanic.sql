CREATE TABLE "book_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"invited_by" text,
	"invited_at" timestamp(6) with time zone DEFAULT now(),
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "book_access" ADD CONSTRAINT "book_access_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_access_id_index" ON "book_access" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "book_access_book_user_idx" ON "book_access" USING btree ("book_id","user_id");--> statement-breakpoint
CREATE INDEX "book_access_user_id_idx" ON "book_access" USING btree ("user_id");