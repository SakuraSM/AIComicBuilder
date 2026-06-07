const LOCAL_PREFIX = "local://";
const S3_PREFIX = "s3://";

export function objectUrlToPublicUrl(value: string | null | undefined): string {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/api/uploads/")) return value;
  if (value.startsWith("/app/uploads/")) return `/api/uploads/${value.slice("/app/uploads/".length)}`;
  if (value.startsWith("/") && value.includes("/uploads/")) {
    return `/api/uploads/${value.replace(/^.*?\/uploads\//, "")}`;
  }
  if (value.startsWith("/")) return value;
  if (value.startsWith(LOCAL_PREFIX)) return `/api/uploads/${value.slice(LOCAL_PREFIX.length)}`;
  if (value.startsWith(S3_PREFIX)) {
    const baseUrl = process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/g, "");
    const key = value.slice(S3_PREFIX.length);
    return baseUrl ? `${baseUrl}/${key}` : value;
  }
  return `/api/uploads/${value.replace(/^.*?uploads\//, "")}`;
}

export function toLocalStorageUrl(key: string): string {
  return `${LOCAL_PREFIX}${key}`;
}

export function toS3StorageUrl(key: string): string {
  return `${S3_PREFIX}${key}`;
}

export function isLocalStorageUrl(value: string): boolean {
  return value.startsWith(LOCAL_PREFIX);
}

export function isS3StorageUrl(value: string): boolean {
  return value.startsWith(S3_PREFIX);
}

export function stripLocalStoragePrefix(value: string): string {
  return value.slice(LOCAL_PREFIX.length);
}

export function stripS3StoragePrefix(value: string): string {
  return value.slice(S3_PREFIX.length);
}
