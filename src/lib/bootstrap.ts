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

  console.log("[Bootstrap] Starting task worker...");
  startWorker();

  console.log("[Bootstrap] Ready.");
}
