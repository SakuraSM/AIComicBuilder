import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

export interface ModelCredentials {
  apiKey: string;
  secretKey?: string;
}

function getEncryptionKey(): Buffer {
  const configuredKey = process.env.MODEL_CONFIG_ENCRYPTION_KEY;
  if (!configuredKey || configuredKey.length < 32) {
    throw new Error(
      "MODEL_CONFIG_ENCRYPTION_KEY must be configured with at least 32 characters.",
    );
  }
  return createHash("sha256").update(configuredKey, "utf8").digest();
}

export function encryptModelCredentials(credentials: ModelCredentials): string {
  const initializationVector = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    initializationVector,
    { authTagLength: AUTH_TAG_LENGTH_BYTES },
  );
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [initializationVector, authTag, encrypted]
    .map((value) => value.toString("base64url"))
    .join(".");
}

export function decryptModelCredentials(value: string): ModelCredentials {
  const [initializationVectorValue, authTagValue, encryptedValue] = value.split(".");
  if (!initializationVectorValue || !authTagValue || !encryptedValue) {
    throw new Error("Encrypted model credentials have an invalid format.");
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(initializationVectorValue, "base64url"),
    { authTagLength: AUTH_TAG_LENGTH_BYTES },
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);
  const parsed = JSON.parse(decrypted.toString("utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || !("apiKey" in parsed)) {
    throw new Error("Decrypted model credentials have an invalid shape.");
  }
  const credentials = parsed as Record<string, unknown>;
  if (typeof credentials.apiKey !== "string") {
    throw new Error("Decrypted model credentials are missing an API key.");
  }
  return {
    apiKey: credentials.apiKey,
    secretKey:
      typeof credentials.secretKey === "string" ? credentials.secretKey : undefined,
  };
}
