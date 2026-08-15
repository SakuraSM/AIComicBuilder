CREATE TABLE "generation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"episode_id" text,
	"user_id" text NOT NULL,
	"mode" text DEFAULT 'guided' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_stage" text DEFAULT 'preflight' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"estimated_cost" text,
	"actual_cost" text,
	"model_profile_id" text,
	"config" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"capability" text NOT NULL,
	"protocol" text NOT NULL,
	"base_url" text NOT NULL,
	"model_id" text NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "run_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "stage" text DEFAULT 'generation' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "error_code" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "lease_owner" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "lease_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "heartbeat_at" timestamp;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "cancel_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_model_profile_id_model_profiles_id_fk" FOREIGN KEY ("model_profile_id") REFERENCES "public"."model_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_profiles" ADD CONSTRAINT "model_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_runs_project_created_idx" ON "generation_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "generation_runs_owner_status_idx" ON "generation_runs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "model_profiles_owner_capability_idx" ON "model_profiles" USING btree ("user_id","capability");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_idempotency_idx" ON "tasks" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "tasks_run_status_idx" ON "tasks" USING btree ("run_id","status");--> statement-breakpoint
CREATE INDEX "tasks_queue_idx" ON "tasks" USING btree ("status","scheduled_at");
