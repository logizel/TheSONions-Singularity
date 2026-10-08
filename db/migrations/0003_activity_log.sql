CREATE TABLE "activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_role" text NOT NULL,
	"actor_hospital" text,
	"action" text NOT NULL,
	"order_id" text,
	"hospital_ids" text[] DEFAULT '{}' NOT NULL,
	"summary" text NOT NULL,
	CONSTRAINT "activity_log_role_check" CHECK ("activity_log"."actor_role" in ('hospital_admin','network_admin'))
);
--> statement-breakpoint
CREATE INDEX "activity_log_at_idx" ON "activity_log" USING btree ("at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_log_hospitals_idx" ON "activity_log" USING gin ("hospital_ids");