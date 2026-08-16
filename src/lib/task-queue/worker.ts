import { id as generateId } from "@/lib/id";
import { synchronizeGenerationRun } from "@/lib/generation-runs";
import {
  cancelTask,
  completeTask,
  dequeueTask,
  failTask,
  heartbeatTask,
  isTaskCancellationRequested,
  updateTaskProgress,
} from "./queue";
import type { Task, TaskHandlerMap } from "./types";

const POLL_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const CANCELLATION_CHECK_INTERVAL_MS = 1_000;

let isRunning = false;
let handlers: TaskHandlerMap = {};
let pollTimeout: ReturnType<typeof setTimeout> | null = null;
const workerId = `worker-${generateId()}`;

export function registerHandlers(newHandlers: TaskHandlerMap): void {
  handlers = { ...handlers, ...newHandlers };
}

function createTaskMonitors(input: {
  task: Task;
  abortController: AbortController;
}): { stop: () => void } {
  const heartbeatInterval = setInterval(async () => {
    try {
      await heartbeatTask({ id: input.task.id, workerId });
    } catch (error) {
      console.error("[TaskWorker] Heartbeat failed:", error);
    }
  }, HEARTBEAT_INTERVAL_MS);

  const cancellationInterval = setInterval(async () => {
    try {
      if (await isTaskCancellationRequested(input.task.id)) {
        input.abortController.abort(new Error("Task cancellation requested."));
      }
    } catch (error) {
      console.error("[TaskWorker] Cancellation check failed:", error);
    }
  }, CANCELLATION_CHECK_INTERVAL_MS);

  return {
    stop: () => {
      clearInterval(heartbeatInterval);
      clearInterval(cancellationInterval);
    },
  };
}

async function processTask(task: Task): Promise<void> {
  const handler = task.type ? handlers[task.type] : undefined;
  if (!handler) {
    await failTask({
      id: task.id,
      error: `No handler registered for task type: ${task.type}`,
      errorCode: "HANDLER_NOT_REGISTERED",
    });
    await synchronizeGenerationRun(task.runId);
    return;
  }

  const abortController = new AbortController();
  const monitors = createTaskMonitors({ task, abortController });

  try {
    const result = await handler(task, {
      signal: abortController.signal,
      heartbeat: () => heartbeatTask({ id: task.id, workerId }).then(() => undefined),
      reportProgress: (progress, stage) =>
        updateTaskProgress({ id: task.id, workerId, progress, stage }),
    });

    if (abortController.signal.aborted) {
      await cancelTask(task.id);
      return;
    }
    await completeTask(task.id, result);
  } catch (error) {
    if (abortController.signal.aborted) {
      await cancelTask(task.id);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    await failTask({ id: task.id, error: message });
  } finally {
    monitors.stop();
    await synchronizeGenerationRun(task.runId);
  }
}

async function poll(): Promise<void> {
  if (!isRunning) return;

  try {
    const task = await dequeueTask({ workerId });
    if (task) {
      await synchronizeGenerationRun(task.runId);
      await processTask(task);
    }
  } catch (error) {
    console.error("[TaskWorker] Poll error:", error);
  }

  if (isRunning) pollTimeout = setTimeout(poll, POLL_INTERVAL_MS);
}

export function startWorker(): void {
  if (isRunning) return;
  isRunning = true;
  console.log("[TaskWorker] Started", { workerId, pollIntervalMs: POLL_INTERVAL_MS });
  void poll();
}

export function stopWorker(): void {
  isRunning = false;
  if (pollTimeout) clearTimeout(pollTimeout);
  pollTimeout = null;
  console.log("[TaskWorker] Stopped", { workerId });
}
