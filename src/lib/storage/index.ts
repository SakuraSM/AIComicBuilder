import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { id as genId } from "@/lib/id";
import {
  isLocalStorageUrl,
  isS3StorageUrl,
  objectUrlToPublicUrl,
  stripLocalStoragePrefix,
  toLocalStorageUrl,
  toS3StorageUrl,
} from "./url";

export type StorageDriver = "local" | "s3";

export interface StoredObject {
  key: string;
  url: string;
  driver: StorageDriver;
}

export interface AssetRef {
  url: string;
  key?: string;
  driver: StorageDriver | "external";
  contentType?: string;
}

export interface MaterializedAsset {
  path: string;
  cleanup: () => Promise<void>;
}

interface PutObjectInput {
  buffer: Buffer;
  keyPrefix: string;
  filename: string;
  contentType?: string;
}

interface S3ClientLike {
  send: (command: unknown) => Promise<unknown>;
}

interface S3ModuleLike {
  S3Client: new (config: {
    endpoint?: string;
    region?: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
    forcePathStyle?: boolean;
  }) => S3ClientLike;
  PutObjectCommand: new (input: Record<string, unknown>) => unknown;
}

export function getStorageDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
}

export function getUploadDir(): string {
  return process.env.UPLOAD_DIR || "./uploads";
}

function safeFilename(filename: string): string {
  const ext = path.extname(filename) || ".bin";
  return `${genId()}${ext.toLowerCase()}`;
}

function normalizeKey(prefix: string, filename: string): string {
  return [prefix.replace(/^\/+|\/+$/g, ""), safeFilename(filename)].filter(Boolean).join("/");
}

export async function putObject(input: PutObjectInput): Promise<StoredObject> {
  const key = normalizeKey(input.keyPrefix, input.filename);
  const driver = getStorageDriver();

  if (driver === "s3") {
    return putS3Object({ ...input, key });
  }

  const uploadDir = getUploadDir();
  const filepath = path.join(uploadDir, key);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, input.buffer);
  return { key, url: toLocalStorageUrl(key), driver: "local" };
}

async function putS3Object(input: PutObjectInput & { key: string }): Promise<StoredObject> {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3");

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const s3Module = require("@aws-sdk/client-s3") as S3ModuleLike;
  const client = new s3Module.S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  });

  await client.send(
    new s3Module.PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.buffer,
      ContentType: input.contentType,
    }),
  );

  return { key: input.key, url: toS3StorageUrl(input.key), driver: "s3" };
}

export async function materializeAsset(value: string): Promise<string> {
  if (isLocalStorageUrl(value)) {
    return path.join(getUploadDir(), stripLocalStoragePrefix(value));
  }
  if (!isS3StorageUrl(value)) return value;

  const url = objectUrlToPublicUrl(value);
  if (!url.startsWith("http")) {
    throw new Error(`Cannot materialize private S3 object without a public URL: ${value}`);
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download asset: ${response.status}`);

  const ext = path.extname(value) || ".bin";
  const tempPath = path.join(os.tmpdir(), `aicomic-${genId()}${ext}`);
  fs.writeFileSync(tempPath, Buffer.from(await response.arrayBuffer()));
  return tempPath;
}

function inferContentType(filename: string): string | undefined {
  const extension = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".srt": "application/x-subrip",
  };
  return contentTypes[extension];
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

export async function persistGeneratedAsset(input: {
  source: string;
  keyPrefix: string;
  filename?: string;
  contentType?: string;
}): Promise<AssetRef> {
  if (isLocalStorageUrl(input.source)) {
    return {
      key: stripLocalStoragePrefix(input.source),
      url: input.source,
      driver: "local",
      contentType: input.contentType,
    };
  }
  if (isS3StorageUrl(input.source)) {
    return {
      key: input.source.slice("s3://".length),
      url: input.source,
      driver: "s3",
      contentType: input.contentType,
    };
  }

  let buffer: Buffer;
  let sourceFilename = input.filename;
  if (isHttpUrl(input.source)) {
    const response = await fetch(input.source);
    if (!response.ok) {
      throw new Error(`Failed to persist generated asset: ${response.status}`);
    }
    buffer = Buffer.from(await response.arrayBuffer());
    sourceFilename ||= path.basename(new URL(input.source).pathname) || "asset.bin";
  } else {
    buffer = await fs.promises.readFile(input.source);
    sourceFilename ||= path.basename(input.source);
  }

  const stored = await putObject({
    buffer,
    keyPrefix: input.keyPrefix,
    filename: sourceFilename || "asset.bin",
    contentType: input.contentType ?? inferContentType(sourceFilename || ""),
  });
  return {
    ...stored,
    contentType: input.contentType ?? inferContentType(sourceFilename || ""),
  };
}

export async function materializeAssetReference(
  value: string,
): Promise<MaterializedAsset> {
  const materializedPath = await materializeAsset(value);
  const isTemporary = isS3StorageUrl(value);
  return {
    path: materializedPath,
    cleanup: async () => {
      if (!isTemporary) return;
      await fs.promises.rm(materializedPath, { force: true });
    },
  };
}

export async function withMaterializedAssets<T>(input: {
  values: string[];
  execute: (paths: string[]) => Promise<T>;
}): Promise<T> {
  const materializedAssets = await Promise.all(
    input.values.map(materializeAssetReference),
  );
  try {
    return await input.execute(materializedAssets.map((asset) => asset.path));
  } finally {
    await Promise.allSettled(
      materializedAssets.map((asset) => asset.cleanup()),
    );
  }
}
