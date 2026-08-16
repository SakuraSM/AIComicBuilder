import { runMigrations } from "@/lib/db";
import { initializeProviders } from "@/lib/ai/setup";
import { registerPipelineHandlers } from "@/lib/pipeline";
import { startWorker } from "@/lib/task-queue";
import { ensureInitialAdmin } from "@/lib/auth/bootstrap";

let bootstrapped = false;

export function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;

  console.log("[Bootstrap] Running database migrations...");
  runMigrations();

  void ensureInitialAdmin().catch((error) => {
    console.error("[Bootstrap] Initial admin setup failed:", error);
  });

  console.log("[Bootstrap] Initializing AI providers...");
  initializeProviders();

  console.log("[Bootstrap] Registering pipeline handlers...");
  registerPipelineHandlers();

  const taskWorkerMode = process.env.TASK_WORKER_MODE ?? "embedded";
  if (process.env.TASK_ENGINE_V2 !== "false" && taskWorkerMode === "embedded") {
    console.log("[Bootstrap] Starting task worker...");
    startWorker();
  } else {
    console.log("[Bootstrap] Embedded task worker disabled.", {
      taskEngineV2: process.env.TASK_ENGINE_V2,
      taskWorkerMode,
    });
  }

  console.log("[Bootstrap] Ready.");
}
