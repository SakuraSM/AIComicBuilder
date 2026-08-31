# Studio Workflow V2 rollout

Studio Workflow V2 is an incremental runtime. Existing projects, asset URLs and
`POST /api/projects/:id/generate` callers remain supported while new background
runs use `GenerationRun`, leased tasks, server-owned model profiles and logical
asset references.

The workspace also includes a free-creation mode for the official Seedance
protocol. It bypasses the script/storyboard pipeline and supports prompt-only,
first-frame, first-and-last-frame, and omni-reference image video generation.
Image-driven modes may omit the prompt. Seedance 2.5 capabilities are resolved
from the selected model (30-second output, up to 30 reference images, 480p/720p,
and explicit omni-reference task typing). Free creations require a securely
saved video model profile and are persisted per project in `free_creations`.
The create endpoint returns after enqueueing a durable task; the UI polls the
persisted history so a refresh does not lose progress.

## Deploy

1. Back up PostgreSQL and apply the committed migrations:

   ```bash
   pnpm db:migrate
   ```

2. Set a deployment-specific encryption key of at least 32 characters. Do not
   reuse `AUTH_SECRET` and do not commit the value:

   ```dotenv
   MODEL_CONFIG_ENCRYPTION_KEY=replace-with-a-random-secret
   ```

3. Select the task execution mode:

   ```dotenv
   TASK_ENGINE_V2=true
   TASK_WORKER_MODE=embedded
   NEXT_PUBLIC_STUDIO_WORKSPACE_V2=true
   ```

   `embedded` is suitable for a single application instance. For multiple web
   replicas, set `TASK_WORKER_MODE=external` on the web service and run one or
   more workers with `pnpm worker`.

4. Save text, image and video model profiles from Settings. Browser-stored
   credentials from older builds are intentionally removed during store
   migration; they are never copied into a Task payload.

5. Verify the release:

   ```bash
   pnpm lint --quiet
   pnpm exec tsc --noEmit
   pnpm test
   pnpm test:integration
   pnpm build
   pnpm test:e2e
   ```

## Rollout and rollback

- Start with `NEXT_PUBLIC_STUDIO_WORKSPACE_V2` enabled only in the target deployment. The
  default mode is guided; professional mode shares the same Project, Shot,
  Asset and Run records.
- Disable `NEXT_PUBLIC_STUDIO_WORKSPACE_V2` and rebuild to hide the new workspace
  controls without deleting V2 data.
- Disable `TASK_ENGINE_V2` to stop embedded task execution. Pending tasks remain
  persisted and can resume when the engine is re-enabled.
- Do not roll back the additive migrations during an application rollback. Old
  code ignores the new tables and nullable columns, which keeps existing data
  recoverable.

## API summary

- `POST /api/projects/:id/runs/estimate` — dry-run task and cost estimate.
- `GET|POST /api/projects/:id/free-creations` — list or enqueue direct Seedance
  creations.
- `DELETE /api/projects/:id/free-creations/:creationId` — request cancellation
  locally and from the upstream Seedance task when it is already running.
- `POST /api/projects/:id/runs` — create a persisted background run.
- `GET /api/projects/:id/runs` — list project runs.
- `GET /api/runs/:id` and `GET /api/runs/:id/events` — snapshot or SSE progress.
- `DELETE /api/runs/:id` — request cancellation.
- `POST /api/runs/:id/retry` — retry failed or upstream-cancelled items.
- `GET|POST /api/model-profiles` — list public profile metadata or save encrypted
  server-side credentials.

See [CONTEXT.md](../CONTEXT.md) and [docs/adr](./adr) for domain invariants and
the compatibility decisions behind this rollout.
