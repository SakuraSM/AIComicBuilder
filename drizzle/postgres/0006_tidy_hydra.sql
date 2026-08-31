ALTER TABLE "free_creations" ADD COLUMN "task_id" text;--> statement-breakpoint
CREATE INDEX "free_creations_task_idx" ON "free_creations" USING btree ("task_id");