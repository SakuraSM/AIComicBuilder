import { describe, expect, it } from "vitest";
import { buildSeedanceTaskRequest } from "./seedance";

const MODEL_ID = "doubao-seedance-2-0-260128";

describe("buildSeedanceTaskRequest", () => {
  it("builds a prompt-only Seedance 2.0 request with top-level options", () => {
    const request = buildSeedanceTaskRequest({
      model: MODEL_ID,
      params: {
        prompt: "A paper-cut fox runs through a moonlit forest",
        duration: 15,
        ratio: "9:16",
        resolution: "1080p",
        generateAudio: true,
        watermark: false,
        returnLastFrame: true,
        seed: 42,
      },
    });

    expect(request).toEqual({
      model: MODEL_ID,
      content: [
        {
          type: "text",
          text: "A paper-cut fox runs through a moonlit forest",
        },
      ],
      duration: 15,
      ratio: "9:16",
      resolution: "1080p",
      generate_audio: true,
      watermark: false,
      return_last_frame: true,
      seed: 42,
    });
  });

  it("maps first and last images to Seedance frame roles", () => {
    const request = buildSeedanceTaskRequest({
      model: MODEL_ID,
      params: {
        prompt: "The camera moves from dawn to dusk",
        firstFrame: "https://example.com/first.png",
        lastFrame: "https://example.com/last.png",
        duration: 8,
        ratio: "16:9",
      },
    });

    expect(request.content.slice(1)).toEqual([
      {
        type: "image_url",
        image_url: { url: "https://example.com/first.png" },
        role: "first_frame",
      },
      {
        type: "image_url",
        image_url: { url: "https://example.com/last.png" },
        role: "last_frame",
      },
    ]);
  });

  it("supports a first-frame-only request", () => {
    const request = buildSeedanceTaskRequest({
      model: MODEL_ID,
      params: {
        prompt: "The character looks up and smiles",
        firstFrame: "https://example.com/first.png",
        duration: 5,
        ratio: "adaptive",
      },
    });

    expect(request.content).toHaveLength(2);
    expect(request.content[1]).toMatchObject({ role: "first_frame" });
  });

  it("omits blank text when an image drives the request", () => {
    const request = buildSeedanceTaskRequest({
      model: MODEL_ID,
      params: {
        prompt: "   ",
        firstFrame: "https://example.com/first.png",
        duration: 5,
        ratio: "adaptive",
      },
    });

    expect(request.content).toEqual([
      {
        type: "image_url",
        image_url: { url: "https://example.com/first.png" },
        role: "first_frame",
      },
    ]);
  });

  it("keeps the initial image and caps reference images at nine total", () => {
    const request = buildSeedanceTaskRequest({
      model: MODEL_ID,
      params: {
        prompt: "Keep every character visually consistent",
        initialImage: "https://example.com/primary.png",
        referenceImages: Array.from(
          { length: 10 },
          (_, index) => `https://example.com/reference-${index}.png`,
        ),
        duration: 5,
        ratio: "adaptive",
      },
    });

    expect(request.content).toHaveLength(10);
    expect(request.content[1]).toMatchObject({
      image_url: { url: "https://example.com/primary.png" },
      role: "reference_image",
    });
    expect(request.content.slice(1).every((item) => item.type === "image_url" && item.role === "reference_image")).toBe(true);
  });

  it("uses the Seedance 2.5 omni reference contract and 30-image limit", () => {
    const request = buildSeedanceTaskRequest({
      model: "doubao-seedance-2-5-260628",
      params: {
        prompt: "Use image 1 as the opening composition",
        initialImage: "https://example.com/primary.png",
        referenceImages: Array.from(
          { length: 35 },
          (_, index) => `https://example.com/reference-${index}.png`,
        ),
        duration: 30,
        ratio: "adaptive",
      },
    });

    expect(request.omni_reference_task_type).toBe("reference");
    expect(request.content.filter((item) => item.type === "image_url")).toHaveLength(30);
  });
});
