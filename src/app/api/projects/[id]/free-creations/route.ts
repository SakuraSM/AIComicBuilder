import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { freeCreations, projects, tasks } from "@/lib/db/schema";
import { id as generateId } from "@/lib/id";
import { getCurrentUserFromRequest } from "@/lib/auth/session";
import { resolveModelProfile } from "@/lib/model-profiles";
import { getSeedanceModelCapabilities } from "@/lib/ai/model-limits";
import {
  FREE_CREATION_DURATION_MAX_SECONDS,
  FREE_CREATION_DURATION_MIN_SECONDS,
  FREE_CREATION_MAX_IMAGE_BYTES,
  FREE_CREATION_MAX_PROMPT_LENGTH,
  FREE_CREATION_MAX_REFERENCE_IMAGES,
  FREE_CREATION_MAX_UPLOAD_BYTES,
  FREE_CREATION_MODE,
  FREE_CREATION_STATUS,
  classifyFreeCreationError,
  getFreeCreationRequirements,
  isFreeCreationMode,
  isFreeCreationRatio,
  isFreeCreationResolution,
  requiresFreeCreationPrompt,
  type FreeCreationMode,
  type FreeCreationRatio,
  type FreeCreationResolution,
  type FreeCreationSummary,
} from "@/lib/free-creation";
import { objectUrlToPublicUrl } from "@/lib/storage/url";
import { putObject } from "@/lib/storage";
import { enqueueTask, TASK_STATUS } from "@/lib/task-queue";

export const maxDuration = 60;

const SUPPORTED_PROTOCOL = "seedance";
const MAX_HISTORY_ITEMS = 20;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface FreeCreationSettings {
  duration: number;
  ratio: FreeCreationRatio;
  resolution: FreeCreationResolution;
  generateAudio: boolean;
  watermark: boolean;
  seed?: number;
}

interface UploadedInputs {
  firstFrame: File | null;
  lastFrame: File | null;
  references: File[];
}

function parseInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseSettings(formData: FormData): FreeCreationSettings | null {
  const duration = parseInteger(formData.get("duration"));
  const ratio = formData.get("ratio");
  const resolution = formData.get("resolution");
  const seed = parseInteger(formData.get("seed"));

  if (
    duration === null ||
    duration < FREE_CREATION_DURATION_MIN_SECONDS ||
    duration > FREE_CREATION_DURATION_MAX_SECONDS ||
    typeof ratio !== "string" ||
    !isFreeCreationRatio(ratio) ||
    typeof resolution !== "string" ||
    !isFreeCreationResolution(resolution) ||
    (seed !== null && (seed < -1 || seed > 4_294_967_295))
  ) {
    return null;
  }

  return {
    duration,
    ratio,
    resolution,
    generateAudio: formData.get("generateAudio") === "true",
    watermark: formData.get("watermark") === "true",
    ...(seed === null ? {} : { seed }),
  };
}

function toFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

function parseUploadedInputs(formData: FormData): UploadedInputs {
  return {
    firstFrame: toFile(formData.get("firstFrame")),
    lastFrame: toFile(formData.get("lastFrame")),
    references: formData
      .getAll("referenceImages")
      .filter((value): value is File => value instanceof File && value.size > 0),
  };
}

function validateUploadedInputs(
  mode: FreeCreationMode,
  inputs: UploadedInputs,
): string | null {
  const requirements = getFreeCreationRequirements(mode);
  if (requirements.firstFrame && !inputs.firstFrame) return "First frame is required";
  if (requirements.lastFrame && !inputs.lastFrame) return "Last frame is required";
  if (requirements.references && inputs.references.length === 0) {
    return "At least one reference image is required";
  }
  if (inputs.references.length > FREE_CREATION_MAX_REFERENCE_IMAGES) {
    return `Reference images cannot exceed ${FREE_CREATION_MAX_REFERENCE_IMAGES}`;
  }

  const files = [
    inputs.firstFrame,
    inputs.lastFrame,
    ...inputs.references,
  ].filter((file): file is File => file !== null);
  const invalidFile = files.find(
    (file) =>
      file.size > FREE_CREATION_MAX_IMAGE_BYTES ||
      (file.type !== "" && !ALLOWED_IMAGE_TYPES.has(file.type)),
  );
  if (invalidFile) return `Invalid image: ${invalidFile.name}`;
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > FREE_CREATION_MAX_UPLOAD_BYTES) {
    return "The combined image upload cannot exceed 50MB";
  }
  return null;
}

function selectModeFiles(
  mode: FreeCreationMode,
  inputs: UploadedInputs,
): File[] {
  if (mode === FREE_CREATION_MODE.FIRST_FRAME) {
    return inputs.firstFrame ? [inputs.firstFrame] : [];
  }
  if (mode === FREE_CREATION_MODE.FIRST_LAST_FRAME) {
    return [inputs.firstFrame, inputs.lastFrame].filter(
      (file): file is File => file !== null,
    );
  }
  if (mode === FREE_CREATION_MODE.REFERENCE) return inputs.references;
  return [];
}

function toSummary(
  creation: typeof freeCreations.$inferSelect,
  task?: Pick<typeof tasks.$inferSelect, "status" | "progress" | "error"> | null,
): FreeCreationSummary {
  const status =
    task?.status === TASK_STATUS.RUNNING
      ? FREE_CREATION_STATUS.RUNNING
      : task?.status === TASK_STATUS.CANCELLED
        ? FREE_CREATION_STATUS.CANCELLED
        : task?.status === TASK_STATUS.FAILED
          ? FREE_CREATION_STATUS.FAILED
          : creation.status;
  const rawError = creation.error ?? task?.error ?? null;
  const errorCode = classifyFreeCreationError(rawError);
  return {
    id: creation.id,
    mode: creation.mode,
    status,
    prompt: creation.prompt,
    videoUrl: creation.videoUrl
      ? objectUrlToPublicUrl(creation.videoUrl)
      : null,
    lastFrameUrl: creation.lastFrameUrl
      ? objectUrlToPublicUrl(creation.lastFrameUrl)
      : null,
    modelId: creation.modelId,
    error: errorCode ? null : rawError,
    errorCode,
    taskId: creation.taskId,
    progress: task?.progress ?? (creation.status === FREE_CREATION_STATUS.SUCCEEDED ? 100 : 0),
    createdAt: creation.createdAt.toISOString(),
  };
}

async function findOwnedProject(input: {
  projectId: string;
  userId: string;
}): Promise<{ id: string } | null> {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, input.projectId),
        eq(projects.userId, input.userId),
      ),
    );
  return project ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  if (!(await findOwnedProject({ projectId, userId: user.id }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select({ creation: freeCreations, task: tasks })
    .from(freeCreations)
    .leftJoin(tasks, eq(freeCreations.taskId, tasks.id))
    .where(
      and(
        eq(freeCreations.projectId, projectId),
        eq(freeCreations.userId, user.id),
      ),
    )
    .orderBy(desc(freeCreations.createdAt))
    .limit(MAX_HISTORY_ITEMS);

  return NextResponse.json(rows.map(({ creation, task }) => toSummary(creation, task)));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  if (!(await findOwnedProject({ projectId, userId: user.id }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const promptValue = formData.get("prompt");
  const modeValue = formData.get("mode");
  const modelProfileIdValue = formData.get("modelProfileId");
  const prompt = typeof promptValue === "string" ? promptValue.trim() : "";

  if (
    prompt.length > FREE_CREATION_MAX_PROMPT_LENGTH ||
    typeof modeValue !== "string" ||
    !isFreeCreationMode(modeValue) ||
    typeof modelProfileIdValue !== "string" ||
    !modelProfileIdValue
  ) {
    return NextResponse.json({ error: "Invalid free creation request" }, { status: 400 });
  }
  if (requiresFreeCreationPrompt(modeValue) && !prompt) {
    return NextResponse.json({ error: "A prompt is required for text-to-video" }, { status: 400 });
  }

  const settings = parseSettings(formData);
  if (!settings) {
    return NextResponse.json({ error: "Invalid generation settings" }, { status: 400 });
  }
  const uploadedInputs = parseUploadedInputs(formData);
  const uploadError = validateUploadedInputs(modeValue, uploadedInputs);
  if (uploadError) {
    return NextResponse.json({ error: uploadError }, { status: 400 });
  }

  let modelConfig;
  try {
    modelConfig = await resolveModelProfile({
      id: modelProfileIdValue,
      userId: user.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Model profile not found" },
      { status: 400 },
    );
  }
  const videoConfig = modelConfig.video;
  if (!videoConfig || videoConfig.protocol !== SUPPORTED_PROTOCOL) {
    return NextResponse.json(
      { error: "Free creation currently requires the official Seedance protocol" },
      { status: 400 },
    );
  }
  const capabilities = getSeedanceModelCapabilities(videoConfig.modelId);
  if (settings.duration > capabilities.maxDuration) {
    return NextResponse.json(
      { error: "Duration exceeds the selected model limit" },
      { status: 400 },
    );
  }
  if (!capabilities.supportedResolutions.includes(settings.resolution)) {
    return NextResponse.json(
      { error: "The selected model does not support this resolution" },
      { status: 400 },
    );
  }
  if (uploadedInputs.references.length > capabilities.maxReferenceImages) {
    return NextResponse.json(
      { error: `The selected model supports at most ${capabilities.maxReferenceImages} reference images` },
      { status: 400 },
    );
  }

  const creationId = generateId();
  const selectedFiles = selectModeFiles(modeValue, uploadedInputs);
  const storedInputs = await Promise.all(
    selectedFiles.map(async (file) =>
      putObject({
        buffer: Buffer.from(await file.arrayBuffer()),
        filename: file.name,
        keyPrefix: `projects/${projectId}/free-creations/${creationId}/inputs`,
        contentType: file.type || undefined,
      }),
    ),
  );
  const now = new Date();
  const [pendingCreation] = await db
    .insert(freeCreations)
    .values({
      id: creationId,
      projectId,
      userId: user.id,
      modelProfileId: modelProfileIdValue,
      mode: modeValue,
      status: FREE_CREATION_STATUS.PENDING,
      prompt,
      modelId: videoConfig.modelId,
      protocol: videoConfig.protocol,
      config: {
        ...settings,
        inputAssets: storedInputs.map((asset) => asset.url),
      },
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  try {
    const task = await enqueueTask({
      type: "free_video_generate",
      projectId,
      stage: "free_video_generate",
      payload: { creationId },
      maxRetries: 1,
      idempotencyKey: `free-creation:${creationId}`,
    });
    const [queuedCreation] = await db
      .update(freeCreations)
      .set({
        taskId: task.id,
        updatedAt: new Date(),
      })
      .where(eq(freeCreations.id, creationId))
      .returning();
    return NextResponse.json(toSummary(queuedCreation, task), { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video generation failed";
    await db
      .update(freeCreations)
      .set({
        status: FREE_CREATION_STATUS.FAILED,
        error: message.slice(0, 2_000),
        updatedAt: new Date(),
      })
      .where(eq(freeCreations.id, pendingCreation.id));
    return NextResponse.json({ error: "Failed to queue video generation" }, { status: 500 });
  }
}
