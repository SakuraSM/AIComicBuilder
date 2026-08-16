ALTER TABLE "shots" ADD COLUMN "is_locked" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "quality_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "quality_notes" text DEFAULT '';