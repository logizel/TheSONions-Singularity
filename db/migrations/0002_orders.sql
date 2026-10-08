CREATE TABLE "order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"medicine_id" text NOT NULL,
	"qty" double precision NOT NULL,
	"suggested_qty" double precision NOT NULL,
	"idempotency_key" text NOT NULL,
	"checks_passed" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "order_lines_qty_check" CHECK ("order_lines"."qty" > 0 and "order_lines"."qty" <= "order_lines"."suggested_qty")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"from_hospital" text NOT NULL,
	"to_hospital" text NOT NULL,
	"status" text DEFAULT 'accepted' NOT NULL,
	"transport_days" integer NOT NULL,
	"as_of" date NOT NULL,
	"suggested_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"packed_at" timestamp with time zone,
	"in_transit_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" in ('accepted','packed','in_transit','delivered','cancelled')),
	CONSTRAINT "orders_lane_check" CHECK ("orders"."from_hospital" <> "orders"."to_hospital"),
	CONSTRAINT "orders_transport_days_check" CHECK ("orders"."transport_days" >= 0 and "orders"."transport_days" <= 30)
);
--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_from_hospital_hospitals_id_fk" FOREIGN KEY ("from_hospital") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_to_hospital_hospitals_id_fk" FOREIGN KEY ("to_hospital") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_lines_idempotency_key_uq" ON "order_lines" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "order_lines_order_idx" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key_uq" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_lane_idx" ON "orders" USING btree ("from_hospital","to_hospital");