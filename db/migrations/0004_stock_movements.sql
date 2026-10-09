CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"hospital_id" text NOT NULL,
	"medicine_id" text NOT NULL,
	"delta" integer NOT NULL,
	"created" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stock_applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_order_idx" ON "stock_movements" USING btree ("order_id");