CREATE TABLE "monitor_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"monitor_run_id" uuid NOT NULL,
	"imo" text NOT NULL,
	"vessel_name" text,
	"screening_id" uuid,
	"previous_screening_id" uuid,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"escalation" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"screening_count" integer DEFAULT 0 NOT NULL,
	"changed_count" integer DEFAULT 0 NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"target_kind" text NOT NULL,
	"imo" text,
	"batch_id" uuid,
	"cadence" text NOT NULL,
	"time_of_day" text DEFAULT '06:00' NOT NULL,
	"checks" jsonb DEFAULT '["sanctions"]'::jsonb NOT NULL,
	"notify_mode" text DEFAULT 'all_changes' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "screenings" ADD COLUMN "monitor_id" uuid;--> statement-breakpoint
ALTER TABLE "screenings" ADD COLUMN "monitor_run_id" uuid;--> statement-breakpoint
ALTER TABLE "screenings" ADD COLUMN "watch_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "screenings" ADD COLUMN "watch_hash" text;--> statement-breakpoint
ALTER TABLE "monitor_changes" ADD CONSTRAINT "monitor_changes_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_changes" ADD CONSTRAINT "monitor_changes_monitor_run_id_monitor_runs_id_fk" FOREIGN KEY ("monitor_run_id") REFERENCES "public"."monitor_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_changes" ADD CONSTRAINT "monitor_changes_screening_id_screenings_id_fk" FOREIGN KEY ("screening_id") REFERENCES "public"."screenings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_changes" ADD CONSTRAINT "monitor_changes_previous_screening_id_screenings_id_fk" FOREIGN KEY ("previous_screening_id") REFERENCES "public"."screenings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_runs" ADD CONSTRAINT "monitor_runs_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_monitor_run_id_monitor_runs_id_fk" FOREIGN KEY ("monitor_run_id") REFERENCES "public"."monitor_runs"("id") ON DELETE set null ON UPDATE no action;