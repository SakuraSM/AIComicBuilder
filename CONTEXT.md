# AIComicBuilder Domain Context

## Core terms

- **Project**: a production containing shared creative direction, characters, episodes, and final output.
- **Episode**: an ordered production unit within a Project. It owns its script, storyboard progress, and final video.
- **StoryboardVersion**: an immutable grouping of Shot structure used for comparison and rollback.
- **Shot**: the smallest editable timeline unit. Its status is derived from active Assets and running Tasks.
- **Asset**: a versioned generated or uploaded media artifact. A logical Asset reference is stable across Local and S3 storage adapters.
- **Task**: one idempotent executable stage of generation. A Task may be retried, cancelled, or recovered after a worker lease expires.
- **GenerationRun**: a user-visible execution of one or more ordered stages for a Project or Episode. It groups Tasks, progress, cost, and failure recovery.
- **Guided mode**: the default stage-based workflow. It uses the same Project, Shot, Asset, Task, and GenerationRun data as professional mode.
- **Professional mode**: an alternate workspace presentation for timeline and version control; it is not a separate generation pipeline.

## Invariants

- A Task belongs to at most one GenerationRun and executes one stage.
- A Task idempotency key identifies the same billable intent; duplicate enqueue requests return the existing active Task.
- A running Task must hold a renewable lease. Expired leases return to the retry schedule.
- Secrets never belong in Task payloads, browser persistence, logs, or responses.
- Generated files are addressed by logical URLs; provider adapters and workflow callers never depend on permanent filesystem paths.
- Guided and professional modes must derive status from the same stored entities.
