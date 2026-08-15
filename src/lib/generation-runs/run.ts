import { db } from "@/lib/db";
import { generationRuns, projects, tasks } from "@/lib/db/schema";
import { id as generateId } from "@/lib/id";
import { enqueueTask } from "@/lib/task-queue/queue";
import { TASK_STATUS } from "@/lib/task-queue/types";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import {
  RUN_STATUS,
  type CreateGenerationRunInput,
  type RunProgressSummary,
} from "./types";

const TERMINAL_TASK_STATUSES = [
  TASK_STATUS.COMPLETED,
  TASK_STATUS.FAILED,
  TASK_STATUS.CANCELLED,
] as const;

interface SummarizableTask {
  status: string;
  progress: number;
  stage: string;
  createdAt: Date;
}

export function summarizeRunProgress(runTasks: SummarizableTask[]): RunProgressSummary {
  const totalTasks = runTasks.length;
  if (totalTasks === 0) {
    return {
      status: RUN_STATUS.PENDING,
      progress: 0,
      currentStage: "preflight",
      completedTasks: 0,
      failedTasks: 0,
      cancelledTasks: 0,
      totalTasks: 0,
    };
  }

  const completedTasks = runTasks.filter(
    (task) => task.status === TASK_STATUS.COMPLETED,
  ).length;
  const failedTasks = runTasks.filter(
    (task) => task.status === TASK_STATUS.FAILED,
  ).length;
  const cancelledTasks = runTasks.filter(
    (task) => task.status === TASK_STATUS.CANCELLED,
  ).length;
  const isTerminal = runTasks.every((task) =>
    TERMINAL_TASK_STATUSES.includes(
      task.status as (typeof TERMINAL_TASK_STATUSES)[number],
    ),
  );
  const isRunning = runTasks.some(
    (task) => task.status === TASK_STATUS.RUNNING,
  );
  const currentTask =
    runTasks.find((task) => task.status === TASK_STATUS.RUNNING) ??
    runTasks.find((task) => task.status === TASK_STATUS.PENDING) ??
    runTasks[runTasks.length - 1];
  const progress = Math.round(
    runTasks.reduce((total, task) => {
      if (task.status === TASK_STATUS.COMPLETED) return total + 100;
      return total + task.progress;
    }, 0) / totalTasks,
  );

  let status: RunProgressSummary["status"] = isRunning
    ? RUN_STATUS.RUNNING
    : RUN_STATUS.PENDING;
  if (isTerminal && failedTasks > 0) status = RUN_STATUS.FAILED;
  if (isTerminal && failedTasks === 0 && cancelledTasks > 0) {
    status = RUN_STATUS.CANCELLED;
  }
  if (isTerminal && failedTasks === 0 && cancelledTasks === 0) {
    status = RUN_STATUS.COMPLETED;
  }

  return {
    status,
    progress,
    currentStage: currentTask.stage,
    completedTasks,
    failedTasks,
    cancelledTasks,
    totalTasks,
  };
}

export async function createGenerationRun(
  input: CreateGenerationRunInput,
) {
  const runId = generateId();
  const now = new Date();
  const [run] = await db
    .insert(generationRuns)
    .values({
      id: runId,
      projectId: input.projectId,
      episodeId: input.episodeId ?? null,
      userId: input.userId,
      mode: input.mode,
      status: RUN_STATUS.PENDING,
      currentStage: input.stages[0]?.stage ?? "preflight",
      estimatedCost: input.estimatedCost,
      modelProfileId: input.modelProfileId ?? null,
      config: { stages: input.stages.map((stage) => stage.stage) },
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  try {
    const stageOrderByName = new Map<string, number>();
    for (const stage of input.stages) {
      if (!stageOrderByName.has(stage.stage)) {
        stageOrderByName.set(stage.stage, stageOrderByName.size);
      }
    }
    await Promise.all(
      input.stages.map((stage, index) =>
        enqueueTask({
          type: stage.type,
          projectId: input.projectId,
          episodeId: input.episodeId,
          runId,
          stage: stage.stage,
          stageOrder: stageOrderByName.get(stage.stage) ?? 0,
          payload: {
            ...stage.payload,
            projectId: input.projectId,
            episodeId: input.episodeId,
            modelProfileId: stage.modelProfileId ?? input.modelProfileId,
          },
          idempotencyKey:
            stage.idempotencyKey ?? `${runId}:${index}:${stage.type}`,
        }),
      ),
    );
  } catch (error) {
    await db
      .update(generationRuns)
      .set({ status: RUN_STATUS.FAILED, updatedAt: new Date() })
      .where(eq(generationRuns.id, runId));
    throw error;
  }

  return run;
}

export async function listProjectRuns(input: {
  projectId: string;
  userId: string;
}) {
  return db
    .select()
    .from(generationRuns)
    .where(
      and(
        eq(generationRuns.projectId, input.projectId),
        eq(generationRuns.userId, input.userId),
      ),
    )
    .orderBy(desc(generationRuns.createdAt));
}

export async function getGenerationRun(input: { id: string; userId: string }) {
  const [run] = await db
    .select()
    .from(generationRuns)
    .where(
      and(
        eq(generationRuns.id, input.id),
        eq(generationRuns.userId, input.userId),
      ),
    );
  if (!run) return null;

  const runTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.runId, run.id))
    .orderBy(asc(tasks.createdAt));
  return { ...run, tasks: runTasks, summary: summarizeRunProgress(runTasks) };
}

export async function synchronizeGenerationRun(runId: string | null): Promise<void> {
  if (!runId) return;
  const [existingRun] = await db
    .select()
    .from(generationRuns)
    .where(eq(generationRuns.id, runId));
  if (!existingRun) return;
  const runTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.runId, runId))
    .orderBy(asc(tasks.createdAt));
  const summary = summarizeRunProgress(runTasks);
  const now = new Date();
  const terminalRunStatuses: Set<RunProgressSummary["status"]> = new Set([
    RUN_STATUS.COMPLETED,
    RUN_STATUS.FAILED,
    RUN_STATUS.CANCELLED,
  ]);
  const isTerminal = terminalRunStatuses.has(summary.status);

  await db
    .update(generationRuns)
    .set({
      status: summary.status,
      progress: summary.progress,
      currentStage: summary.currentStage,
      startedAt:
        existingRun.startedAt ??
        (summary.status === RUN_STATUS.RUNNING ? now : null),
      completedAt: isTerminal ? existingRun.completedAt ?? now : null,
      updatedAt: now,
    })
    .where(eq(generationRuns.id, runId));
}

export async function cancelGenerationRun(input: {
  id: string;
  userId: string;
}): Promise<boolean> {
  const [run] = await db
    .select({ id: generationRuns.id })
    .from(generationRuns)
    .where(
      and(
        eq(generationRuns.id, input.id),
        eq(generationRuns.userId, input.userId),
      ),
    );
  if (!run) return false;

  const now = new Date();
  await db
    .update(tasks)
    .set({ cancelRequestedAt: now, updatedAt: now })
    .where(
      and(
        eq(tasks.runId, input.id),
        inArray(tasks.status, [TASK_STATUS.PENDING, TASK_STATUS.RUNNING]),
      ),
    );
  await db
    .update(tasks)
    .set({ status: TASK_STATUS.CANCELLED, updatedAt: now })
    .where(
      and(
        eq(tasks.runId, input.id),
        eq(tasks.status, TASK_STATUS.PENDING),
      ),
    );
  await synchronizeGenerationRun(input.id);
  return true;
}

export async function retryFailedGenerationRun(input: {
  id: string;
  userId: string;
}): Promise<boolean> {
  const [run] = await db
    .select({ id: generationRuns.id })
    .from(generationRuns)
    .innerJoin(projects, eq(generationRuns.projectId, projects.id))
    .where(
      and(
        eq(generationRuns.id, input.id),
        eq(projects.userId, input.userId),
      ),
    );
  if (!run) return false;

  const now = new Date();
  await db
    .update(tasks)
    .set({
      status: TASK_STATUS.PENDING,
      retries: 0,
      scheduledAt: now,
      error: null,
      errorCode: null,
      cancelRequestedAt: null,
      progress: 0,
      updatedAt: now,
    })
    .where(
      and(
        eq(tasks.runId, input.id),
        or(
          eq(tasks.status, TASK_STATUS.FAILED),
          and(
            eq(tasks.status, TASK_STATUS.CANCELLED),
            eq(tasks.errorCode, "UPSTREAM_FAILED"),
          ),
        ),
      ),
    );
  await synchronizeGenerationRun(input.id);
  return true;
}
