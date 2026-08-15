import { describe, expect, it } from "vitest";
import { summarizeRunProgress } from "./run";

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

describe("summarizeRunProgress", () => {
  it("derives the active stage and average progress", () => {
    expect(
      summarizeRunProgress([
        { status: "completed", progress: 100, stage: "frames", createdAt: CREATED_AT },
        { status: "running", progress: 40, stage: "videos", createdAt: CREATED_AT },
      ]),
    ).toMatchObject({
      status: "running",
      progress: 70,
      currentStage: "videos",
      completedTasks: 1,
      totalTasks: 2,
    });
  });

  it("keeps partial completion visible when one task fails", () => {
    expect(
      summarizeRunProgress([
        { status: "completed", progress: 100, stage: "frames", createdAt: CREATED_AT },
        { status: "failed", progress: 25, stage: "videos", createdAt: CREATED_AT },
      ]),
    ).toMatchObject({
      status: "failed",
      progress: 63,
      failedTasks: 1,
    });
  });
});
