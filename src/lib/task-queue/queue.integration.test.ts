import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, closeDb } from "@/lib/db";
import { generationRuns, projects, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  completeTask,
  dequeueTask,
  enqueueTask,
  heartbeatTask,
} from "./queue";

const integrationEnabled = process.env.RUN_POSTGRES_INTEGRATION === "1";

describe.runIf(integrationEnabled)("PostgreSQL task queue", () => {
  let userId: string;
  let projectId: string;
  let runId: string;

  beforeEach(async () => {
    const suffix = randomUUID();
    userId = `task-test-user-${suffix}`;
    projectId = `task-test-project-${suffix}`;
    runId = `task-test-run-${suffix}`;

    await db.insert(users).values({
      id: userId,
      email: `${suffix}@task-test.invalid`,
      username: `task-test-${suffix}`,
      passwordHash: "integration-test-only",
    });
    await db.insert(projects).values({
      id: projectId,
      userId,
      title: "Task queue integration fixture",
    });
    await db.insert(generationRuns).values({
      id: runId,
      projectId,
      userId,
    });
  });

  afterEach(async () => {
    await db.delete(users).where(eq(users.id, userId));
  });

  afterAll(async () => {
    await closeDb();
  });

  it("leases one stage at a time and unlocks the next stage after completion", async () => {
    await enqueueTask({
      type: "frame_generate",
      projectId,
      runId,
      stage: "frames",
      stageOrder: 0,
      payload: { shotId: "shot-a" },
      idempotencyKey: `${runId}:frame`,
    });
    await enqueueTask({
      type: "video_generate",
      projectId,
      runId,
      stage: "videos",
      stageOrder: 1,
      payload: { shotId: "shot-a" },
      idempotencyKey: `${runId}:video`,
    });

    const frameTask = await dequeueTask({
      workerId: "integration-worker",
      leaseDurationMs: 5_000,
      runId,
    });
    expect(frameTask?.type).toBe("frame_generate");
    expect(frameTask?.leaseOwner).toBe("integration-worker");
    expect(
      await heartbeatTask({
        id: frameTask!.id,
        workerId: "integration-worker",
        leaseDurationMs: 10_000,
      }),
    ).toBe(true);

    const blockedVideo = await dequeueTask({
      workerId: "integration-worker-2",
      runId,
    });
    expect(blockedVideo).toBeNull();

    await completeTask(frameTask!.id, { assetRef: "local://frames/a.png" });
    const videoTask = await dequeueTask({
      workerId: "integration-worker-2",
      runId,
    });
    expect(videoTask?.type).toBe("video_generate");
  });
});
