import { describe, expect, it } from "vitest";
import {
  assertPersistableTaskPayload,
  containsSensitiveTaskData,
} from "./payload-security";

describe("task payload security", () => {
  it("accepts model profile references", () => {
    expect(
      containsSensitiveTaskData({ modelProfileId: "profile-1", shotId: "shot-1" }),
    ).toBe(false);
  });

  it("rejects nested credentials", () => {
    expect(
      containsSensitiveTaskData({ provider: { api_key: "secret" } }),
    ).toBe(true);
    expect(() =>
      assertPersistableTaskPayload({ payload: { modelConfig: { text: {} } } }),
    ).toThrow("modelProfileId");
  });
});
