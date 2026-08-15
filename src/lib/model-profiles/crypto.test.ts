import { afterEach, describe, expect, it } from "vitest";
import { decryptModelCredentials, encryptModelCredentials } from "./crypto";

const ORIGINAL_KEY = process.env.MODEL_CONFIG_ENCRYPTION_KEY;

afterEach(() => {
  process.env.MODEL_CONFIG_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe("model credential encryption", () => {
  it("round-trips credentials without storing plaintext", () => {
    process.env.MODEL_CONFIG_ENCRYPTION_KEY = "test-key-that-is-at-least-thirty-two-characters";
    const encrypted = encryptModelCredentials({
      apiKey: "private-api-key",
      secretKey: "private-secret-key",
    });

    expect(encrypted).not.toContain("private-api-key");
    expect(decryptModelCredentials(encrypted)).toEqual({
      apiKey: "private-api-key",
      secretKey: "private-secret-key",
    });
  });

  it("refuses to save credentials without a deployment key", () => {
    delete process.env.MODEL_CONFIG_ENCRYPTION_KEY;
    expect(() => encryptModelCredentials({ apiKey: "secret" })).toThrow(
      "MODEL_CONFIG_ENCRYPTION_KEY",
    );
  });
});
