export const FREE_CREATION_MODE = {
  TEXT: "text",
  FIRST_FRAME: "first_frame",
  FIRST_LAST_FRAME: "first_last_frame",
  REFERENCE: "reference",
} as const;

export type FreeCreationMode =
  (typeof FREE_CREATION_MODE)[keyof typeof FREE_CREATION_MODE];

export const FREE_CREATION_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type FreeCreationStatus =
  (typeof FREE_CREATION_STATUS)[keyof typeof FREE_CREATION_STATUS];

export const FREE_CREATION_RATIOS = [
  "adaptive",
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
] as const;

export type FreeCreationRatio = (typeof FREE_CREATION_RATIOS)[number];

export const FREE_CREATION_RESOLUTIONS = ["480p", "720p", "1080p"] as const;

export type FreeCreationResolution =
  (typeof FREE_CREATION_RESOLUTIONS)[number];

export const FREE_CREATION_DURATION_MIN_SECONDS = 4;
export const FREE_CREATION_DURATION_MAX_SECONDS = 30;
export const FREE_CREATION_MAX_PROMPT_LENGTH = 5_000;
export const FREE_CREATION_MAX_REFERENCE_IMAGES = 30;
export const FREE_CREATION_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const FREE_CREATION_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export interface FreeCreationSummary {
  id: string;
  mode: FreeCreationMode;
  status: FreeCreationStatus;
  prompt: string;
  videoUrl: string | null;
  lastFrameUrl: string | null;
  modelId: string;
  error: string | null;
  errorCode: FreeCreationErrorCode | null;
  taskId: string | null;
  progress: number;
  createdAt: string;
}

export type FreeCreationErrorCode =
  | "input_image_sensitive"
  | "input_text_sensitive"
  | "output_sensitive"
  | "quota_exceeded"
  | "configuration"
  | "cancelled"
  | "unknown";

const FREE_CREATION_ERROR_CODES = new Set<FreeCreationErrorCode>([
  "input_image_sensitive",
  "input_text_sensitive",
  "output_sensitive",
  "quota_exceeded",
  "configuration",
  "cancelled",
  "unknown",
]);

export interface FreeCreationStoredConfig {
  duration: number;
  ratio: FreeCreationRatio;
  resolution: FreeCreationResolution;
  generateAudio: boolean;
  watermark: boolean;
  seed?: number;
  inputAssets: string[];
}

export interface FreeCreationRequirements {
  firstFrame: boolean;
  lastFrame: boolean;
  references: boolean;
}

const REQUIREMENTS_BY_MODE: Record<
  FreeCreationMode,
  FreeCreationRequirements
> = {
  [FREE_CREATION_MODE.TEXT]: {
    firstFrame: false,
    lastFrame: false,
    references: false,
  },
  [FREE_CREATION_MODE.FIRST_FRAME]: {
    firstFrame: true,
    lastFrame: false,
    references: false,
  },
  [FREE_CREATION_MODE.FIRST_LAST_FRAME]: {
    firstFrame: true,
    lastFrame: true,
    references: false,
  },
  [FREE_CREATION_MODE.REFERENCE]: {
    firstFrame: false,
    lastFrame: false,
    references: true,
  },
};

export function getFreeCreationRequirements(
  mode: FreeCreationMode,
): FreeCreationRequirements {
  return REQUIREMENTS_BY_MODE[mode];
}

export function isFreeCreationMode(value: string): value is FreeCreationMode {
  return Object.values(FREE_CREATION_MODE).some((mode) => mode === value);
}

export function isFreeCreationRatio(value: string): value is FreeCreationRatio {
  return FREE_CREATION_RATIOS.some((ratio) => ratio === value);
}

export function isFreeCreationResolution(
  value: string,
): value is FreeCreationResolution {
  return FREE_CREATION_RESOLUTIONS.some((resolution) => resolution === value);
}

export function requiresFreeCreationPrompt(mode: FreeCreationMode): boolean {
  return mode === FREE_CREATION_MODE.TEXT;
}

export function parseFreeCreationStoredConfig(
  value: unknown,
): FreeCreationStoredConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  const seed = config.seed;
  if (
    typeof config.duration !== "number" ||
    !Number.isInteger(config.duration) ||
    config.duration < FREE_CREATION_DURATION_MIN_SECONDS ||
    config.duration > FREE_CREATION_DURATION_MAX_SECONDS ||
    typeof config.ratio !== "string" ||
    !isFreeCreationRatio(config.ratio) ||
    typeof config.resolution !== "string" ||
    !isFreeCreationResolution(config.resolution) ||
    typeof config.generateAudio !== "boolean" ||
    typeof config.watermark !== "boolean" ||
    (seed !== undefined &&
      (typeof seed !== "number" || !Number.isInteger(seed))) ||
    !Array.isArray(config.inputAssets) ||
    !config.inputAssets.every((asset) => typeof asset === "string")
  ) {
    return null;
  }

  return {
    duration: config.duration,
    ratio: config.ratio,
    resolution: config.resolution,
    generateAudio: config.generateAudio,
    watermark: config.watermark,
    ...(typeof seed === "number" ? { seed } : {}),
    inputAssets: config.inputAssets,
  };
}

export function classifyFreeCreationError(
  message?: string | null,
): FreeCreationErrorCode | null {
  if (!message) return null;
  if (FREE_CREATION_ERROR_CODES.has(message as FreeCreationErrorCode)) {
    return message as FreeCreationErrorCode;
  }
  if (message.includes("InputImageSensitiveContentDetected")) {
    return "input_image_sensitive";
  }
  if (message.includes("InputTextSensitiveContentDetected")) {
    return "input_text_sensitive";
  }
  if (message.includes("OutputVideoSensitiveContentDetected")) {
    return "output_sensitive";
  }
  if (message.includes("QuotaExceeded") || message.includes(" 429 ")) {
    return "quota_exceeded";
  }
  if (
    message.includes("configuration") ||
    message.includes("model profile") ||
    message.includes("401") ||
    message.includes("403")
  ) {
    return "configuration";
  }
  if (message.toLowerCase().includes("cancel")) return "cancelled";
  return "unknown";
}
