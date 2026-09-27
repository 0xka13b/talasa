CREATE TABLE "screenings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imo" text NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"vessel_name" text,
	"flag" text,
	"identity" jsonb,
	"graph" jsonb,
	"brief" jsonb,
	"steps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"progress" jsonb,
	"model_meta" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;