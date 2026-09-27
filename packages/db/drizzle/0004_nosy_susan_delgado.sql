ALTER TABLE "screenings" ADD COLUMN "name" text;--> statement-breakpoint
UPDATE "screenings" SET "name" = COALESCE("vessel_name", 'IMO ' || "imo") WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "screenings" ALTER COLUMN "name" SET NOT NULL;
