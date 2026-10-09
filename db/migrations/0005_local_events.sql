CREATE TABLE "local_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"radius_km" double precision NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"severity" integer NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"note" text,
	CONSTRAINT "local_events_type_check" CHECK ("local_events"."type" in ('flood','heatwave','cyclone','earthquake','epidemic','festival','other')),
	CONSTRAINT "local_events_source_check" CHECK ("local_events"."source" in ('manual','feed')),
	CONSTRAINT "local_events_severity_check" CHECK ("local_events"."severity" between 1 and 3),
	CONSTRAINT "local_events_radius_check" CHECK ("local_events"."radius_km" > 0 and "local_events"."radius_km" <= 200),
	CONSTRAINT "local_events_dates_check" CHECK ("local_events"."ends_on" >= "local_events"."starts_on"),
	CONSTRAINT "local_events_latlng_check" CHECK ("local_events"."latitude" between -90 and 90 and "local_events"."longitude" between -180 and 180)
);
--> statement-breakpoint
CREATE INDEX "local_events_ends_on_idx" ON "local_events" USING btree ("ends_on");