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
