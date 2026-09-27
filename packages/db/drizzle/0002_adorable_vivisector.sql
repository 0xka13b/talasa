ALTER TABLE "projects" ALTER COLUMN "vessel_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "news_window_days" integer;