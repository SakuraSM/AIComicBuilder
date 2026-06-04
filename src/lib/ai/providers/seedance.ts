import type { VideoProvider, VideoGenerateParams, VideoGenerateResult } from "../types";
import fs from "node:fs";
import path from "node:path";
import { id as genId } from "@/lib/id";

const DEFAULT_SEEDANCE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_SEEDANCE_MODEL = "doubao-seedance-1-5-pro-251215";
const DEFAULT_DURATION_SECONDS = 5;
const DEFAULT_RATIO = "16:9";
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;
const MAX_REFERENCE_IMAGES = 9;
const WATERMARK_ENABLED = false;
const CAMERA_FIXED = false;

type SeedanceTaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

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

interface SeedanceTaskRequest {
  model: string;
  content: SeedanceContent[];
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

function buildTextWithInlineOptions(params: VideoGenerateParams): string {
  const duration = params.duration || DEFAULT_DURATION_SECONDS;
  const ratio = params.ratio || DEFAULT_RATIO;
  return [
    params.prompt.trim(),
    `--duration ${duration}`,
    `--camerafixed ${CAMERA_FIXED}`,
    `--watermark ${WATERMARK_ENABLED}`,
    `--ratio ${ratio}`,
  ].join(" ");
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

  async generateVideo(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    const body = "firstFrame" in params
      ? this.buildKeyframeBody(params as VideoGenerateParams & { firstFrame: string; lastFrame: string })
      : this.buildReferenceBody(params as VideoGenerateParams & { initialImage: string });

    console.log(
      `[Seedance] Submitting task: model=${body.model}, images=${body.content.length - 1}`
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

    const { videoUrl, lastFrameUrl } = await this.pollForResult(submitResult.id);

    const videoResponse = await fetch(videoUrl);
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

  private buildKeyframeBody(
    params: VideoGenerateParams & { firstFrame: string; lastFrame: string }
  ): SeedanceTaskRequest {
    return {
      model: this.model,
      content: [
        { type: "text", text: buildTextWithInlineOptions(params) },
        {
          type: "image_url",
          image_url: { url: toImageUrl(params.firstFrame) },
          role: "first_frame",
        },
        {
          type: "image_url",
          image_url: { url: toImageUrl(params.lastFrame) },
          role: "last_frame",
        },
      ],
    };
  }

  private buildReferenceBody(
    params: VideoGenerateParams & { initialImage: string }
  ): SeedanceTaskRequest {
    const referenceImages = params.referenceImages?.length
      ? params.referenceImages.slice(0, MAX_REFERENCE_IMAGES)
      : [params.initialImage];

    const imageContent = referenceImages.map<SeedanceImageContent>((imagePathOrUrl) => ({
      type: "image_url",
      image_url: { url: toImageUrl(imagePathOrUrl) },
      role: referenceImages.length > 1 ? "reference_image" : undefined,
    }));

    return {
      model: this.model,
      content: [
        { type: "text", text: buildTextWithInlineOptions(params) },
        ...imageContent,
      ],
    };
  }

  private async pollForResult(taskId: string): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
    for (let i = 0; i < DEFAULT_MAX_POLL_ATTEMPTS; i++) {
      await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLL_INTERVAL_MS));

      const response = await fetch(
        `${this.baseUrl}/api/v3/contents/generations/tasks/${encodeURIComponent(taskId)}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
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

      if (status === "failed" || status === "cancelled") {
        throw new Error(`Seedance generation ${status}: ${resolveFailedTaskMessage(result)}`);
      }
    }

    throw new Error("Seedance generation timed out after 10 minutes");
  }
}
