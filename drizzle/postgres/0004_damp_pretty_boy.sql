DROP INDEX "tasks_run_status_idx";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "stage_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "tasks_run_status_idx" ON "tasks" USING btree ("run_id","stage_order","status");