CREATE TABLE "free_creations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"model_profile_id" text,
	"mode" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"prompt" text NOT NULL,
	"model_id" text NOT NULL,
	"protocol" text NOT NULL,
	"video_url" text,
	"last_frame_url" text,
	"config" jsonb,
	"error" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "free_creations" ADD CONSTRAINT "free_creations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_creations" ADD CONSTRAINT "free_creations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_creations" ADD CONSTRAINT "free_creations_model_profile_id_model_profiles_id_fk" FOREIGN KEY ("model_profile_id") REFERENCES "public"."model_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "free_creations_project_created_idx" ON "free_creations" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "free_creations_owner_status_idx" ON "free_creations" USING btree ("user_id","status");