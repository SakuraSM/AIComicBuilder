import type {
  VideoGenerateContext,
  VideoProvider,
  VideoGenerateParams,
  VideoGenerateResult,
} from "../types";
import { getSeedanceModelCapabilities } from "@/lib/ai/model-limits";
import fs from "node:fs";
import path from "node:path";
import { id as genId } from "@/lib/id";

const DEFAULT_SEEDANCE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_SEEDANCE_MODEL = "doubao-seedance-2-0-260128";
const DEFAULT_DURATION_SECONDS = 5;
const DEFAULT_RATIO = "adaptive";
const DEFAULT_RESOLUTION = "720p";
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;

type SeedanceTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

interface SeedanceImageContent {
  type: "image_url";
  image_url: { url: string };
  role?: "first_frame" | "last_frame" | "reference_image";
}

interface SeedanceTextContent {
  type: "text";
  text: string;
}

type SeedanceContent = SeedanceTextContent | SeedanceImageContent;

export interface SeedanceTaskRequest {
  model: string;
  content: SeedanceContent[];
  duration: number;
  ratio: string;
  resolution: "480p" | "720p" | "1080p";
  generate_audio: boolean;
  watermark: boolean;
  return_last_frame: boolean;
  omni_reference_task_type?: "reference";
  seed?: number;
}

interface SeedanceTaskCreateResponse {
  id?: string;
  error?: { message?: string };
}

interface SeedanceTaskQueryResponse {
  status?: SeedanceTaskStatus | string;
  content?: {
    video_url?: string;
    last_frame_url?: string;
  };
  output?: {
    video_url?: string;
    last_frame_url?: string;
    url?: string;
    urls?: string[];
  };
  result?: {
    video_url?: string;
    last_frame_url?: string;
    url?: string;
    urls?: string[];
  };
  error?: { message?: string };
}

function toDataUrl(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const mime =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/png";
  const base64 = fs.readFileSync(filePath, { encoding: "base64" });
  return `data:${mime};base64,${base64}`;
}

function toImageUrl(imagePathOrUrl: string): string {
  if (
    imagePathOrUrl.startsWith("http://") ||
    imagePathOrUrl.startsWith("https://") ||
    imagePathOrUrl.startsWith("asset://") ||
    imagePathOrUrl.startsWith("data:image/")
  ) {
    return imagePathOrUrl;
  }

  return toDataUrl(imagePathOrUrl);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "").replace(/\/api\/v3$/, "");
}

function buildImageContent(
  imagePathOrUrl: string,
  role: NonNullable<SeedanceImageContent["role"]>,
): SeedanceImageContent {
  return {
    type: "image_url",
    image_url: { url: toImageUrl(imagePathOrUrl) },
    role,
  };
}

export function buildSeedanceTaskRequest(input: {
  model: string;
  params: VideoGenerateParams;
}): SeedanceTaskRequest {
  const { model, params } = input;
  const prompt = params.prompt.trim();
  const content: SeedanceContent[] = prompt
    ? [{ type: "text", text: prompt }]
    : [];

  if (params.firstFrame) {
    content.push(buildImageContent(params.firstFrame, "first_frame"));
    if (params.lastFrame) {
      content.push(buildImageContent(params.lastFrame, "last_frame"));
    }
  } else if (params.initialImage) {
    const capabilities = getSeedanceModelCapabilities(model);
    const referenceImages = [
      params.initialImage,
      ...(params.referenceImages ?? []),
    ].slice(0, capabilities.maxReferenceImages);
    content.push(
      ...referenceImages.map((imagePathOrUrl) =>
        buildImageContent(imagePathOrUrl, "reference_image"),
      ),
    );
  }

  const isReferenceTask = Boolean(params.initialImage);
  const capabilities = getSeedanceModelCapabilities(model);
  return {
    model,
    content,
    duration: params.duration || DEFAULT_DURATION_SECONDS,
    ratio: params.ratio || DEFAULT_RATIO,
    resolution: params.resolution ?? DEFAULT_RESOLUTION,
    generate_audio: params.generateAudio ?? false,
    watermark: params.watermark ?? false,
    return_last_frame: params.returnLastFrame ?? false,
    ...(isReferenceTask && capabilities.supportsOmniReferenceTaskType
      ? { omni_reference_task_type: "reference" as const }
      : {}),
    ...(params.seed === undefined ? {} : { seed: params.seed }),
  };
}

function extractVideoResult(
  result: SeedanceTaskQueryResponse
): { videoUrl?: string; lastFrameUrl?: string } {
  const videoUrl =
    result.content?.video_url ??
    result.output?.video_url ??
    result.output?.url ??
    result.output?.urls?.[0] ??
    result.result?.video_url ??
    result.result?.url ??
    result.result?.urls?.[0];

  const lastFrameUrl =
    result.content?.last_frame_url ??
    result.output?.last_frame_url ??
    result.result?.last_frame_url;

  return { videoUrl, lastFrameUrl };
}

function resolveFailedTaskMessage(result: SeedanceTaskQueryResponse): string {
  return result.error?.message ?? "unknown";
}

function waitForPollInterval(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
  }
  return new Promise<void>((resolve, reject) => {
    const handleAbort = () => {
      clearTimeout(timeoutId);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, DEFAULT_POLL_INTERVAL_MS);
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

export class SeedanceProvider implements VideoProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private uploadDir: string;

  constructor(params?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    uploadDir?: string;
  }) {
    this.apiKey = params?.apiKey || process.env.SEEDANCE_API_KEY || "";
    this.baseUrl = normalizeBaseUrl(
      params?.baseUrl ||
        process.env.SEEDANCE_BASE_URL ||
        DEFAULT_SEEDANCE_BASE_URL
    );
    this.model =
      params?.model || process.env.SEEDANCE_MODEL || DEFAULT_SEEDANCE_MODEL;
    this.uploadDir =
      params?.uploadDir || process.env.UPLOAD_DIR || "./uploads";
  }

  async generateVideo(
    params: VideoGenerateParams,
    context: VideoGenerateContext = {},
  ): Promise<VideoGenerateResult> {
    const body = buildSeedanceTaskRequest({ model: this.model, params });

    console.log(
      `[Seedance] Submitting task: model=${body.model}, inputs=${body.content.length}`
    );

    const submitResponse = await fetch(
      `${this.baseUrl}/api/v3/contents/generations/tasks`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: context.signal,
      }
    );

    if (!submitResponse.ok) {
      const errText = await submitResponse.text();
      throw new Error(
        `Seedance submit failed: ${submitResponse.status} ${errText}`
      );
    }

    const submitResult = (await submitResponse.json()) as SeedanceTaskCreateResponse;
    if (!submitResult.id) {
      throw new Error(`Seedance: no task id in response: ${JSON.stringify(submitResult)}`);
    }

    console.log(`[Seedance] Task submitted: ${submitResult.id}`);

    const { videoUrl, lastFrameUrl } = await this.pollForResult(
      submitResult.id,
      context.signal,
    );

    const videoResponse = await fetch(videoUrl, { signal: context.signal });
    if (!videoResponse.ok) {
      throw new Error(`Seedance video download failed: ${videoResponse.status}`);
    }

    const buffer = Buffer.from(await videoResponse.arrayBuffer());
    const filename = `${genId()}.mp4`;
    const dir = path.join(this.uploadDir, "videos");
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buffer);

    return { filePath: filepath, lastFrameUrl };
  }

  private async pollForResult(
    taskId: string,
    signal?: AbortSignal,
  ): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
    try {
      for (let i = 0; i < DEFAULT_MAX_POLL_ATTEMPTS; i++) {
        await waitForPollInterval(signal);

        const response = await fetch(
          `${this.baseUrl}/api/v3/contents/generations/tasks/${encodeURIComponent(taskId)}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`,
            },
            signal,
          },
        );

        if (!response.ok) {
          console.warn(`[Seedance] Poll ${i + 1}: HTTP ${response.status}, retrying`);
          continue;
        }

        const result = (await response.json()) as SeedanceTaskQueryResponse;
        const status = result.status ?? "unknown";
        console.log(`[Seedance] Poll ${i + 1}: status=${status}`);

        if (status === "succeeded") {
          const { videoUrl, lastFrameUrl } = extractVideoResult(result);
          if (!videoUrl) {
            throw new Error(`Seedance: succeeded but no video URL in response: ${JSON.stringify(result)}`);
          }
          return { videoUrl, lastFrameUrl };
        }

        if (status === "failed" || status === "cancelled" || status === "expired") {
          throw new Error(`Seedance generation ${status}: ${resolveFailedTaskMessage(result)}`);
        }
      }

      throw new Error("Seedance generation timed out after 10 minutes");
    } catch (error) {
      if (signal?.aborted) {
        await this.cancelRemoteTask(taskId);
      }
      throw error;
    }
  }

  private async cancelRemoteTask(taskId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v3/contents/generations/tasks/${encodeURIComponent(taskId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${this.apiKey}` },
        },
      );
      if (!response.ok) {
        console.warn(`[Seedance] Failed to cancel task ${taskId}: HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn(`[Seedance] Failed to cancel task ${taskId}:`, error);
    }
  }
}
