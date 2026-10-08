CREATE TABLE "daily_usage" (
	"usage_date" date NOT NULL,
	"hospital_id" text NOT NULL,
	"medicine_id" text NOT NULL,
	"used_qty" integer,
	"patient_load" integer NOT NULL,
	"emergency_pct" integer NOT NULL,
	CONSTRAINT "daily_usage_usage_date_hospital_id_medicine_id_pk" PRIMARY KEY("usage_date","hospital_id","medicine_id"),
	CONSTRAINT "daily_usage_pct_check" CHECK ("daily_usage"."emergency_pct" >= 0 and "daily_usage"."emergency_pct" <= 100),
	CONSTRAINT "daily_usage_qty_check" CHECK ("daily_usage"."used_qty" is null or "daily_usage"."used_qty" >= 0),
	CONSTRAINT "daily_usage_load_check" CHECK ("daily_usage"."patient_load" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hospitals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicines" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"is_critical" boolean DEFAULT false NOT NULL,
	"base_unit" text NOT NULL,
	"substitute_ids" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"medicine_id" text NOT NULL,
	"qty" integer NOT NULL,
	"expiry_date" date NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"buffer_days" integer DEFAULT 7 NOT NULL,
	CONSTRAINT "stock_batches_qty_check" CHECK ("stock_batches"."qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "supplier_leads" (
	"hospital_id" text NOT NULL,
	"medicine_id" text NOT NULL,
	"lead_days" integer NOT NULL,
	CONSTRAINT "supplier_leads_hospital_id_medicine_id_pk" PRIMARY KEY("hospital_id","medicine_id"),
	CONSTRAINT "supplier_leads_check" CHECK ("supplier_leads"."lead_days" >= 0 and "supplier_leads"."lead_days" <= 30)
);
--> statement-breakpoint
CREATE TABLE "transport_days" (
	"from_hospital" text NOT NULL,
	"to_hospital" text NOT NULL,
	"days" integer NOT NULL,
	CONSTRAINT "transport_days_from_hospital_to_hospital_pk" PRIMARY KEY("from_hospital","to_hospital"),
	CONSTRAINT "transport_days_check" CHECK ("transport_days"."days" >= 0 and "transport_days"."days" <= 30)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"hospital_id" text,
	"role" text NOT NULL,
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('hospital_admin','network_admin'))
);
--> statement-breakpoint
ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_leads" ADD CONSTRAINT "supplier_leads_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_leads" ADD CONSTRAINT "supplier_leads_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_days" ADD CONSTRAINT "transport_days_from_hospital_hospitals_id_fk" FOREIGN KEY ("from_hospital") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_days" ADD CONSTRAINT "transport_days_to_hospital_hospitals_id_fk" FOREIGN KEY ("to_hospital") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;