import type { tasks } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export const TASK_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type Task = InferSelectModel<typeof tasks>;
export type TaskType = Task["type"];

export interface TaskExecutionContext {
  signal: AbortSignal;
  reportProgress: (progress: number, stage?: string) => Promise<void>;
  heartbeat: () => Promise<void>;
}

export type TaskHandler = (
  task: Task,
  context: TaskExecutionContext,
) => Promise<unknown>;

export type TaskHandlerMap = Partial<Record<NonNullable<TaskType>, TaskHandler>>;

export interface EnqueueTaskInput {
  type: NonNullable<TaskType>;
  projectId?: string;
  episodeId?: string;
  runId?: string;
  stage?: string;
  stageOrder?: number;
  payload?: Record<string, unknown>;
  maxRetries?: number;
  scheduledAt?: Date;
  idempotencyKey?: string;
}

export interface RetryDecision {
  nextStatus: typeof TASK_STATUS.PENDING | typeof TASK_STATUS.FAILED;
  retries: number;
  scheduledAt: Date | null;
}
