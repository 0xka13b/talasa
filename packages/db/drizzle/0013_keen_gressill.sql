ALTER TABLE "batches" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;