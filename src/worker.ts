import { initializeProviders } from "@/lib/ai/setup";
import { closeDb } from "@/lib/db";
import { registerPipelineHandlers } from "@/lib/pipeline";
import { startWorker, stopWorker } from "@/lib/task-queue";

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("[TaskWorker] Shutting down", { signal });
  stopWorker();
  await closeDb();
  process.exitCode = 0;
}

initializeProviders();
registerPipelineHandlers();
startWorker();

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
