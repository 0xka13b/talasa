ALTER TABLE "projects" ADD COLUMN "resolved" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "steps" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "progress" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "model_meta" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "finished_at" timestamp with time zone;