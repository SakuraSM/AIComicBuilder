import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  materializeAssetReference,
  persistGeneratedAsset,
} from "./index";

const ORIGINAL_UPLOAD_DIR = process.env.UPLOAD_DIR;
const ORIGINAL_STORAGE_DRIVER = process.env.STORAGE_DRIVER;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  process.env.UPLOAD_DIR = ORIGINAL_UPLOAD_DIR;
  process.env.STORAGE_DRIVER = ORIGINAL_STORAGE_DRIVER;
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.promises.rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("logical asset storage", () => {
  it("persists and materializes generated files through the local adapter", async () => {
    const temporaryDirectory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "aicomic-storage-test-"),
    );
    temporaryDirectories.push(temporaryDirectory);
    process.env.UPLOAD_DIR = path.join(temporaryDirectory, "uploads");
    process.env.STORAGE_DRIVER = "local";
    const sourcePath = path.join(temporaryDirectory, "frame.png");
    await fs.promises.writeFile(sourcePath, Buffer.from("frame-bytes"));

    const asset = await persistGeneratedAsset({
      source: sourcePath,
      keyPrefix: "projects/project-1/frames",
      filename: "frame.png",
    });
    const materialized = await materializeAssetReference(asset.url);

    expect(asset.driver).toBe("local");
    expect(asset.url).toMatch(/^local:\/\/projects\/project-1\/frames\//);
    expect(await fs.promises.readFile(materialized.path, "utf8")).toBe("frame-bytes");
    await materialized.cleanup();
    expect(fs.existsSync(materialized.path)).toBe(true);
  });
});
