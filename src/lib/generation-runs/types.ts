import type { TaskType } from "@/lib/task-queue/types";

export const RUN_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const RUN_MODE = {
  GUIDED: "guided",
  PROFESSIONAL: "professional",
} as const;

export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS];
export type RunMode = (typeof RUN_MODE)[keyof typeof RUN_MODE];

export interface GenerationStageInput {
  type: NonNullable<TaskType>;
  stage: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  modelProfileId?: string;
}

export interface CreateGenerationRunInput {
  projectId: string;
  episodeId?: string;
  userId: string;
  mode: RunMode;
  modelProfileId?: string;
  estimatedCost?: string;
  stages: GenerationStageInput[];
}

export interface RunProgressSummary {
  status: RunStatus;
  progress: number;
  currentStage: string;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  totalTasks: number;
}
