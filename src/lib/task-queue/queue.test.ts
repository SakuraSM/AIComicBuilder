import { describe, expect, it } from "vitest";
import { calculateRetryDecision } from "./queue";

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z");

describe("calculateRetryDecision", () => {
  it("schedules retries using exponential backoff", () => {
    const firstRetry = calculateRetryDecision({
      currentRetries: 0,
      maxRetries: 3,
      now: BASE_TIME,
    });
    const secondRetry = calculateRetryDecision({
      currentRetries: 1,
      maxRetries: 3,
      now: BASE_TIME,
    });

    expect(firstRetry).toEqual({
      nextStatus: "pending",
      retries: 1,
      scheduledAt: new Date(BASE_TIME.getTime() + 2_000),
    });
    expect(secondRetry.scheduledAt).toEqual(
      new Date(BASE_TIME.getTime() + 4_000),
    );
  });

  it("marks a task failed when the retry budget is exhausted", () => {
    expect(
      calculateRetryDecision({
        currentRetries: 2,
        maxRetries: 3,
        now: BASE_TIME,
      }),
    ).toEqual({ nextStatus: "failed", retries: 3, scheduledAt: null });
  });
});
