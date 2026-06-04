import type { AIProvider, ImageOptions } from "../types";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { id as genId } from "@/lib/id";

const KLING_TOKEN_TTL_SECONDS = 1_800;
const KLING_TOKEN_NBF_SKEW_SECONDS = 5;
const DEFAULT_IMAGE_MODEL = "kling-v1";
const DEFAULT_ASPECT_RATIO = "16:9";
const IMAGE_RESULT_POLL_INTERVAL_MS = 5_000;
const IMAGE_RESULT_MAX_ATTEMPTS = 60;
const KLING_SUCCESS_CODE = 0;
const SINGLE_IMAGE_COUNT = 1;
const REFERENCE_IMAGE_MODE = "subject";
const KLING_PROMPT_MAX_CHARS = 2_500;
const TRUNCATED_PROMPT_HEAD_CHARS = 2_150;
const TRUNCATED_PROMPT_TAIL_CHARS = 280;
const CHARACTER_DESCRIPTION_MARKER = "=== CHARACTER DESCRIPTION (authoritative) ===";
const FACE_DETAIL_MARKER = "=== FACE";
const KLING_PROMPT_TRUNCATION_NOTICE =
  "\n\n[Prompt shortened to satisfy Kling's 2500 character limit. Preserve all explicit identity, costume, style, palette, and layout requirements.]";
const SUPPORTED_KLING_IMAGE_MODELS = new Set([
  "kling-v1",
  "kling-v1-5",
  "kling-v2",
  "kling-v2-new",
  "kling-v2-1",
]);

function generateKlingToken(accessKey: string, secretKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: accessKey,
      exp: now + KLING_TOKEN_TTL_SECONDS,
      nbf: now - KLING_TOKEN_NBF_SKEW_SECONDS,
    })
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

interface KlingResponse<T> {
  code: number;
  message?: string;
  request_id?: string;
  data?: T;
}

type KlingTaskStatus = "submitted" | "processing" | "succeed" | "failed";

interface KlingTaskData {
  task_id: string;
  task_status: KlingTaskStatus;
  task_status_msg?: string;
  task_result?: {
    images?: { url: string }[];
  };
}

interface KlingImageRequestBody {
  model_name: string;
  prompt: string;
  n: number;
  aspect_ratio: string;
  image?: string;
  image_reference?: typeof REFERENCE_IMAGE_MODE;
}

function isRemoteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function readReferenceImage(pathOrUrl: string): string {
  if (isRemoteUrl(pathOrUrl)) {
    return pathOrUrl;
  }

  const resolvedPath = path.resolve(pathOrUrl);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Kling image reference file not found: ${pathOrUrl}`);
  }

  return fs.readFileSync(resolvedPath).toString("base64");
}

function getErrorMessage<T>(json: KlingResponse<T>): string {
  const requestId = json.request_id ? ` request_id=${json.request_id}` : "";
  return `${json.message ?? "unknown error"}${requestId}`;
}

function requireKlingData<T>(json: KlingResponse<T>, context: string): T {
  if (json.code !== KLING_SUCCESS_CODE) {
    throw new Error(`${context}: ${getErrorMessage(json)}`);
  }

  if (!json.data) {
    throw new Error(`${context}: missing response data${json.request_id ? ` request_id=${json.request_id}` : ""}`);
  }

  return json.data;
}

function resolveFileExtension(imageUrl: string): string {
  const extension = imageUrl.split("?")[0]?.split(".").pop();
  return extension && extension.length <= 5 ? extension : "png";
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return value.slice(0, maxChars).trimEnd();
}

function extractCharacterDescription(prompt: string): string | null {
  const descriptionStart = prompt.indexOf(CHARACTER_DESCRIPTION_MARKER);
  if (descriptionStart < 0) {
    return null;
  }

  const contentStart = descriptionStart + CHARACTER_DESCRIPTION_MARKER.length;
  const faceMarkerStart = prompt.indexOf(FACE_DETAIL_MARKER, contentStart);
  const contentEnd = faceMarkerStart >= 0 ? faceMarkerStart : prompt.length;
  const description = prompt.slice(contentStart, contentEnd).trim();
  return description || null;
}

function buildCompactCharacterPrompt(prompt: string): string | null {
  const characterDescription = extractCharacterDescription(prompt);
  if (!characterDescription) {
    return null;
  }

  const fixedInstructions = `Character four-view reference sheet on a pure white canvas.

Use the CHARACTER DESCRIPTION as the authoritative source. Preserve the explicit medium, style, palette, era, face, hair, costume, accessories, weapons, body proportions, and mood exactly. Do not convert stylized illustration or 3D Chinese animation style into live-action photography unless the description explicitly asks for photography.

Layout: four consistent waist-up views arranged left to right: front, three-quarter right, right side profile, back. Same identity, proportions, outfit, hairstyle, colors, materials, lighting direction, and expression in every view. Clean professional key/fill/rim lighting. Add the character name label below the views if a Name field is present.

CHARACTER DESCRIPTION:
`;

  const remainingChars = KLING_PROMPT_MAX_CHARS - fixedInstructions.length;
  if (remainingChars <= 0) {
    return truncateText(fixedInstructions, KLING_PROMPT_MAX_CHARS);
  }

  return `${fixedInstructions}${truncateText(characterDescription, remainingChars)}`;
}

function fitPromptForKling(prompt: string): string {
  if (prompt.length <= KLING_PROMPT_MAX_CHARS) {
    return prompt;
  }

  const compactCharacterPrompt = buildCompactCharacterPrompt(prompt);
  if (compactCharacterPrompt) {
    return truncateText(compactCharacterPrompt, KLING_PROMPT_MAX_CHARS);
  }

  const head = prompt.slice(0, TRUNCATED_PROMPT_HEAD_CHARS).trimEnd();
  const tail = prompt.slice(-TRUNCATED_PROMPT_TAIL_CHARS).trimStart();
  return truncateText(`${head}${KLING_PROMPT_TRUNCATION_NOTICE}\n\n${tail}`, KLING_PROMPT_MAX_CHARS);
}

function resolveImageModelName(modelName: string): string {
  if (SUPPORTED_KLING_IMAGE_MODELS.has(modelName)) {
    return modelName;
  }

  console.warn(
    `[Kling Image] Model ${modelName} is not supported by image generation; falling back to kling-v2-1`
  );
  return "kling-v2-1";
}

export class KlingImageProvider implements AIProvider {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private model: string;
  private uploadDir: string;

  constructor(params?: {
    apiKey?: string;
    secretKey?: string;
    baseUrl?: string;
    model?: string;
    uploadDir?: string;
  }) {
    this.apiKey = (params?.apiKey || process.env.KLING_ACCESS_KEY || "").trim();
    this.secretKey = (params?.secretKey || process.env.KLING_SECRET_KEY || "").trim();
    this.baseUrl = (params?.baseUrl || "https://api.klingai.com").replace(/\/+$/, "");
    this.model = params?.model || DEFAULT_IMAGE_MODEL;
    this.uploadDir = params?.uploadDir || process.env.UPLOAD_DIR || "./uploads";
  }

  private getAuthHeader(): string {
    if (!this.apiKey) {
      throw new Error("Kling image: missing access key");
    }

    if (this.secretKey) {
      return `Bearer ${generateKlingToken(this.apiKey, this.secretKey)}`;
    }

    return `Bearer ${this.apiKey}`;
  }

  async generateText(): Promise<string> {
    throw new Error("Kling does not support text generation");
  }

  async generateImage(prompt: string, options?: ImageOptions): Promise<string> {
    const modelName = resolveImageModelName(options?.model || this.model);
    const body = this.buildImageRequestBody(prompt, options, modelName);

    console.log(
      `[Kling Image] Submit: model=${modelName}, ratio=${body.aspect_ratio}, refs=${body.image ? 1 : 0}`
    );

    const submitRes = await fetch(`${this.baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      const errBody = await submitRes.text().catch(() => "");
      throw new Error(`Kling image submit failed: ${submitRes.status} ${errBody}`);
    }

    const submitJson = (await submitRes.json()) as KlingResponse<{ task_id: string }>;
    const submitData = requireKlingData(submitJson, "Kling image submit error");
    const taskId = submitData.task_id;
    console.log(`[Kling Image] Task submitted: ${taskId}`);

    const imageUrl = await this.pollForResult(taskId);

    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Kling image download failed: ${imageRes.status}`);
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const ext = resolveFileExtension(imageUrl);
    const filename = `${genId()}.${ext}`;
    const dir = path.join(this.uploadDir, "images");
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buffer);

    console.log(`[Kling Image] Saved to ${filepath}`);
    return filepath;
  }

  private buildImageRequestBody(
    prompt: string,
    options: ImageOptions | undefined,
    modelName: string
  ): KlingImageRequestBody {
    const fittedPrompt = fitPromptForKling(prompt);
    if (fittedPrompt.length < prompt.length) {
      console.warn(
        `[Kling Image] Prompt shortened from ${prompt.length} to ${fittedPrompt.length} chars`
      );
    }

    const body: KlingImageRequestBody = {
      model_name: modelName,
      prompt: fittedPrompt,
      n: SINGLE_IMAGE_COUNT,
      aspect_ratio: options?.aspectRatio || DEFAULT_ASPECT_RATIO,
    };

    const firstReferenceImage = options?.referenceImages?.[0];
    if (firstReferenceImage) {
      body.image = readReferenceImage(firstReferenceImage);
      body.image_reference = REFERENCE_IMAGE_MODE;
    }

    return body;
  }

  private async pollForResult(taskId: string): Promise<string> {
    for (let i = 0; i < IMAGE_RESULT_MAX_ATTEMPTS; i++) {
      await new Promise((resolve) => setTimeout(resolve, IMAGE_RESULT_POLL_INTERVAL_MS));

      const res = await fetch(`${this.baseUrl}/v1/images/generations/${taskId}`, {
        headers: { Authorization: this.getAuthHeader() },
      });

      if (!res.ok) {
        throw new Error(`Kling image poll failed: ${res.status}`);
      }

      const json = (await res.json()) as KlingResponse<KlingTaskData>;
      const taskData = requireKlingData(json, "Kling image poll error");

      const { task_status, task_status_msg, task_result } = taskData;
      console.log(`[Kling Image] Poll ${i + 1}: status=${task_status}`);

      if (task_status === "succeed") {
        const url = task_result?.images?.[0]?.url;
        if (!url) throw new Error("Kling image: no URL in result");
        return url;
      }

      if (task_status === "failed") {
        throw new Error(`Kling image generation failed: ${task_status_msg ?? "unknown failure"}`);
      }
    }

    throw new Error("Kling image generation timed out after 5 minutes");
  }
}
