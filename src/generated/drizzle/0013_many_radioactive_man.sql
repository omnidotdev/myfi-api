CREATE TABLE "mileage_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"date" text NOT NULL,
	"description" text,
	"origin" text,
	"destination" text,
	"odometer_start" numeric(10, 1),
	"odometer_end" numeric(10, 1),
	"distance" numeric(10, 1) NOT NULL,
	"is_round_trip" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"year" integer,
	"make" text,
	"model" text,
	"date_in_service" text,
	"created_at" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "mileage_log" ADD CONSTRAINT "mileage_log_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mileage_log" ADD CONSTRAINT "mileage_log_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mileage_log_id_index" ON "mileage_log" USING btree ("id");--> statement-breakpoint
CREATE INDEX "mileage_log_book_id_idx" ON "mileage_log" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "mileage_log_vehicle_id_idx" ON "mileage_log" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "mileage_log_date_idx" ON "mileage_log" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_id_index" ON "vehicle" USING btree ("id");--> statement-breakpoint
CREATE INDEX "vehicle_book_id_idx" ON "vehicle" USING btree ("book_id");