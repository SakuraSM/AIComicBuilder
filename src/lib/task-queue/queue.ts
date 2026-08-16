import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { and, asc, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import { id as generateId } from "@/lib/id";
import {
  TASK_STATUS,
  type EnqueueTaskInput,
  type RetryDecision,
  type Task,
} from "./types";
import { assertPersistableTaskPayload } from "./payload-security";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_LEASE_DURATION_MS = 60_000;
const BASE_RETRY_DELAY_MS = 2_000;
const MAX_RETRY_DELAY_MS = 5 * 60_000;

function clampProgress(progress: number): number {
  return Math.min(100, Math.max(0, Math.round(progress)));
}

export function calculateRetryDecision(input: {
  currentRetries: number;
  maxRetries: number;
  now: Date;
}): RetryDecision {
  const retries = input.currentRetries + 1;
  if (retries >= input.maxRetries) {
    return { nextStatus: TASK_STATUS.FAILED, retries, scheduledAt: null };
  }

  const exponentialDelay = BASE_RETRY_DELAY_MS * 2 ** input.currentRetries;
  const retryDelay = Math.min(exponentialDelay, MAX_RETRY_DELAY_MS);
  return {
    nextStatus: TASK_STATUS.PENDING,
    retries,
    scheduledAt: new Date(input.now.getTime() + retryDelay),
  };
}

export async function enqueueTask(input: EnqueueTaskInput): Promise<Task> {
  assertPersistableTaskPayload(input.payload);
  if (input.idempotencyKey) {
    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.idempotencyKey, input.idempotencyKey));
    if (existingTask) return existingTask;
  }

  const now = new Date();
  try {
    const [task] = await db
      .insert(tasks)
      .values({
        id: generateId(),
        type: input.type,
        projectId: input.projectId,
        episodeId: input.episodeId ?? null,
        runId: input.runId ?? null,
        stage: input.stage ?? input.type,
        stageOrder: input.stageOrder ?? 0,
        payload: input.payload,
        maxRetries: input.maxRetries ?? DEFAULT_MAX_RETRIES,
        scheduledAt: input.scheduledAt,
        idempotencyKey: input.idempotencyKey,
        updatedAt: now,
      })
      .returning();
    return task;
  } catch (error) {
    const databaseError = error as { code?: string };
    if (databaseError.code !== "23505" || !input.idempotencyKey) throw error;

    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.idempotencyKey, input.idempotencyKey));
    if (!existingTask) throw error;
    return existingTask;
  }
}

export async function recoverExpiredTasks(now = new Date()): Promise<number> {
  const expiredTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.status, TASK_STATUS.RUNNING),
        lt(tasks.leaseExpiresAt, now),
      ),
    );

  await Promise.all(
    expiredTasks.map((task) =>
      failTask({
        id: task.id,
        error: "Worker lease expired before the task completed.",
        errorCode: "LEASE_EXPIRED",
        now,
      }),
    ),
  );

  return expiredTasks.length;
}

export async function dequeueTask(input: {
  workerId: string;
  leaseDurationMs?: number;
  now?: Date;
  runId?: string;
}): Promise<Task | null> {
  const now = input.now ?? new Date();
  const leaseDurationMs = input.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS;
  await recoverExpiredTasks(now);

  return db.transaction(async (transaction) => {
    const [candidate] = await transaction
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, TASK_STATUS.PENDING),
          input.runId ? eq(tasks.runId, input.runId) : undefined,
          or(isNull(tasks.scheduledAt), lte(tasks.scheduledAt, now)),
          isNull(tasks.cancelRequestedAt),
          or(
            isNull(tasks.runId),
            sql`NOT EXISTS (
              SELECT 1 FROM ${tasks} AS prior_task
              WHERE prior_task.run_id = ${tasks.runId}
                AND prior_task.stage_order < ${tasks.stageOrder}
                AND prior_task.status NOT IN ('completed', 'cancelled')
            )`,
          ),
        ),
      )
      .orderBy(asc(tasks.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!candidate) return null;

    const [claimedTask] = await transaction
      .update(tasks)
      .set({
        status: TASK_STATUS.RUNNING,
        leaseOwner: input.workerId,
        leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
        heartbeatAt: now,
        updatedAt: now,
      })
      .where(eq(tasks.id, candidate.id))
      .returning();

    return claimedTask ?? null;
  });
}

export async function heartbeatTask(input: {
  id: string;
  workerId: string;
  leaseDurationMs?: number;
}): Promise<boolean> {
  const now = new Date();
  const leaseDurationMs = input.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS;
  const updatedTasks = await db
    .update(tasks)
    .set({
      heartbeatAt: now,
      leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
      updatedAt: now,
    })
    .where(
      and(
        eq(tasks.id, input.id),
        eq(tasks.leaseOwner, input.workerId),
        eq(tasks.status, TASK_STATUS.RUNNING),
      ),
    )
    .returning({ id: tasks.id });
  return updatedTasks.length === 1;
}

export async function updateTaskProgress(input: {
  id: string;
  workerId: string;
  progress: number;
  stage?: string;
}): Promise<void> {
  const update: { progress: number; stage?: string; updatedAt: Date } = {
    progress: clampProgress(input.progress),
    updatedAt: new Date(),
  };
  if (input.stage) update.stage = input.stage;

  await db
    .update(tasks)
    .set(update)
    .where(
      and(
        eq(tasks.id, input.id),
        eq(tasks.leaseOwner, input.workerId),
        eq(tasks.status, TASK_STATUS.RUNNING),
      ),
    );
}

export async function isTaskCancellationRequested(id: string): Promise<boolean> {
  const [task] = await db
    .select({ cancelRequestedAt: tasks.cancelRequestedAt })
    .from(tasks)
    .where(eq(tasks.id, id));
  return Boolean(task?.cancelRequestedAt);
}

export async function requestTaskCancellation(id: string): Promise<void> {
  const now = new Date();
  await db
    .update(tasks)
    .set({
      cancelRequestedAt: now,
      status: sql`CASE WHEN ${tasks.status} = 'pending' THEN 'cancelled' ELSE ${tasks.status} END`,
      updatedAt: now,
    })
    .where(
      and(
        eq(tasks.id, id),
        or(
          eq(tasks.status, TASK_STATUS.PENDING),
          eq(tasks.status, TASK_STATUS.RUNNING),
        ),
      ),
    );
}

export async function completeTask(id: string, result: unknown): Promise<void> {
  await db
    .update(tasks)
    .set({
      status: TASK_STATUS.COMPLETED,
      progress: 100,
      result: result as Record<string, unknown>,
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id));
}

export async function cancelTask(id: string): Promise<void> {
  await db
    .update(tasks)
    .set({
      status: TASK_STATUS.CANCELLED,
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id));
}

export async function failTask(input: {
  id: string;
  error: string;
  errorCode?: string;
  now?: Date;
}): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, input.id));
  if (!task) return;

  const now = input.now ?? new Date();
  const decision = calculateRetryDecision({
    currentRetries: task.retries,
    maxRetries: task.maxRetries,
    now,
  });

  await db
    .update(tasks)
    .set({
      status: decision.nextStatus,
      retries: decision.retries,
      scheduledAt: decision.scheduledAt,
      error: input.error,
      errorCode: input.errorCode ?? "TASK_EXECUTION_FAILED",
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      updatedAt: now,
    })
    .where(eq(tasks.id, input.id));

  if (decision.nextStatus === TASK_STATUS.FAILED && task.runId) {
    await db
      .update(tasks)
      .set({
        status: TASK_STATUS.CANCELLED,
        error: "A required earlier generation stage failed.",
        errorCode: "UPSTREAM_FAILED",
        cancelRequestedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(tasks.runId, task.runId),
          eq(tasks.status, TASK_STATUS.PENDING),
          sql`${tasks.stageOrder} > ${task.stageOrder}`,
        ),
      );
  }
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.createdAt));
}

export async function getTasksByRun(runId: string): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.runId, runId))
    .orderBy(asc(tasks.createdAt));
}
