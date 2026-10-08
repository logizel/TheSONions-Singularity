ALTER TABLE "hospitals" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_latlng_check" CHECK (("hospitals"."latitude" is null or "hospitals"."latitude" between -90 and 90) and ("hospitals"."longitude" is null or "hospitals"."longitude" between -180 and 180));