import { describe, expect, it } from "vitest";
import {
  classifyFreeCreationError,
  FREE_CREATION_MODE,
  parseFreeCreationStoredConfig,
  requiresFreeCreationPrompt,
} from "./free-creation";

describe("free creation validation", () => {
  it("requires a prompt only for text-to-video", () => {
    expect(requiresFreeCreationPrompt(FREE_CREATION_MODE.TEXT)).toBe(true);
    expect(requiresFreeCreationPrompt(FREE_CREATION_MODE.FIRST_FRAME)).toBe(false);
    expect(requiresFreeCreationPrompt(FREE_CREATION_MODE.FIRST_LAST_FRAME)).toBe(false);
    expect(requiresFreeCreationPrompt(FREE_CREATION_MODE.REFERENCE)).toBe(false);
  });

  it("parses persisted worker configuration without accepting malformed assets", () => {
    expect(
      parseFreeCreationStoredConfig({
        duration: 30,
        ratio: "adaptive",
        resolution: "720p",
        generateAudio: true,
        watermark: false,
        inputAssets: ["local://input.png"],
      }),
    ).toMatchObject({ duration: 30, inputAssets: ["local://input.png"] });

    expect(
      parseFreeCreationStoredConfig({
        duration: 5,
        ratio: "adaptive",
        resolution: "720p",
        generateAudio: true,
        watermark: false,
        inputAssets: [42],
      }),
    ).toBeNull();
  });

  it("keeps a persisted sanitized error code stable", () => {
    expect(classifyFreeCreationError("input_image_sensitive")).toBe(
      "input_image_sensitive",
    );
    expect(classifyFreeCreationError("unknown")).toBe("unknown");
  });
});
