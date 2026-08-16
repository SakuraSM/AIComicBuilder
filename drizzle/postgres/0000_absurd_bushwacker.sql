CREATE TABLE "agent_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"category" text NOT NULL,
	"agent_id" text
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"platform" text DEFAULT 'bailian' NOT NULL,
	"app_id" text NOT NULL,
	"api_key" text NOT NULL,
	"description" text DEFAULT '',
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_costumes" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"name" text DEFAULT 'default' NOT NULL,
	"description" text DEFAULT '',
	"reference_image" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"character_a_id" text NOT NULL,
	"character_b_id" text NOT NULL,
	"relation_type" text DEFAULT 'neutral' NOT NULL,
	"description" text DEFAULT '',
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"visual_hint" text DEFAULT '',
	"reference_image" text,
	"reference_image_history" text DEFAULT '[]',
	"scope" text DEFAULT 'main' NOT NULL,
	"performance_style" text DEFAULT '',
	"height_cm" integer DEFAULT 0,
	"body_type" text DEFAULT 'average',
	"is_stale" integer DEFAULT 0 NOT NULL,
	"episode_id" text
);
--> statement-breakpoint
CREATE TABLE "dialogues" (
	"id" text PRIMARY KEY NOT NULL,
	"shot_id" text NOT NULL,
	"character_id" text NOT NULL,
	"text" text NOT NULL,
	"audio_url" text,
	"sequence" integer DEFAULT 0 NOT NULL,
	"start_ratio" text DEFAULT '0',
	"end_ratio" text DEFAULT '1'
);
--> statement-breakpoint
CREATE TABLE "episode_characters" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_id" text NOT NULL,
	"character_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"sequence" integer NOT NULL,
	"idea" text DEFAULT '',
	"script" text DEFAULT '',
	"outline" text DEFAULT '',
	"status" text DEFAULT 'draft' NOT NULL,
	"generation_mode" text DEFAULT 'keyframe' NOT NULL,
	"description" text DEFAULT '',
	"keywords" text DEFAULT '',
	"script_hash" text DEFAULT '',
	"color_palette" text DEFAULT '',
	"target_duration" integer DEFAULT 0,
	"bgm_url" text DEFAULT '',
	"final_video_url" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"step" integer NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mood_board_images" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"image_url" text NOT NULL,
	"annotation" text DEFAULT '',
	"extracted_style" text DEFAULT '',
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"idea" text DEFAULT '',
	"script" text DEFAULT '',
	"outline" text DEFAULT '',
	"status" text DEFAULT 'draft' NOT NULL,
	"final_video_url" text,
	"generation_mode" text DEFAULT 'keyframe' NOT NULL,
	"use_project_prompts" integer DEFAULT 0 NOT NULL,
	"color_palette" text DEFAULT '',
	"world_setting" text DEFAULT '',
	"target_duration" integer DEFAULT 0,
	"bgm_url" text DEFAULT '',
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_ab_tests" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_key" text NOT NULL,
	"variant_a" text NOT NULL,
	"variant_b" text NOT NULL,
	"shot_id" text,
	"result_a_url" text,
	"result_b_url" text,
	"preferred" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"user_id" text,
	"prompt_key" text NOT NULL,
	"slots" jsonb NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"prompt_key" text NOT NULL,
	"slot_key" text,
	"scope" text DEFAULT 'global' NOT NULL,
	"project_id" text,
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_id" text NOT NULL,
	"project_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '',
	"lighting" text DEFAULT '',
	"color_palette" text DEFAULT '',
	"sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shot_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"shot_id" text NOT NULL,
	"character_id" text,
	"body_part" text DEFAULT 'full_body',
	"motion" text DEFAULT '' NOT NULL,
	"start_time" text DEFAULT '0',
	"end_time" text DEFAULT '0',
	"intensity" text DEFAULT 'normal',
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shot_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"shot_id" text NOT NULL,
	"type" text NOT NULL,
	"sequence_in_type" integer DEFAULT 0 NOT NULL,
	"asset_version" integer DEFAULT 1 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"file_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"characters" text,
	"model_provider" text,
	"model_id" text,
	"meta" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shots" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"prompt" text DEFAULT '',
	"motion_script" text,
	"camera_direction" text DEFAULT 'static',
	"duration" integer DEFAULT 10 NOT NULL,
	"video_script" text,
	"video_prompt" text,
	"transition_in" text DEFAULT 'cut',
	"transition_out" text DEFAULT 'cut',
	"episode_id" text,
	"version_id" text,
	"scene_id" text,
	"composition_guide" text DEFAULT '',
	"focal_point" text DEFAULT '',
	"depth_of_field" text DEFAULT 'medium',
	"sound_design" text DEFAULT '',
	"music_cue" text DEFAULT '',
	"costume_overrides" text DEFAULT '',
	"is_stale" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storyboard_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"label" text NOT NULL,
	"version_num" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"episode_id" text
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"result" jsonb,
	"error" text,
	"retries" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp NOT NULL,
	"scheduled_at" timestamp,
	"episode_id" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_bindings" ADD CONSTRAINT "agent_bindings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_bindings" ADD CONSTRAINT "agent_bindings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_costumes" ADD CONSTRAINT "character_costumes_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_character_a_id_characters_id_fk" FOREIGN KEY ("character_a_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relations" ADD CONSTRAINT "character_relations_character_b_id_characters_id_fk" FOREIGN KEY ("character_b_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogues" ADD CONSTRAINT "dialogues_shot_id_shots_id_fk" FOREIGN KEY ("shot_id") REFERENCES "public"."shots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogues" ADD CONSTRAINT "dialogues_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_characters" ADD CONSTRAINT "episode_characters_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_characters" ADD CONSTRAINT "episode_characters_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mood_board_images" ADD CONSTRAINT "mood_board_images_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_presets" ADD CONSTRAINT "prompt_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_template_id_prompt_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shot_actions" ADD CONSTRAINT "shot_actions_shot_id_shots_id_fk" FOREIGN KEY ("shot_id") REFERENCES "public"."shots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shot_assets" ADD CONSTRAINT "shot_assets_shot_id_shots_id_fk" FOREIGN KEY ("shot_id") REFERENCES "public"."shots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shots" ADD CONSTRAINT "shots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shots" ADD CONSTRAINT "shots_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shots" ADD CONSTRAINT "shots_version_id_storyboard_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."storyboard_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storyboard_versions" ADD CONSTRAINT "storyboard_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storyboard_versions" ADD CONSTRAINT "storyboard_versions_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_owner_category_idx" ON "agents" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "projects_user_created_idx" ON "projects" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prompt_templates_owner_scope_idx" ON "prompt_templates" USING btree ("user_id","scope","project_id");--> statement-breakpoint
CREATE INDEX "prompt_templates_key_idx" ON "prompt_templates" USING btree ("prompt_key","slot_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");