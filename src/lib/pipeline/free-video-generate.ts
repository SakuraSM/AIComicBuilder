import { eq } from "drizzle-orm";
import { resolveVideoProvider } from "@/lib/ai/provider-factory";
import type { VideoGenerateParams } from "@/lib/ai/types";
import { db } from "@/lib/db";
import { freeCreations } from "@/lib/db/schema";
import {
  FREE_CREATION_MODE,
  FREE_CREATION_STATUS,
  classifyFreeCreationError,
  parseFreeCreationStoredConfig,
  type FreeCreationMode,
  type FreeCreationStoredConfig,
} from "@/lib/free-creation";
import { resolveModelProfile } from "@/lib/model-profiles";
import {
  persistGeneratedAsset,
  withMaterializedAssets,
} from "@/lib/storage";
import type { TaskHandler } from "@/lib/task-queue";

export function buildFreeCreationVideoParams(input: {
  mode: FreeCreationMode;
  prompt: string;
  imagePaths: string[];
  settings: FreeCreationStoredConfig;
}): VideoGenerateParams {
  const common = {
    prompt: input.prompt,
    duration: input.settings.duration,
    ratio: input.settings.ratio,
    resolution: input.settings.resolution,
    generateAudio: input.settings.generateAudio,
    watermark: input.settings.watermark,
    returnLastFrame: true,
    ...(input.settings.seed === undefined ? {} : { seed: input.settings.seed }),
  };

  if (input.mode === FREE_CREATION_MODE.FIRST_FRAME) {
    return { ...common, firstFrame: input.imagePaths[0] };
  }
  if (input.mode === FREE_CREATION_MODE.FIRST_LAST_FRAME) {
    return {
      ...common,
      firstFrame: input.imagePaths[0],
      lastFrame: input.imagePaths[1],
    };
  }
  if (input.mode === FREE_CREATION_MODE.REFERENCE) {
    return {
      ...common,
      initialImage: input.imagePaths[0],
      referenceImages: input.imagePaths.slice(1),
    };
  }
  return common;
}

function getCreationId(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Free creation task payload is invalid.");
  }
  const creationId = (payload as Record<string, unknown>).creationId;
  if (typeof creationId !== "string" || !creationId) {
    throw new Error("Free creation task is missing creationId.");
  }
  return creationId;
}

export const handleFreeVideoGenerate: TaskHandler = async (task, context) => {
  const creationId = getCreationId(task.payload);
  const [creation] = await db
    .select()
    .from(freeCreations)
    .where(eq(freeCreations.id, creationId));
  if (!creation) throw new Error("Free creation no longer exists.");
  if (creation.status === FREE_CREATION_STATUS.SUCCEEDED) {
    return { creationId, videoUrl: creation.videoUrl };
  }

  const settings = parseFreeCreationStoredConfig(creation.config);
  if (!settings || !creation.modelProfileId) {
    throw new Error("Free creation configuration is incomplete.");
  }

  await db
    .update(freeCreations)
    .set({
      status: FREE_CREATION_STATUS.RUNNING,
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(freeCreations.id, creationId));
  await context.reportProgress(10, "free_video_generate");

  try {
    const modelConfig = await resolveModelProfile({
      id: creation.modelProfileId,
      userId: creation.userId,
    });
    const provider = resolveVideoProvider(modelConfig);
    const result = await withMaterializedAssets({
      values: settings.inputAssets,
      execute: (imagePaths) =>
        provider.generateVideo(
          buildFreeCreationVideoParams({
            mode: creation.mode,
            prompt: creation.prompt,
            imagePaths,
            settings,
          }),
          { signal: context.signal },
        ),
    });
    context.signal.throwIfAborted();
    await context.reportProgress(90, "free_video_persist");

    const keyPrefix = `projects/${creation.projectId}/free-creations/${creationId}/outputs`;
    const videoAsset = await persistGeneratedAsset({
      source: result.filePath,
      keyPrefix,
      filename: "video.mp4",
      contentType: "video/mp4",
    });
    const lastFrameAsset = result.lastFrameUrl
      ? await persistGeneratedAsset({
          source: result.lastFrameUrl,
          keyPrefix,
          filename: "last-frame.png",
        })
      : null;
    context.signal.throwIfAborted();

    await db
      .update(freeCreations)
      .set({
        status: FREE_CREATION_STATUS.SUCCEEDED,
        videoUrl: videoAsset.url,
        lastFrameUrl: lastFrameAsset?.url ?? null,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(freeCreations.id, creationId));
    return { creationId, videoUrl: videoAsset.url };
  } catch (error) {
    const cancelled = context.signal.aborted;
    const message = error instanceof Error ? error.message : "Video generation failed";
    const errorCode = classifyFreeCreationError(message);
    console.error("[FreeCreation] Generation failed", {
      creationId,
      error: message,
    });
    await db
      .update(freeCreations)
      .set({
        status: cancelled
          ? FREE_CREATION_STATUS.CANCELLED
          : FREE_CREATION_STATUS.FAILED,
        error: cancelled
          ? "Generation cancelled"
          : errorCode ?? "unknown",
        updatedAt: new Date(),
      })
      .where(eq(freeCreations.id, creationId));
    throw error;
  }
};
