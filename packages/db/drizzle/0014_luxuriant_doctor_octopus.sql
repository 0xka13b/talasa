CREATE TABLE "sar_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screening_id" uuid NOT NULL,
	"event_idx" integer NOT NULL,
	"palette" text NOT NULL,
	"available" boolean NOT NULL,
	"verdict" text,
	"detail" text,
	"scene_id" text,
	"scene_datetime" text,
	"coverage" real,
	"sensor" text,
	"cloud_cover" real,
	"vessel_length_m" real,
	"vessel_beam_m" real,
	"target_count" integer,
	"contact_count" integer DEFAULT 0 NOT NULL,
	"primary_summary" jsonb,
	"ais_fix" jsonb,
	"primary_target" jsonb,
	"contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_bbox" jsonb,
	"image_size" jsonb,
	"image" text,
	"processing_units" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sar_verifications" ADD CONSTRAINT "sar_verifications_screening_id_screenings_id_fk" FOREIGN KEY ("screening_id") REFERENCES "public"."screenings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sar_verifications_screening_event_palette_key" ON "sar_verifications" USING btree ("screening_id","event_idx","palette");